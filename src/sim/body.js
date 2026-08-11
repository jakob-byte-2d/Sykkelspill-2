import { COOP_PULL_SEC, COOP_SEED, FUEL_START } from "../content/tuning.js";
import { clamp, gaussOf } from "./rng.js";

/* The body: a power-duration curve and three tanks. Everything a rider can do today
   is read off these — nothing anywhere asks who he is. */

/* ---------------- The rider's body ---------------- */
export const COLORS = ["#f5f2e9", "#ffd23f", "#2ec4b6", "#ff5d73", "#b78bfa", "#4d96ff"];

// the rider's own power–duration curve: regression p = a + b·ln(t) through his
// 1-, 5- and 20-minute points, readable at any duration
export function powerAt(c, t) {
  const pts = [[60, c.p1], [300, c.p5], [1200, c.p20]];
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [tt, p] of pts) { const x = Math.log(tt); sx += x; sy += p; sxx += x * x; sxy += x * p; }
  const b = (3 * sxy - sx * sy) / (3 * sxx - sx * sx);
  const a = (sy - b * sx) / 3;
  return a + b * Math.log(t);
}

export function thresholdFrom(c) {
  // read at 60 min, held to a sane band around his stated hour power
  return clamp(powerAt(c, 3600), 1.02 * c.p60, 1.07 * c.p60);
}

export function makeRiders(rng) {
  const riders = [];
  const mk = (i, name, mass, h, curve) => {
    const T0 = thresholdFrom(curve);
    const cda = 0.30 * Math.pow(mass / 70, 0.32) * Math.sqrt(h / 1.8);
    const form = clamp(1 + gaussOf(rng) * 0.045, 0.9, 1.1);
    const r = {
      i, name, color: COLORS[i], isPlayer: i === 0, mass, h, cda,
      curve, T0, form,
      // his own pull, read off his own curve — not everyone's constant
      pullX: powerAt(curve, COOP_PULL_SEC) / T0,
      // his sprint measured against his own engine: what he gains by arriving together
      sprintX: curve.p5s / T0,
      // the anaerobic battery. A sprinter is a man with a big one and a climber's is
      // small, and reading it off the five-minute power cannot tell those apart — it
      // only knows the engine. So it is given in kilojoules, and derived only if not.
      surgeMax: curve.wp ? curve.wp * 1000 : Math.max((curve.p5 - T0) * 300, 6000), surge: 0,
      fuelMax: 125000 * mass, fuel: 125000 * mass * FUEL_START,
      legs: clamp(0.42 + gaussOf(rng) * 0.05, 0.3, 0.55), recov: 0.9 + rng() * 0.2,
      dist: 0, prevDist: 0, speed: 11.5, power: 0, ped: rng() * 6,
      shel: 0,
      st: { work: 0, wind: 0, above: 0, minFuel: FUEL_START, t: 0 },
      finished: null, caught: false, rampT: 0, rampFrom: 0, hold: false, paid: COOP_SEED,
      // the turn on the front: the tank he brought to it, how long he has held it,
      // and whether it has been declared over — a flag, so it survives the drop-back
      pullMark: null, pullT: 0, done: false,
    };
    riders.push(r);
    r.surge = usableSurge(r);
  };
  // three all-rounders, a climber and a big diesel — everything that separates them
  // (cda, threshold, the pull, the sprint) falls out of these numbers on its own.
  // wp is the anaerobic battery in kilojoules: what a man has above his threshold.
  // No pure sprinter here — one would never have survived 150 km and a six per cent
  // climb to reach this move in the first place.
  mk(0, "PEDERSEN", 76, 1.80, { p5s: 1450, p1: 800, p5: 560, p20: 490, p60: 455, wp: 26 });
  mk(1, "V.D.POEL", 75, 1.84, { p5s: 1560, p1: 800, p5: 565, p20: 495, p60: 460, wp: 28 });
  mk(2, "VAN AERT", 78, 1.90, { p5s: 1600, p1: 820, p5: 570, p20: 500, p60: 465, wp: 29 });
  // ...and the climber is the explosive kind, not the diesel: he is the best man in this
  // group from about four minutes upward, which is what this stage's hill actually lasts.
  // A flatter, more aerobic climber would beat him on a twenty-minute col and lose to him
  // here. The low p5s and the small wp are the same rider seen from the other end: he
  // attacks with an aerobic engine and cannot sprint at all — the worst finish in the
  // break, so being together at the line is the one thing he must not allow. And he
  // weighs what the last man weighed: any lighter and he falls off the back on descents,
  // where the road hands speed out by the kilogram.
  mk(3, "PANTANI", 62, 1.72, { p5s: 800, p1: 590, p5: 517, p20: 455, p60: 402, wp: 15 });
  mk(4, "KÜNG", 83, 1.93, { p5s: 1300, p1: 720, p5: 555, p20: 480, p60: 450, wp: 24 });
  return riders;
}

