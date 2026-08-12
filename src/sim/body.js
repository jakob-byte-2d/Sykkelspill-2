import { CARB_BASE, COOP_PULL_SEC, COOP_SEED, EFF, FUEL_START } from "../content/tuning.js";
import { COLORS, ROSTER } from "../content/riders.js";
import { clamp, gaussOf } from "./rng.js";

/* The body: a power-duration curve and three tanks. Everything a rider can do today
   is read off these — nothing anywhere asks who he is. */

/* ---------------- The rider's body ---------------- */

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

/* One rider, built from one row of the roster and nothing else. Frontal area, threshold,
   the length of turn he can hold, when he must open his sprint and how deep his battery
   is all fall out of his six numbers — so a new profile needs no new code, and no rule
   anywhere can be written for a particular man. */
export function makeRider(spec, i, rng) {
  const { name, mass, h, curve } = spec;
  const dura = spec.dura || 1;
  const T0 = thresholdFrom(curve);
  const r = {
    i, name, color: COLORS[i % COLORS.length], isPlayer: i === 0, mass, h,
    cda: 0.30 * Math.pow(mass / 70, 0.32) * Math.sqrt(h / 1.8),
    curve, T0,
    form: clamp(1 + gaussOf(rng) * 0.045, 0.9, 1.1),
    // his own pull, read off his own curve — not everyone's constant
    pullX: powerAt(curve, COOP_PULL_SEC) / T0,
    // his sprint measured against his own engine: what he gains by arriving together
    sprintX: curve.p5s / T0,
    // the anaerobic battery. A sprinter is a man with a big one and a climber's is
    // small, and reading it off the five-minute power cannot tell those apart — it
    // only knows the engine. So it is given in kilojoules, and derived only if not.
    surgeMax: curve.wp ? curve.wp * 1000 : Math.max((curve.p5 - T0) * 300, 6000), surge: 0,
    fuelMax: 125000 * mass, fuel: 125000 * mass * FUEL_START,
    // ...and the day so far has already worn him — divided by his durability, because
    // a durable man took less damage from those 150 km too, not just from the ones ahead
    dura, wear: clamp(0.42 / dura + gaussOf(rng) * 0.05, 0.25, 0.60), recov: 0.9 + rng() * 0.2,
    dist: 0, prevDist: 0, speed: 11.5, power: 0, ped: rng() * 6,
    shel: 0,
    st: { work: 0, wind: 0, above: 0, minFuel: FUEL_START, t: 0 },
    finished: null, caught: false, rampT: 0, rampFrom: 0, hold: false, paid: COOP_SEED,
    // the turn on the front: the tank he brought to it, how long he has held it,
    // and whether it has been declared over — a flag, so it survives the drop-back
    pullMark: null, pullT: 0, done: false,
  };
  r.surge = usableSurge(r);
  return r;
}

export const makeRiders = (rng, roster = ROSTER) => roster.map((spec, i) => makeRider(spec, i, rng));

// What a man can hold for an effort of this length, tired as he is right now: his own
// curve read at that duration, carrying the same fatigue discount his threshold does.
// Which man it flatters depends entirely on the number: over an hour the 62-kilo climber
// leads the group by fifteen per cent, over seven minutes by a third of one, and under
// five the puncheur is ahead of him. A hill is not one kind of terrain — its LENGTH
// decides whose it is, and that is why the reading has to be taken at the real duration.
export const durPower = (o, t, T) => T * powerAt(o.curve, clamp(t, 30, 3600)) / o.T0;

/* Threshold right now, and the ceiling */
// accumulated wear shrinks the tank you can actually fill — this is where most of the penalty lives
export const usableSurge = (r) => r.surgeMax * (1 - 0.35 * r.wear);

// ...and his threshold with the tank taken out of the question: bodyNow's own reading
// with the two terms that describe running out of fuel set aside. It is not a number he
// can really hold for four hundred kilometres — that is the point. It is a fixed
// reference the deadline can be built on, immune to how the race actually goes.
export const thresholdFull = (r) => r.T0 * r.form * (1 - 0.15 * r.wear);

export function bodyNow(r) {
  const ff = clamp(r.fuel / r.fuelMax, 0, 1);
  const fuelFac = 0.74 + 0.26 * Math.pow(ff, 0.7);
  const collapse = ff < 0.08 ? Math.pow(ff / 0.08, 2) : 1;
  const T = r.T0 * r.form * fuelFac * Math.max(collapse, 0.15) * (1 - 0.15 * r.wear);
  const cap = usableSurge(r);
  const sf = clamp(cap > 0 ? r.surge / cap : 0, 0, 1);
  const fl = T * (0.8 + 0.2 * sf);
  let ceil = (fl + (r.curve.p5s * r.form - fl) * Math.sqrt(sf)) * (1 - 0.07 * r.wear) * Math.max(collapse, 0.25);
  ceil = Math.max(ceil, T * 0.5, 140);
  return { T, ceil, sf, ff };
}

/* Every pedal stroke costs; the three tanks update */
export function spend(r, P, dt, body, inWind) {
  const { T } = body;
  // wear: every kilojoule costs durability, hard ones far more — and it never comes back
  // today. Divided by dura: the one number that says how slowly the day eats a man,
  // which is the quality that separates a classics hardman from everyone else.
  const kJ = P * dt / 1000;
  r.wear += kJ * 3.0e-4 / (r.dura || 1) * Math.pow(Math.max(P, 1) / Math.max(T, 1), 2.2) * (body.sf < 0.15 ? 2.2 : 1);
  if (P > T) {
    r.surge -= (P - T) * dt;
    if (r.surge < 0) { r.wear += (-r.surge) * 2.2e-5 / (r.dura || 1); r.surge = 0; }
    r.st.above += dt;
  } else {
    const below = clamp((T - P) / Math.max(T, 1), 0, 1);
    let tau = (420 / r.recov) * (1 + 1.1 * r.wear) * (1 + 0.5 * (1 - body.ff)) * (1 - 0.35 * below);
    tau = clamp(tau, 290, 800);
    const cap = usableSurge(r);
    if (r.surge < cap) r.surge += (cap - r.surge) * (1 - Math.exp(-dt / tau));
    else r.surge = cap;
  }
  r.wear = clamp(r.wear, 0, 1);
  // The glycogen bill. Below threshold fat pays a real share of it — the easier the
  // riding, the bigger that share, which is the entire economics of sitting in: a wheel
  // does not just cost fewer watts, it costs CHEAPER watts. At threshold and above,
  // carbohydrate pays everything, plus the surcharge for going over. Efficiency is a
  // constant: the depleted body's weakness is already priced once, in bodyNow's
  // threshold — charging it again here counted the same collapse twice.
  const over = P > T ? 1 + 0.18 * clamp((P - T) / Math.max(T, 1), 0, 1.2) : 1;
  const carb = clamp(CARB_BASE + (1 - CARB_BASE) * P / Math.max(T, 1), CARB_BASE, 1);
  r.fuel = Math.max(0, r.fuel - (P * dt / EFF) * over * carb);
  r.st.work += P * dt; r.st.t += dt;
  if (inWind && P > 60) r.st.wind += dt;
  r.st.minFuel = Math.min(r.st.minFuel, r.fuel / r.fuelMax);
  r.power = P;
}

/* The pace budget — what can I hold to the line without running dry? */