// What a man can hold for an effort of this length, tired as he is right now: his own
// curve read at that duration, carrying the same fatigue discount his threshold does.
// Which man it flatters depends entirely on the number: over an hour the 62-kilo climber
// leads the group by fifteen per cent, over seven minutes by a third of one, and under
// five the puncheur is ahead of him. A hill is not one kind of terrain — its LENGTH
// decides whose it is, and that is why the reading has to be taken at the real duration.
export const durPower = (o, t, T) => T * powerAt(o.curve, clamp(t, 30, 3600)) / o.T0;

/* Threshold right now, and the ceiling */
// heavy legs shrink the tank you can actually fill — this is where most of the penalty lives
export const usableSurge = (r) => r.surgeMax * (1 - 0.35 * r.legs);

// ...and his threshold with the tank taken out of the question: bodyNow's own reading
// with the two terms that describe running out of fuel set aside. It is not a number he
// can really hold for four hundred kilometres — that is the point. It is a fixed
// reference the deadline can be built on, immune to how the race actually goes.
export const thresholdFull = (r) => r.T0 * r.form * (1 - 0.15 * r.legs);

export function bodyNow(r) {
  const ff = clamp(r.fuel / r.fuelMax, 0, 1);
  const fuelFac = 0.74 + 0.26 * Math.pow(ff, 0.7);
  const collapse = ff < 0.08 ? Math.pow(ff / 0.08, 2) : 1;
  const T = r.T0 * r.form * fuelFac * Math.max(collapse, 0.15) * (1 - 0.15 * r.legs);
  const cap = usableSurge(r);
  const sf = clamp(cap > 0 ? r.surge / cap : 0, 0, 1);
  const fl = T * (0.8 + 0.2 * sf);
  let ceil = (fl + (r.curve.p5s * r.form - fl) * Math.sqrt(sf)) * (1 - 0.07 * r.legs) * Math.max(collapse, 0.25);
  ceil = Math.max(ceil, T * 0.5, 140);
  return { T, ceil, sf, ff };
}

/* Every pedal stroke costs; the three tanks update */
export function spend(r, P, dt, body, inWind) {
  const { T } = body;
  // durability: every kilojoule wears the legs, hard ones far more — and it never comes back today
  const kJ = P * dt / 1000;
  r.legs += kJ * 3.0e-4 * Math.pow(Math.max(P, 1) / Math.max(T, 1), 2.2) * (body.sf < 0.15 ? 2.2 : 1);
  if (P > T) {
    r.surge -= (P - T) * dt;
    if (r.surge < 0) { r.legs += (-r.surge) * 2.2e-5; r.surge = 0; }
    r.st.above += dt;
  } else {
    const below = clamp((T - P) / Math.max(T, 1), 0, 1);
    let tau = (420 / r.recov) * (1 + 1.1 * r.legs) * (1 + 0.5 * (1 - body.ff)) * (1 - 0.35 * below);
    tau = clamp(tau, 290, 800);
    const cap = usableSurge(r);
    if (r.surge < cap) r.surge += (cap - r.surge) * (1 - Math.exp(-dt / tau));
    else r.surge = cap;
  }
  r.legs = clamp(r.legs, 0, 1);
  const eff = 0.225 - 0.035 * (1 - body.ff);
  const over = P > T ? 1 + 0.18 * clamp((P - T) / Math.max(T, 1), 0, 1.2) : 1;
  r.fuel = Math.max(0, r.fuel - (P * dt / eff) * over);
  r.st.work += P * dt; r.st.t += dt;
  if (inWind && P > 60) r.st.wind += dt;
  r.st.minFuel = Math.min(r.st.minFuel, r.fuel / r.fuelMax);
  r.power = P;
}

/* The pace budget — what can I hold to the line without running dry? */
