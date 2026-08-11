import React, { useEffect, useRef, useState } from "react";

const COOP_SEED = 90;      // seconds of pulling everyone is credited at the start — they've rotated all day
const COOP_REF = 140;      // watts of gift that count as one second's worth of pull
const COOP_MARGIN = 0.05;  // the pull ends once your share is this many points over fair
const COOP_BLEND = 6;      // over the last metres of the drop-back, watts blend up to the wheel price
const COOP_PULL_SEC = 300; // a rotation pull sits about here on each rider's power–duration curve
const COOP_PULL_SPEND = 0.02; // a turn also ends once it has cost this much of the tank you carried to the front...
const COOP_PULL_MIN = 12;  // ...but no turn is shorter than this — a rotation that swaps every second is no rotation
const COOP_PULL_MAX = 60;  // ...and on the flat none is longer: a wheel is worth a third of
                           // your power there, so real breakaway turns run 30-60 s
const COOP_PULL_MAX_UP = 150; // ...but at five per cent a wheel is worth six, the swap stops
                              // paying for itself, and a real break settles into single file
                              // at its own tempo. Turns lengthen to match — only the
                              // seven-minute solo effort is ruled out.
const COOP_COAST_KMH = 50; // past this speed a pace-setting effort buys nothing...
const COOP_COAST_SPAN = 8; // ...watts tapering to zero over the next this-many km/h
const PULL_MIN_SF = 0.3;   // under this much tank you stop taking turns — drop-backs slot in ahead of you
const WHEEL_COOKED_SF = 0.2; // ...and under this much, his wheel is about to go backwards
const DOOR_NEAR = 10;      // this close ahead of a resting rider, a man dropping back becomes his wheel
const SPRINT_FINALE_M = 1000; // inside this the ledger stops deciding: everyone holds a wheel
const SPRINT_M = 200;      // the fastest man in the group can afford to wait until here...
const SPRINT_LONG = 300;   // ...and the slowest opens from here, to try to blunt him
const SWING_W = 80;        // swinging off, you ease this many watts below holding your own speed in the wind...
const DROP_W = 80;         // ...and drift back at most this many watts below the wheel price
const PEL_FINALE_X = 1.5;  // inside the finale the bunch rides this multiple of the benchmark
                           // threshold — a lead-out train, not a tempo
const PEL_FINALE_M = 1000; // ...and the finale starts this many metres from the line
const PEL_MASS = 68, PEL_CDA = 0.28;   // the bunch modelled as one body: this one
const BRK_MASS = 76, BRK_CDA = 0.30;   // and the break as another: the man on the front
const PACE_MARGIN = 15;    // seconds the break wants to cross the line ahead of the bunch
const WARMUP_S = 60;       // seconds the move is ridden before the clock starts, so the player
                           // is handed a rotation that is already turning rather than five men
                           // dropped abreast on identical speeds
const PEL_LEAD = 0.05;     // the bunch crosses the line this much earlier than the benchmark: one
                           // rider, alone in the wind, holding his threshold the whole way and
                           // never running out of fuel. That ride is the deadline the break races
const PACE_WINDOW = 20;    // seconds behind schedule that count as full alarm
const PACE_GAIN = 0.5;     // at full alarm the front digs this much over the plan's base watts
const DH_GRAD = -0.018;    // steeper than this is a descent — wheels don't die where speed is free
const FUEL_START = 0.44;   // fraction of the tank left at the start — 150 km already in the legs
const CLIMB_GRAD = 0.02;   // from here the road is "up"...
const CLIMB_SMOOTH = 300;  // ...and a shelf shorter than this is a shelf inside the climb, not the top of it
const CLIMB_MIN_T = 60;    // ...and under a minute of climbing there is nothing to pace
const TERRAIN_EDGE = 0.10; // you lift when the pace costs the man it suits least this many points
                           // more of what he could hold to the top than it costs you. Measured
                           // over the climbs of five races: a tenth is the middle of the range,
                           // so the drags nobody would attack on stay quiet and the real ones do not
const TERRAIN_WHEEL = 0.12; // ...and only where a wheel is worth no more than this. On the flat it
                            // saves them a third of the work and the lift just tows them to the line

/* ============================================================
   THE BREAKAWAY — LEGENDS 0.2 — a one-thumb road cycling simulation
   One control: a vertical watt slider. Choose a number, live with it.
   ============================================================ */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const VIEW_M = 40;               // metres of road across the screen
const RIDER_M = 1.58;            // head height of a rider in the saddle, drawn at true scale
const riderK = (pxm) => (RIDER_M / 17.6) * pxm;
const lerp = (a, b, t) => a + (b - a) * t;
const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h > 0 ? h + ":" : "") + String(m).padStart(h > 0 ? 2 : 1, "0") + ":" + String(ss).padStart(2, "0");
};
const fmtGap = (s) => (s < 0 ? "−" : "+") + fmtTime(Math.abs(s));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussOf(r) {
  let u = 0, v = 0;
  while (!u) u = r(); while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.28318 * v);
}

/* ---------------- The road ---------------- */
const STEP = 10; // metres between samples

function buildCourse(rng) {
  const segs = [];
  const add = (len, g, c) => segs.push({ len, g, c });
  add(2800 + rng() * 1400, rng() * 0.6 - 0.3, 0.15 + rng() * 0.1);
  add(2300 + rng() * 1200, rng() * 0.8 - 0.4, 0.3);
  add(1100, 1.4 + rng() * 0.8, 0.25);
  const cl = 2300 + rng() * 1300, cg = 4.0 + rng() * 2.0;
  add(cl, cg, 0.3 + rng() * 0.2);
  add(cl * 0.8, -(cg + 0.6 + rng()), 0.55 + rng() * 0.3);
  add(3200 + rng() * 1600, rng() * 0.8 - 0.4, 0.25);
  add(850 + rng() * 500, 2.6 + rng() * 1.8, 0.3);
  add(800 + rng() * 300, -(2.4 + rng() * 1.4), 0.45 + rng() * 0.2);
  add(2500 + rng() * 1200, rng() * 0.4 - 0.2, 0.18);
  let total = 0; for (const s of segs) total += s.len;
  const n = Math.ceil(total / STEP) + 2;
  const rawG = new Float32Array(n), headg = new Float32Array(n);
  let hd = rng() * 6.283, si = 0, segStart = 0;
  for (let i = 0; i < n; i++) {
    const s = i * STEP;
    while (si < segs.length - 1 && s > segStart + segs[si].len) {
      segStart += segs[si].len; si++; hd += (rng() - 0.5) * 1.4;
    }
    rawG[i] = segs[si].g;
    headg[i] = hd + Math.sin(s / 900) * 0.6 * segs[si].c;
  }
  const ph1 = rng() * 9, ph2 = rng() * 9;
  const grad = new Float32Array(n), ele = new Float32Array(n);
  const W = 30;
  for (let i = 0; i < n; i++) {
    let sum = 0, cn = 0;
    for (let k = -W; k <= W; k++) { const j = clamp(i + k, 0, n - 1); sum += rawG[j]; cn++; }
    const g = sum / cn + 0.45 * Math.sin(i * STEP / 210 + ph1) + 0.3 * Math.sin(i * STEP / 640 + ph2);
    grad[i] = g / 100;
  }
  let alt = 140 + rng() * 380;
  for (let i = 0; i < n; i++) { ele[i] = alt; alt += grad[i] * STEP; }
  const wv = 1.5 + rng() * 4.5, wd = rng() * 6.283;
  const wHead = new Float32Array(n), wCross = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    wHead[i] = wv * Math.cos(wd - headg[i]);
    wCross[i] = Math.abs(wv * Math.sin(wd - headg[i]));
  }
  const at = (arr, d) => {
    const x = clamp(d / STEP, 0, n - 1.001);
    const i = Math.floor(x);
    return lerp(arr[i], arr[i + 1], x - i);
  };
  // How far to the top of the rise you are on — what a rider sees when he looks up the
  // road, and the one thing he needs to know to pick a level he can hold to it. Walked
  // backwards once here, read in a single lookup while racing. A stretch of easy road
  // shorter than CLIMB_SMOOTH is a shelf inside the climb and does not end it; on the
  // flat the answer is where you stand, so there is no climb ahead to pace.
  const flatRun = Math.round(CLIMB_SMOOTH / STEP);
  const top = new Float32Array(n + 1);
  top[n] = total;
  let easy = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (grad[i] >= CLIMB_GRAD) { easy = 0; top[i] = top[i + 1]; }
    else { easy++; top[i] = easy <= flatRun ? top[i + 1] : i * STEP; }
  }
  return {
    total, n, ele, wv,
    gradAt: (d) => at(grad, d),
    eleAt: (d) => at(ele, d),
    windAt: (d) => at(wHead, d),
    climbTopAt: (d) => top[clamp(Math.floor(d / STEP), 0, n)],
  };
}

/* ---------------- The rider's body ---------------- */
const COLORS = ["#f5f2e9", "#ffd23f", "#2ec4b6", "#ff5d73", "#b78bfa", "#4d96ff"];

// the rider's own power–duration curve: regression p = a + b·ln(t) through his
// 1-, 5- and 20-minute points, readable at any duration
function powerAt(c, t) {
  const pts = [[60, c.p1], [300, c.p5], [1200, c.p20]];
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [tt, p] of pts) { const x = Math.log(tt); sx += x; sy += p; sxx += x * x; sxy += x * p; }
  const b = (3 * sxy - sx * sy) / (3 * sxx - sx * sx);
  const a = (sy - b * sx) / 3;
  return a + b * Math.log(t);
}

function thresholdFrom(c) {
  // read at 60 min, held to a sane band around his stated hour power
  return clamp(powerAt(c, 3600), 1.02 * c.p60, 1.07 * c.p60);
}

function makeRiders(rng) {
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

/* ---------------- Physics ---------------- */
const G = 9.81;
const rhoAt = (alt) => 1.2255 * Math.exp(-alt / 8700);

function powerRaw(v, m, cda, grad, rho, hw, shel) {
  const va = v + hw;
  return ((0.004 * m * G + m * G * grad) * v + 0.5 * rho * cda * (1 - shel) * Math.abs(va) * va * v) / 0.975;
}
function powerFor(v, m, cda, grad, rho, hw, shel) {
  return Math.max(0, powerRaw(v, m, cda, grad, rho, hw, shel));
}
function speedFor(P, m, cda, grad, rho, hw, shel, vg) {
  let v = clamp(vg || 9, 1.5, 26);
  const rr = 0.004 * m * G + m * G * grad;
  const k = 0.5 * rho * cda * (1 - shel);
  for (let it = 0; it < 8; it++) {
    const va = v + hw, av = Math.abs(va);
    const F = rr * v + k * av * va * v - P * 0.975;
    let dF = rr + k * av * (va + 2 * v);
    if (!(dF > 8)) dF = 8;
    v -= F / dF;
    v = clamp(v, 0.6, 33);
  }
  return v;
}

const BIKE = 1.7;        // one bicycle length
const ORDER_EPS = BIKE;  // overtakes shorter than this don't reorder the line — near-ties keep last tick's order
const DRAFT = 12;        // beyond this there is no useful wind shadow left
const DRAFT_TAU = 3.5;   // it decays by 1/e every 3.5 m
const SHEL_MAX = 0.4;    // most drag a wheel can take off you

// gap is measured wheel to wheel: from the back of his rear tyre to the front of yours.
// gap = 0 → your front wheel is touching his rear wheel.
// gap < 0 → the wheels overlap; you are moving up alongside him.
function shelterAt(gap) {
  if (gap >= 0) return gap < DRAFT ? SHEL_MAX * Math.exp(-gap / DRAFT_TAU) : 0;
  if (gap > -BIKE) { const f = 1 + gap / BIKE; return SHEL_MAX * f * f; }   // alongside him it goes fast
  return 0;                                              // a full bike length clear
}

// r.dist is the front of a rider's front wheel
const wheelGap = (ahead, r) => (ahead.dist - BIKE) - r.dist;

// the tick steps riders one after another, so mid-tick some have moved and some have
// not — all queue geometry therefore reads the d0 snapshot taken at the top of the tick
const dist0 = (r) => (r.d0 != null ? r.d0 : r.dist);
const wheelGap0 = (ahead, r) => (dist0(ahead) - BIKE) - dist0(r);

// pure geometry: if anyone at all sits between you and your target, you take the
// wheel of the rearmost of them — the one nearest you — and the line forms by itself
// a wheel counts only if it holds your pace: more than 2 km/h slower than you and it
// is no wheel at all — except on a descent, where the deficit costs nothing and a
// freewheeling wheel is free to sit on
const validWheel = (o, r, grad) => o.speed > r.speed - 2 / 3.6 || grad < DH_GRAD;

// the speed test above only fires once the deficit is already there, and a man on an
// empty tank lets go gently — slowly enough to pass it for a long while, and take
// whoever is on his wheel out the back with him. So read the tank, not just the pace:
// look through a wheel that is about to die — unless you are no better off yourself,
// in which case there is nothing better to sit on and you may as well take it
const deadWheel = (o, r) => (o.sf ?? 1) < WHEEL_COOKED_SF && (r.sf ?? 1) > (o.sf ?? 1);

// whoever is actually taking his turn: role decides it for the player, the tank for
// everyone else — and nobody drifting back down the outside counts as a turn-taker
const working = (S, o) => !o.offline && (o.isPlayer ? !S.sitting : (o.sf ?? 1) >= PULL_MIN_SF);

// where he opens up, read off his sprint against the rest of his group. The fastest man
// can afford to wait on a wheel; the slowest has to go long and try to blunt him, which
// is the only card a man without a sprint has left to play.
function launchAt(grp, r) {
  let lo = Infinity, hi = -Infinity;
  for (const o of grp) { if (o.sprintX < lo) lo = o.sprintX; if (o.sprintX > hi) hi = o.sprintX; }
  const t = hi > lo ? (r.sprintX - lo) / (hi - lo) : 1;
  return SPRINT_M + (SPRINT_LONG - SPRINT_M) * (1 - t);
}

// ...and where he wants to be sitting when it starts. The men who have to go long line
// up in front, in the order they will open — but the fastest man takes second wheel
// rather than last. Buried at the back he is displaced by every gap ahead of him when
// the line jumps, and no sprint on earth brings that back in two hundred metres.
function wantPos(grp, r) {
  const order = [...grp].sort((a, o) => launchAt(grp, o) - launchAt(grp, a));
  const fastest = order[order.length - 1];
  if (r === fastest) return Math.min(2, grp.length);
  const k = order.indexOf(r);
  return k + 1 + (k + 1 >= 2 ? 1 : 0);
}

// What a man can hold for an effort of this length, tired as he is right now: his own
// curve read at that duration, carrying the same fatigue discount his threshold does.
// Which man it flatters depends entirely on the number: over an hour the 62-kilo climber
// leads the group by fifteen per cent, over seven minutes by a third of one, and under
// five the puncheur is ahead of him. A hill is not one kind of terrain — its LENGTH
// decides whose it is, and that is why the reading has to be taken at the real duration.
const durPower = (o, t, T) => T * powerAt(o.curve, clamp(t, 30, 3600)) / o.T0;

// Whose road is this? The price of the group's pace as a share of what each man could
// hold all the way to the top — frontal area on the flat, kilograms uphill, and a
// tiring man grows heavy either way. The spread between the cheapest and the dearest
// IS the terrain's verdict, and no rider has to be labelled a climber for it to come
// out right. Reported with what a wheel is worth here, which decides whether a lift
// sheds anybody at all or merely tows the group to the line.
function terrainEdge(S, grp, r, grad, rho, hw, tTop) {
  const v = planSpeedAt(S.plan, r.dist);
  let mine = 1, best = Infinity, worst = 0;
  for (const o of grp) {
    if (o.caught || o.finished != null) continue;
    const c = powerFor(v, o.mass, o.cda, grad, rho, hw, 0) / Math.max(durPower(o, tTop, bodyNow(o).T), 1);
    if (o === r) mine = c;
    best = Math.min(best, c); worst = Math.max(worst, c);
  }
  const open = powerFor(v, r.mass, r.cda, grad, rho, hw, 0);
  const wheel = open > 1 ? 1 - powerFor(v, r.mass, r.cda, grad, rho, hw, SHEL_MAX) / open : 1;
  return { cheapest: mine <= best + 1e-9, spread: worst - best, wheel };
}

function queueWheel(S, r, ahead) {
  if (!ahead) return ahead;
  let best = null;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null || o.offline || deadWheel(o, r)
      || !validWheel(o, r, S.course.gradAt(Math.max(dist0(o), 0)))) continue;
    if (dist0(o) > dist0(r) && (best == null || dist0(o) < dist0(best))) best = o;
  }
  return best || ahead;
}

/* Threshold right now, and the ceiling */
// heavy legs shrink the tank you can actually fill — this is where most of the penalty lives
const usableSurge = (r) => r.surgeMax * (1 - 0.35 * r.legs);

// ...and his threshold with the tank taken out of the question: bodyNow's own reading
// with the two terms that describe running out of fuel set aside. It is not a number he
// can really hold for four hundred kilometres — that is the point. It is a fixed
// reference the deadline can be built on, immune to how the race actually goes.
const thresholdFull = (r) => r.T0 * r.form * (1 - 0.15 * r.legs);

function bodyNow(r) {
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
function spend(r, P, dt, body, inWind) {
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

function pushEvent(S, txt) {
  S.events.unshift({ t: S.t, txt });
  if (S.events.length > 4) S.events.pop();
}

// past COOP_COAST_KMH a pace-setting effort buys nothing — watts taper to zero
// over the next COOP_COAST_SPAN km/h (front pulls, drop-backs, riding alone)
const coast = (P, v) => P * (1 - clamp((v * 3.6 - COOP_COAST_KMH) / COOP_COAST_SPAN, 0, 1));

/* The cooperative ride, shared by every AI in the break: one ledger, equal shares.
   In front you pull just over threshold and swing off once overpaid; in deficit you
   move up to pay — if you can actually ride the pace; otherwise you hold a wheel. */
function coopRide(S, r, b, ahead, bestGap, shel, grad, rho, hw) {
  r.offline = 0;   // out of the line? set below in the two branches where you are
  r.digging = 0;   // ...and riding your own climb rather than the plan's tempo: only in front
  let P, brake = 0;
  const grp = r.groupNo != null ? S.groups[r.groupNo - 1] : null;
  const togo = S.course.total - r.dist;
  // ...and the last thing anyone does is empty the tank. It goes before every other
  // branch, and before coast(), which would otherwise wipe the watts out above 58 km/h
  // — coast describes tempo buying nothing at speed, not a sprint being impossible.
  r.launch = grp && grp.length > 1 ? launchAt(grp, r) : SPRINT_M;
  if (togo < r.launch) { r.sprinting = 1; return { P: b.ceil, brake: 0 }; }
  r.sprinting = 0;
  if (grp && grp.length > 1) {
    const inFront = r.groupPos === 1;
    // inside the finale the ledger stops deciding: nobody owes anybody a turn any more,
    // everyone sits on a wheel and waits for his own moment. The man who ends up in
    // front still rides the plan, so the break does not stall and get swallowed.
    const finale = togo < SPRINT_FINALE_M;
    const sitting = r.isPlayer && S.sitting;  // the player as a rester: never pays, sinks to the back
    // ...and the same idea for anyone: whoever is not working holds the back of the line
    const resting = sitting || (!r.isPlayer && (r.sf ?? 1) < PULL_MIN_SF);
    // the turn was called over in stepSim — by the ledger or by his body, whichever
    // came first. It is a flag and not a sum, so it holds all the way down the
    // drop-back: recomputed, it would flick off the moment his tank started refilling
    // and he would latch back onto the front halfway home.
    // ...and in the finale nobody swings off and nobody rolls through: the rotation is
    // over, and a man who eased now would simply hand the race to the wheel behind him
    const overpaid = !finale && !!r.done;
    // The terrain read, made once and used twice: it decides both how hard he rides
    // when the road is his, and whether he comes to the front to ride it at all. A
    // climber who waited his turn in the rotation would attack about once a race.
    const tTop = Math.max(planTimeAt(S.plan, S.course.climbTopAt(r.dist)) - planTimeAt(S.plan, r.dist), 0);
    // ...and there is nothing to read where there is no climb: the duration is the
    // whole point of the reading, so with no summit ahead the question is not asked
    const e = finale || overpaid || resting || tTop < CLIMB_MIN_T
      ? null : terrainEdge(S, grp, r, grad, rho, hw, tTop);
    const mine = !!e && e.cheapest && e.spread >= TERRAIN_EDGE && e.wheel <= TERRAIN_WHEEL;
    // ...and the level he settles on is what he can hold to the top — which in a body
    // with a finite battery means the battery divided by the seconds still to climb.
    // He crests the summit empty, because that is what riding all the way to the top
    // costs. Never above his own curve for an effort that long either: the curve is the
    // other half of the same statement. There is no free constant left in it, and
    // nothing here knows which rider it is — the curve, the tank, the mass and the
    // frontal area say everything, so a new profile needs no new code.
    const digP = mine ? Math.min(b.T + r.surge / tTop, durPower(r, tTop, b.T), b.ceil) : 0;
    const front = grp[0];
    // "the front is done" is public: his own flag, or the player without the pull
    // button lit — position 2 rolls through on the SAME tick the front eases
    const frontDone = !finale && !inFront && (front.isPlayer && !S.pulling ? true : !!front.done);
    if (r.hold && (shel === 0 || !ahead || (!sitting && !validWheel(ahead, r, S.course.gradAt(Math.max(dist0(ahead), 0)))))) r.hold = false;
    if (inFront) {
      r.hold = false;
      // done paying (or sitting): ease off rather than parachute — hold-your-own-speed
      // watts minus SWING_W, so the line comes past at a gentle, landable differential
      if (overpaid || sitting) r.offline = 1;   // pulled out — the line looks through you now
      if (overpaid || sitting) {
        P = Math.min(Math.max(0.10 * b.T, powerFor(r.speed, r.mass, r.cda, grad, rho, hw, 0) - SWING_W), b.ceil);
      } else {
        // the plan sets the pace, the body caps it: the front rides what the plan's
        // speed costs HIS body right here — softer than a dig while the break is on
        // schedule, and terrain and wind flow into the pull through powerFor. When
        // the deadline is threatened, urgency lifts him toward the dig. Banked time
        // is still insurance: ahead of schedule never slows the plan itself
        const behind = S.t - planTimeAt(S.plan, r.dist);
        const urgency = clamp(behind / PACE_WINDOW, 0, 1);
        const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
          * (1 + PACE_GAIN * urgency);
        P = Math.min(pWant, r.pullX * b.T, b.ceil);
        // ...and where the road is his, the plan's tempo is a wasted chance. pullX is
        // the price of a long turn in the wind and has no say in a dig; the body does
        if (mine) { r.digging = 1; P = Math.max(P, digP); }
      }
      P = coast(P, r.speed);
    } else if ((overpaid || sitting) && r.groupPos < grp.length) {
      r.offline = 1;   // drifting back down the outside — not a wheel anyone should take
      // his pull is done: 10 % of threshold on the way back — blending smoothly up to
      // the wheel price over the last metres, so he lands on the last wheel at its speed
      r.hold = false;
      // wave-in rule: cooked riders sit on the back — the drop-back
      // slots in ahead of them, on the last wheel still working
      let back = grp[grp.length - 1];
      for (let k = grp.length - 1; k >= 1; k--) {
        const o = grp[k];
        if (o === r) continue;
        // a rester must not qualify as a wheel to land on just because resting
        // refilled him, and nor must anyone drifting back down the outside
        if (working(S, o)) { back = o; break; }
      }
      const dback = dist0(r) - (dist0(back) - BIKE);   // land ON his wheel, not on top of him
      let k = clamp(1 - dback / COOP_BLEND, 0, 1);
      k = k * k * (3 - 2 * k);
      const price = powerFor(back.speed, r.mass, r.cda, grad, rho, hw, shel);
      const low = Math.max(0.10 * b.T, price - DROP_W);
      P = Math.min(low + (Math.max(price, low) - low) * k, b.ceil);
      P = coast(P, r.speed);
    } else {
      // a rester keeps the wheel right in front of him: the man dropping back into
      // that space IS his new wheel, not someone to look through. And he is happy to
      // go slower with him — the speed test is the working line's business, not his
      let tgt = ahead ? (sitting ? ahead : queueWheel(S, r, ahead)) : null;
      // in the finale he rides to his slot instead of just holding whatever wheel he
      // has. Sitting too far back, he takes the wheel of the man he wants to be behind
      // and comes up the outside to it — with the autopilot's full authority, because
      // this is the one move in the race that must not be left half-done.
      let movingUp = false;
      if (finale && !sitting) {
        const want = wantPos(grp, r);
        if (r.groupPos > want) { tgt = grp[want - 2] || grp[0]; movingUp = tgt !== r; }
      }
      // ...and once that man is close enough to be slotting in, he IS the wheel: follow
      // him down at his speed and the space opens by itself, for nothing. Holding the
      // line's wheel through the manoeuvre instead means braking to make room and then
      // digging to close what the brake cost — which is no way for a rester to ride.
      if (resting) {
        let dropper = null;
        for (const o of grp) {
          if (o === r || !o.offline || deadWheel(o, r)) continue;
          const behind = dist0(o) - dist0(r);
          if (behind > 0 && behind < DOOR_NEAR && (!dropper || behind < dist0(dropper) - dist0(r))) dropper = o;
        }
        if (dropper) tgt = dropper;
      }
      // a rester may go slower with a man rotating back — that is the whole point of
      // the wave-in — but not with one who is coming off for good
      const usable = tgt && !deadWheel(tgt, r)
        && (sitting || validWheel(tgt, r, S.course.gradAt(Math.max(dist0(tgt), 0))));
      // the line hands over to the first man still in it — not literally position 2,
      // or a rester there would leave the break with no engine at all. A rider on an
      // empty tank is no engine either, so he is passed over too; but if nobody has
      // anything left, the fullest tank takes it anyway. Somebody still has to ride.
      let nextUp = null, fullest = null;
      for (let k = 1; k < grp.length; k++) {
        const o = grp[k];
        if (o.offline || (o.isPlayer && S.sitting)) continue;
        if (!fullest || (o.sf ?? 1) > (fullest.sf ?? 1)) fullest = o;
        if (nextUp == null && (o.sf ?? 1) >= PULL_MIN_SF) nextUp = o;
      }
      nextUp = nextUp || fullest;
      if (mine) {
        // the road is his, so he does not wait for the rotation to offer him the front:
        // he comes past the man riding tempo and rides his own climb. It is the one
        // place in the race where a man goes forward without being owed a turn — and
        // without it a climber would attack about once a race, whenever the rotation
        // happened to hand him the hill.
        r.hold = false;
        r.digging = 1;
        P = digP;
      } else if (r === nextUp && !sitting && (frontDone || !usable)) {
        // the front is done, or the wheel ahead is dying — ride through at the plan's
        // price plus the swing differential: enough to pass the man easing off at
        // −SWING_W, without burning a dig's worth of tank on every handover
        r.hold = false;
        const behind = S.t - planTimeAt(S.plan, r.dist);
        const urgency = clamp(behind / PACE_WINDOW, 0, 1);
        const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
          * (1 + PACE_GAIN * urgency);
        P = Math.min(pWant + SWING_W, r.pullX * b.T, b.ceil);
      } else if (usable && (movingUp || r.hold || ((bestGap >= 0 || sitting) && shel > 0))) {
        const tgap = tgt === ahead ? bestGap : wheelGap0(tgt, r);
        const need = powerFor(tgt.speed, r.mass, r.cda, grad, rho, hw, shel);
        if (!r.hold) { r.hold = true; r.rampFrom = Math.max(r.power, isFinite(need) ? need : 0); r.rampT = 3; }
        // in the finale you match the jump or you lose the wheel — the soft cap that
        // keeps a rester from digging is exactly wrong once the sprint is on
        const out = wheelAutopilot(S, r, b, tgt, tgap, shel, need, grad, rho, hw, !movingUp && !finale);
        P = out.P; brake = out.brake;
      } else {
        r.hold = false;
        P = Math.min(340, b.ceil);
      }
    }
  } else {
    P = Math.min(0.92 * b.T, b.ceil);
    P = coast(P, r.speed);
  }
  return { P, brake };
}

/* The wheel autopilot, shared by the player and any AI that holds a wheel.
   Returns {P, brake}. `need` is the price of matching tgt at your shelter. */
function wheelAutopilot(S, r, b, tgt, tgap, shel, need, grad, rho, hw, soft) {
  const damp = (tgt.speed - r.speed) * 160;   // bleed the raw speed difference — keeps the wheel-holding cycle shallow
  let want;
  if (tgap < 0) {
    // overlapping his wheel: steer on speed here too — aim slightly slower than him
    // so you drop back into the wake, and brake as hard as that requires
    const tv = tgt.speed + Math.max(tgap * 0.5, -1.5);
    const aDes = (tv - r.speed) * 0.6;
    const hold = powerRaw(r.speed, r.mass, r.cda, grad, rho, hw, shel);
    want = hold + ((r.mass + 1.5) * aDes * r.speed) / 0.975 + damp;
    // never chase while alongside him — at most the cost of the wheel itself
    want = Math.min(want, Math.max(powerRaw(tgt.speed, r.mass, r.cda, grad, rho, hw, SHEL_MAX), 0));
  } else {
    // steer on speed, not on his equilibrium wattage: over a summit his power demand
    // collapses while his speed climbs, and a watt-based reference reads that backwards
    const tv = tgt.speed + clamp(tgap * 0.35, -1.5, 1.5);
    const aDes = (tv - r.speed) * 0.5;
    const hold = powerRaw(r.speed, r.mass, r.cda, grad, rho, hw, shel);
    // the further you have slipped, the more it is allowed to spend hauling you back —
    // and once a real gap is open the cap anchors to your body, not to a need that
    // collapses downhill while he pulls away
    let cap = need + Math.min(50 + tgap * 25, 300);
    // matching a faster wheel needs real authority for a moment — granted in proportion
    // to the speed deficit, and gone the instant the speeds meet, so it can never surge
    cap += clamp((tgt.speed - r.speed) * 130, 0, 260);
    if (tgap > 2 && !soft) cap = Math.max(cap, b.T * 1.4);
    want = Math.min(hold + ((r.mass + 1.5) * aDes * r.speed) / 0.975 + damp, cap);
  }
  if (r.rampT > 0) {
    r.rampT -= 1;
    want = clamp(want, r.rampFrom - 40 * (4 - r.rampT), r.rampFrom + 40 * (4 - r.rampT));
  }
  if (want < 0) {
    // two fingers on the levers — going downhill, freewheeling alone is not enough
    return { P: 0, brake: clamp((-want * 0.975) / Math.max(r.speed, 2), 0, 250) };
  }
  return { P: Math.min(want, b.ceil), brake: 0 };
}

/* ---------------- One second of racing, one rider ---------------- */
function stepRider(S, r, dt) {
  const C = S.course;
  r.prevDist = r.dist;
  const d = Math.max(r.dist, 0);
  const grad = C.gradAt(d), rho = rhoAt(C.eleAt(d)), hw = C.windAt(d);
  const b = bodyNow(r);
  r.sf = b.sf;   // published for the drop-back scan; readers see last turn's value

  // shelter: full behind the wheel, then fading — and it bleeds away over one bike
  // length while you move up alongside and past him
  let shel = 0, ahead = null, bestGap = 1e9;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null) continue;
    const gap = ((o.d0 != null ? o.d0 : o.dist) - BIKE) - (r.d0 != null ? r.d0 : r.dist);
    const s = shelterAt(gap);
    if (s > shel) { shel = s; ahead = o; bestGap = gap; }
    else if (gap > 0 && gap < bestGap && shel === 0) { bestGap = gap; ahead = o; }
  }
  r.shel = shel;
  r.overlap = !!ahead && bestGap < 0 && shel > 0;

  // what he asks his legs for
  let P;
  let brake = 0;
  if (r.isPlayer && !S.pulling && !S.sitting) {
    P = Math.min(S.slider, b.ceil);   // manual: your watts, your problem
  } else {
    // one rule for the whole break — the player in relay or sitting on rides it too
    const out = coopRide(S, r, b, ahead, bestGap, shel, grad, rho, hw);
    P = out.P; brake = out.brake;
    if (r.isPlayer) { S.slider = Math.round(P); S.braking = brake; }
  }

  // free body: propulsion against rolling, gravity and drag — speed now has inertia
  const v0 = Math.max(r.speed, 0.8);
  const va = v0 + hw;
  const Fdrive = (P * 0.975) / v0;
  const Froll = 0.004 * r.mass * G;
  const Fgrav = r.mass * G * grad;
  const Fdrag = 0.5 * rho * r.cda * (1 - shel) * Math.abs(va) * va;
  let v = v0 + ((Fdrive - Froll - Fgrav - Fdrag - brake) / (r.mass + 1.5)) * dt;
  v = clamp(v, 0.8, 33);

  r.speed = v;
  r.dist += v * dt;
  spend(r, P, dt, b, shel < 0.10);

}

/* ---------------- The peloton, one organism with memory ---------------- */
/* One second of the bunch — shared verbatim by the live sim and the calibration,
   so the two can never drift apart: steady base watts, lifted by PEL_FINALE_X
   inside the last PEL_FINALE_M metres. Returns the new speed. */
function pelSpeed(course, dist, v, base, finaleP) {
  const d = Math.max(dist, 0);
  const grad = course.gradAt(d), rho = rhoAt(course.eleAt(d)), hw = course.windAt(d);
  // inside the last kilometre it stops riding tempo and rides the sprint: an absolute
  // number off the benchmark threshold, not a multiple of whatever base it was given
  const P = (course.total - dist) < PEL_FINALE_M ? finaleP : base;
  return speedFor(P, PEL_MASS, PEL_CDA, grad, rho, hw, 0, v);
}

function stepPel(S) {
  const p = S.pel, C = S.course;
  p.prevDist = p.dist;
  // the sign measures the bunch against YOU — the rearmost of your group so a line of
  // wheels counts as one — in seconds at the bunch's own pace: how long until they are
  // here if you stop. Frozen once you finish; it describes nothing after that.
  const me = S.riders[0];
  if (me.finished == null && !me.caught) {
    const grp = (me.groupNo != null ? S.groups[me.groupNo - 1] : null) || [me];
    const rear = grp[grp.length - 1];
    p.vAvg = p.vAvg ? p.vAvg + (p.speed - p.vAvg) / 30 : p.speed;
    p.gapS = (rear.dist - p.dist) / Math.max(p.vAvg, 8);
  }
  p.speed = pelSpeed(C, p.dist, p.speed, p.base, p.finaleP);
  p.dist += p.speed;
}

/* ---------------- The whole field, one second ---------------- */
function stepSim(S) {
  S.t += 1;
  const C = S.course;
  const player = S.riders[0];

  for (const r of S.riders) r.d0 = r.dist;   // one consistent snapshot for this second
  for (const r of S.riders) {
    if (r.caught || r.finished != null) continue;
    stepRider(S, r, 1);
  }

  stepPel(S);

  // the bunch swallows whoever it reaches
  for (const r of S.riders) {
    if (r.finished == null && !r.caught && S.pel.dist >= r.dist - 2) {
      r.caught = true;
      pushEvent(S, (r.isPlayer ? "You are" : r.name + " is") + " caught by the peloton");
    }
  }

  // the line
  for (const r of S.riders) {
    if (r.finished == null && !r.caught && r.dist >= C.total) {
      r.finished = S.t - (r.dist - C.total) / Math.max(r.speed, 1);
    }
  }

  tagGroups(S);
  // pay the front for the gift, not the clock: what he spends over what the same
  // second would have cost him sitting in. No terrain rule — the physics decides,
  // and gravity is a co-payer: the gift is weighted by the legs' share of the
  // propulsion, so a descent pays only for what the legs actually drive
  for (const g of S.groups) {
    if (g.length < 2) continue;
    const r = g[0];
    const d = Math.max(r.dist, 0);
    const sit = powerFor(r.speed, r.mass, r.cda, S.course.gradAt(d), rhoAt(S.course.eleAt(d)), S.course.windAt(d), SHEL_MAX);
    const pGrav = Math.max(-r.mass * G * S.course.gradAt(d), 0) * r.speed;
    const legs = r.power / Math.max(r.power + pGrav, 1);
    r.paid += legs * Math.max(r.power - sit, 0) / COOP_REF;

    // ...and then ask whether the turn is over. Two reasons end it, and the first
    // one to arrive wins: the ledger says he has done his share, or his body says
    // enough. The second is the one a rider actually feels — a turn on the front
    // sits above threshold and drains the tank, and he swings off while he can
    // still get it back in the wheels. Decided once here, so every reader agrees.
    if (r.pullMark == null) { r.pullMark = r.surge; r.pullT = 0; }
    r.pullT += 1;
    const b = bodyNow(r);
    const tot = g.reduce((s, o) => s + o.paid, 0);
    const paidUp = tot > 0 && r.paid / tot > 1 / g.length + COOP_MARGIN;
    // a small slice, because the front only sits a few points over threshold: measured
    // in play the pull runs at a median 1.03 × T, so 2 % of the tank is about forty
    // seconds of tempo — and far fewer where the road tips up and the gap widens
    const spent = r.surge < r.pullMark - COOP_PULL_SPEND * usableSurge(r);
    // an empty tank only ends the turn if someone fresher can take it on — and a
    // rester refilling at the back is no relief at all. When the whole break is
    // equally cooked, somebody still has to ride
    const empty = b.sf < PULL_MIN_SF && g.some((o) => o !== r && working(S, o) && (o.sf ?? 1) > b.sf);
    // ...and a clock, because uphill none of the three above can fire. The gift shrinks
    // to a fifth, a man under his threshold drains no tank, and a full one is not empty
    // — so the strongest climber would simply stay there for the whole climb. The clock
    // is set by what a wheel is actually worth here, which is the gift's own share of
    // his power: a third on the flat, six per cent at five, nothing on a wall.
    const worth = clamp((r.power - sit) / Math.max(r.power, 1), 0, 1);
    const k = clamp((worth - 0.05) / 0.25, 0, 1);
    const maxPull = COOP_PULL_MAX_UP + (COOP_PULL_MAX - COOP_PULL_MAX_UP) * k;
    // ...and a man riding his own climb is not taking a turn at all. The ledger would
    // end it in twelve seconds — over threshold, two per cent of the tank goes in eight
    // — and there is no such thing as an eight-second attack. Nor does a clock apply:
    // his climb ends when the hill does, and the hill decides that, not the rotation.
    // The tank can still end it early, and over the top the ledger takes over again —
    // hopelessly overpaid by then, so he sits up at the summit like anyone would.
    const over = r.digging ? empty : (paidUp || spent || empty || r.pullT >= maxPull);
    if (r.pullT >= COOP_PULL_MIN && over) r.done = true;
  }
  // the turn's bookkeeping: it opens when he reaches the front and closes for good
  // once he has drifted to the back — tagGroups ran above, so the positions are this
  // second's. Anyone not on the front is between turns and carries no mark.
  for (const r of S.riders) {
    if (r.groupPos !== 1) { r.pullMark = null; r.pullT = 0; }
    // the turn is over once nobody still working sits behind him. NOT "last in the
    // group": a rider sitting on parks at the very rear for good, so that test would
    // never come true again for anyone else and the flag would stick all race —
    // leaving every AI permanently offline and the rotation with no engine at all
    if (r.done && r.groupNo != null) {
      const g = S.groups[r.groupNo - 1];
      if (!g || g.length < 2 || !g.some((o) => o !== r && o.groupPos > r.groupPos && working(S, o))) r.done = false;
    }
  }
}

function finalize(S) {
  let guard = 0;
  while (guard++ < 600 && S.riders.some((r) => r.finished == null && !r.caught)) stepSim(S);
  S.ended = true;
  const p = S.riders[0];
  const before = S.riders.filter((r) => !r.isPlayer && r.finished != null && r.finished < p.finished).length;
  S.result = { caught: false, place: before + 1 };
}

/* ---------------- The pace plan: what the break has to do to stay away ----------- */
/* The bunch is deterministic, so the hour it crosses the line is known from the gun.
   That makes the requirement a deadline, not a speed. These four mirror the peloton's
   own machinery: one step, one run to the line, a bisection, and a stored schedule. */
function breakSpeed(course, dist, v, base) {
  const d = Math.max(dist, 0);
  return speedFor(base, BRK_MASS, BRK_CDA, course.gradAt(d), rhoAt(course.eleAt(d)), course.windAt(d), 0, v);
}

function breakTime(course, base, v0 = 11.5) {
  let dist = 0, v = v0, t = 0;
  while (dist < course.total && t < 12000) {
    t++;
    v = breakSpeed(course, dist, v, base);
    dist += v;
  }
  return t - (dist - course.total) / Math.max(v, 1);
}

function calibrateBreak(course, targetT, v0) {
  let lo = 200, hi = 520;
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (breakTime(course, mid, v0) > targetT) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* One more run at the solved effort, keeping the clock every 100 m: distance → time.
   Reading it later is an array lookup, so the controller costs nothing per tick. */
function breakSchedule(course, targetT, v0 = 11.5) {
  const base = calibrateBreak(course, targetT, v0);
  const STEP = 100;
  const n = Math.ceil(course.total / STEP);
  const at = new Float32Array(n + 1);
  const vAt = new Float32Array(n + 1);
  let dist = 0, v = v0, t = 0, next = 1;
  vAt[0] = v;
  while (dist < course.total && t < 12000) {
    t++;
    const prev = dist;
    v = breakSpeed(course, dist, v, base);
    dist += v;
    while (next <= n && next * STEP <= dist) {
      // straight-line interpolation inside the second we just rode
      at[next] = t - 1 + (next * STEP - prev) / Math.max(dist - prev, 0.01);
      vAt[next] = v;
      next++;
    }
  }
  for (; next <= n; next++) { at[next] = t; vAt[next] = v; }
  return { base, step: STEP, at, vAt };
}

// the schedule read at any point on the road — one lerp between the 100 m marks
function planTimeAt(plan, dist) {
  const x = clamp(dist, 0, (plan.at.length - 1) * plan.step) / plan.step;
  const i = Math.floor(x);
  const a = plan.at[i], b = plan.at[Math.min(i + 1, plan.at.length - 1)];
  return a + (b - a) * (x - i);
}

// ...and the speed it holds there, same lerp on the recorded speeds
function planSpeedAt(plan, dist) {
  const x = clamp(dist, 0, (plan.vAt.length - 1) * plan.step) / plan.step;
  const i = Math.floor(x);
  const a = plan.vAt[i], b = plan.vAt[Math.min(i + 1, plan.vAt.length - 1)];
  return a + (b - a) * (x - i);
}

/* ---------------- New race ---------------- */
/* Ride the course alone, fresh body, steady threshold pacing, tuck downhill,
   empty the tank in the last 400 m — the player's honest benchmark.
   With `steady` it becomes the other kind of reference: his threshold with the fuel
   question set aside, held flat from kilometre nought to the line and never sprinted.
   Nothing is spent, so nothing decays — it is a ruler, not a ride. */
function soloBenchmark(course, rider, shel = 0, steady = false) {
  const r = { ...rider, st: { ...rider.st }, dist: 0, prevDist: 0, speed: 11.5, power: 0 };
  const flat = thresholdFull(r);
  let t = 0;
  while (r.dist < course.total && t < 9000) {
    t++;
    const b = bodyNow(r);
    let P = steady ? flat : Math.min(b.T * 0.99, b.ceil);
    if (!steady && course.total - r.dist < 400) P = b.ceil;
    const d = Math.max(r.dist, 0);
    const grad = course.gradAt(d), rho = rhoAt(course.eleAt(d)), hw = course.windAt(d);
    const descending = grad < DH_GRAD;
    if (descending) P = coast(P, r.speed);
    const v0 = Math.max(r.speed, 0.8);
    const va = v0 + hw;
    const F = (P * 0.975) / v0 - 0.004 * r.mass * G - r.mass * G * grad - 0.5 * rho * r.cda * (1 - shel) * Math.abs(va) * va;
    r.speed = clamp(v0 + F / (r.mass + 1.5), 0.8, 33);
    r.dist += r.speed;
    if (!steady) spend(r, P, 1, b, true);
  }
  return t - (r.dist - course.total) / Math.max(r.speed, 1);
}

/* The bunch must cross the line exactly one second after that benchmark.
   It rides the same pelSpeed step as the live bunch — solve for the base. */
function pelSimTime(course, startGap, base, finaleP) {
  let dist = -startGap, v = 11.8, t = 0;
  while (dist < course.total && t < 12000) {
    t++;
    v = pelSpeed(course, dist, v, base, finaleP);
    dist += v;
  }
  return t - (dist - course.total) / Math.max(v, 1);
}

function calibratePel(course, startGap, targetT, finaleP) {
  // wide enough that the search never sits on its own ceiling: clamped, the bunch would
  // quietly ride slower than the deadline asks for and the knob would stop meaning anything
  let lo = 150, hi = 900;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (pelSimTime(course, startGap, mid, finaleP) > targetT) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function newSim(seed) {
  const rng = mulberry32(seed);
  const course = buildCourse(rng);
  const riders = makeRiders(rng);
  // the player starts at the back of the line, the AIs rotate ahead of him — and the
  // ledger slopes with the line: the front man owes the most, the back has paid
  const order = [...riders.slice(1), riders[0]];
  order.forEach((r, k) => {
    r.dist = -k * 2.2; r.prevDist = r.dist;
    r.paid = COOP_SEED * (0.7 + (0.6 * k) / Math.max(order.length - 1, 1));
  });
  const startGap = (65 + rng() * 40) * 11.5;
  // The deadline is one fixed ride: the player, alone in the wind, holding his threshold
  // from the gun with the fuel question set aside — and the bunch beats it by PEL_LEAD.
  // One reference instead of three, and it does not move with who else is in the break.
  const benchT = soloBenchmark(course, riders[0], 0, true);
  const targetT = benchT * (1 - PEL_LEAD);
  // ...and in the last kilometre the bunch rides a lead-out off that same threshold
  const finaleP = PEL_FINALE_X * thresholdFull(riders[0]);
  const pelBase = calibratePel(course, startGap, targetT + 1, finaleP);
  // The schedule is built twice: once from a standing start to learn the pace it settles
  // at, then again from that speed. A race that begins mid-stage has no standing start,
  // and a plan that spends its first kilometre accelerating out of one would ask the
  // break to slow down on the opening straight.
  const cold = breakSchedule(course, targetT + 1 - PACE_MARGIN);
  const v0 = planSpeedAt(cold, 1000);
  const plan = breakSchedule(course, targetT + 1 - PACE_MARGIN, v0);
  const T0 = bodyNow(riders[0]).T;
  const S = {
    seed, course, riders,
    pel: { dist: -startGap, prevDist: -startGap, speed: 11.8, base: pelBase, finaleP, soloT: targetT, gapS: startGap / 11.8 },
    benchT,
    plan,            // distance → time the break must hit to stay clear; nothing reads it yet
    groups: [],
    t: 0, clock0: 3 * 3600 + 48 * 60,
    slider: Math.round(T0 * 0.92),
    sitting: false, braking: 0, pulling: true,
    ended: false, result: null, events: [],
    profile: null,   // drawProfile's cached elevation sample
    uiAt: 0,
  };
  tagGroups(S);   // the start line is a group from the gun — tags and S.groups live before the first tick

  // ...and then the move is ridden for a minute before the clock is allowed to start.
  // Dropped in cold, five men on identical speeds and even spacing are not a breakaway
  // yet: the wheels close from two metres to one and a half, the first man to be
  // overpaid swings off, and the watts swing by two hundred while the rotation finds
  // its feet. None of that is the race, so it happens before the race. A minute is a
  // full turn on the front and then some, so the line is handed over to the player
  // mid-rotation, at speed, with the ledger already carrying real debts.
  for (let k = 0; k < WARMUP_S; k++) stepSim(S);
  // Wind it back to the start line, keeping every gap, speed and flag exactly as the
  // warm-up left them. The bunch goes back to its cold opening instead, because that is
  // the ride calibratePel solved for and the deadline has to stay the one it computed.
  const lead = Math.max(...riders.map((r) => r.dist));
  for (const r of riders) {
    r.dist -= lead; r.prevDist = r.dist; r.d0 = r.dist;
    r.st = { work: 0, wind: 0, above: 0, minFuel: r.fuel / r.fuelMax, t: 0 };
  }
  S.pel.dist = -startGap; S.pel.prevDist = -startGap;
  S.pel.speed = 11.8; S.pel.vAvg = 0; S.pel.gapS = startGap / 11.8;
  S.t = 0; S.events = [];
  S.slider = Math.round(bodyNow(riders[0]).T * 0.92);
  tagGroups(S);
  return S;
}

/* ---------------- Drawing ---------------- */

/* Telemetry, off unless asked for: ?debug=1 in the address, or the D key. A player
   should never trip over it, so the bubble stays compact until it is switched on. */
let DEBUG = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("debug") === "1";

// the canvas reads DEBUG afresh every frame, so flipping it here is all the bubbles
// need. The sim fixture goes up and down with it, so an automated check can always
// read the truth behind whatever the bubbles are claiming.
function setDebug(on, S) {
  DEBUG = on;
  if (typeof window === "undefined") return;
  if (on) { if (S) window.__S = S; } else delete window.__S;
}

// a tank reads at a glance by its colour — you should see who is empty without
// having to read the number, which is what makes five bubbles at once survivable
const tankHue = (f) => (f > 0.55 ? "#5fe07a" : f > 0.28 ? "#ffd23f" : "#ff6b5d");

// a rounded chip on a stalk, in the rider's own colour — the same object the race
// map already uses for its group flags, borrowed here for the heads
function drawBubble(ctx, x, top, w, h, color, tipX, tipY) {
  // the stalk leans back to the man it belongs to — once the bubbles are nudged
  // apart, it is the only thing that says whose is whose
  ctx.strokeStyle = "rgba(19,58,107,0.65)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, top + h); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.fillStyle = "rgba(12,26,44,0.82)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, top, w, h, 5); else ctx.rect(x - w / 2, top, w, h);
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
}

// what he is doing right now, in one word the bubble has room for
function roleOf(S, r) {
  if (r.groupSize <= 1) return "solo";
  if (r.isPlayer && S.sitting) return "sit";
  if (r.groupPos === 1 && !r.offline) return "FRONT";
  if (r.offline) return "drop";
  return "wheel";
}

function drawCyclist(ctx, x, y, k, color, ped, mode, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  const wr = 4.4 * k;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#23262b";
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath(); ctx.arc(-5.2 * k, 0, wr, 0, 6.284); ctx.stroke();
  ctx.beginPath(); ctx.arc(5.2 * k, 0, wr, 0, 6.284); ctx.stroke();
  // frame
  ctx.strokeStyle = "#3a3f46";
  ctx.beginPath();
  ctx.moveTo(-5.2 * k, 0); ctx.lineTo(-0.6 * k, -3.4 * k); ctx.lineTo(0.4 * k, -0.4 * k);
  ctx.lineTo(5.2 * k, 0); ctx.lineTo(3.9 * k, -4.2 * k); ctx.lineTo(-0.6 * k, -3.4 * k);
  ctx.stroke();
  let hip, sho, head;
  if (mode === "stand") { hip = [-0.6, -8.6]; sho = [3.0, -11.6]; head = [4.1, -13.2]; }
  else { hip = [-2.0, -6.6]; sho = [3.3, -9.0]; head = [4.5, -10.6]; }
  const bb = [0.4, -0.4];
  const pr = 1.9 * k;
  for (const ph of [ped, ped + Math.PI]) {
    const px = bb[0] * k + Math.cos(ph) * pr, py = bb[1] * k + Math.sin(ph) * pr;
    ctx.strokeStyle = "#1c1f24";
    ctx.lineWidth = 1.7 * k;
    ctx.beginPath();
    ctx.moveTo(hip[0] * k, hip[1] * k);
    const kx = (hip[0] * k + px) / 2 + 1.6 * k, ky = (hip[1] * k + py) / 2;
    ctx.lineTo(kx, ky); ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.3 * k;
  ctx.beginPath(); ctx.moveTo(hip[0] * k, hip[1] * k); ctx.lineTo(sho[0] * k, sho[1] * k); ctx.stroke();
  ctx.strokeStyle = "#e8c9a0";
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath(); ctx.moveTo(sho[0] * k, sho[1] * k); ctx.lineTo(5.0 * k, -4.6 * k); ctx.stroke();
  ctx.fillStyle = "#e8c9a0";
  ctx.beginPath(); ctx.arc(head[0] * k, head[1] * k, 1.5 * k, 0, 6.284); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(head[0] * k, head[1] * k + 0.1, 1.5 * k, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.restore();
}

function draw(S, canvas, alpha) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const C = S.course;
  const p = S.riders[0];
  let focus = p;
  if (p.finished != null || p.caught) {
    focus = S.riders.find((r) => r.finished == null && !r.caught) || p;
  }
  const cx = lerp(focus.prevDist, focus.dist, alpha);
  const pxm = w / VIEW_M;          // pixels per metre
  const sv = pxm;                  // height at true 1:1 — a 6 % ramp looks like 6 %
  const eleC = C.eleAt(cx);
  const baseY = h * 0.56;
  const floorY = h - 46 - 16;      // the road never disappears under the road book
  const yOf = (d) => Math.min(baseY - (C.eleAt(d) - eleC) * sv, floorY);
  const xOf = (d) => (d - cx) * pxm + w * 0.42;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#5f9fd6"); sky.addColorStop(0.55, "#a9cfec"); sky.addColorStop(1, "#ddeef8");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,250,220,0.85)";
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 26, 0, 6.284); ctx.fill();

  // far hills (parallax from the course itself)
  ctx.fillStyle = "#8fb3d4";
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 12) {
    const d = cx * 0.35 + x / pxm * 3 + 4000;
    ctx.lineTo(x, baseY - 40 - (C.eleAt(Math.abs(d) % C.total) - 300) * 0.35);
  }
  ctx.lineTo(w, h); ctx.fill();

  // ground + road
  ctx.beginPath(); ctx.moveTo(0, h);
  const pts = [];
  for (let x = -8; x <= w + 8; x += 6) {
    const d = cx + (x - w * 0.42) / pxm;
    const y = yOf(d);
    pts.push([x, y]);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 8, h);
  ctx.fillStyle = "#77b24e"; ctx.fill();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = "#9aa0a8"; ctx.lineWidth = Math.max(4, 0.9 * pxm); ctx.stroke();
  ctx.setLineDash([9, 10]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1, 0.12 * pxm); ctx.stroke();
  ctx.setLineDash([]);

  drawScenery(S, ctx, w, xOf, yOf, cx, pxm);

  // roadside furniture: km banners, flamme rouge, finish arch
  const marks = [];
  for (let km = 5; km < C.total / 1000; km += 5) marks.push([C.total - km * 1000, km + " KM"]);
  for (const [d, label] of marks) {
    const x = xOf(d);
    if (x < -40 || x > w + 40) continue;
    const y = yOf(d);
    ctx.fillStyle = "#20242a";
    const M = pxm;
    ctx.fillRect(x - 0.06 * M, y - 3 * M, 0.12 * M, 2.6 * M);
    ctx.fillStyle = "#f7f4ea";
    ctx.fillRect(x - 1.1 * M, y - 4 * M, 2.2 * M, 1 * M);
    ctx.fillStyle = "#20242a";
    ctx.font = "700 " + Math.max(7, Math.round(0.62 * M)) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - 3.25 * M);
  }
  const fr = xOf(C.total - 1000);
  if (fr > -30 && fr < w + 30) {
    const y = yOf(C.total - 1000);
    const M = pxm;
    ctx.fillStyle = "#c8102e";
    ctx.beginPath(); ctx.moveTo(fr, y - 4.2 * M); ctx.lineTo(fr + 1.8 * M, y - 3.6 * M); ctx.lineTo(fr, y - 3.1 * M); ctx.fill();
    ctx.fillStyle = "#20242a"; ctx.fillRect(fr - 0.06 * M, y - 4.2 * M, 0.12 * M, 3.8 * M);
  }
  const fx = xOf(C.total);
  if (fx > -60 && fx < w + 60) {
    const y = yOf(C.total);
    const M = pxm;
    ctx.fillStyle = "#20242a";
    ctx.fillRect(fx - 2.6 * M, y - 5.5 * M, 0.35 * M, 5.2 * M);
    ctx.fillRect(fx + 2.25 * M, y - 5.5 * M, 0.35 * M, 5.2 * M);
    ctx.fillStyle = "#e8443a";
    ctx.fillRect(fx - 2.6 * M, y - 5.5 * M, 5.2 * M, 1.3 * M);
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.max(8, Math.round(0.8 * M)) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("FINISH", fx, y - 4.55 * M);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 6; i++) ctx.fillRect(fx - 2.4 * M + i * 0.8 * M, y - 0.4 * M + (i % 2) * 0.4 * M, 0.8 * M, 0.4 * M);
  }

  // the peloton — a dark organism
  const pd = lerp(S.pel.prevDist, S.pel.dist, alpha);
  if (xOf(pd) > -160) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const d = pd - row * 3 - col * 2.6 - (row % 2) * 1.2;
        const x = xOf(d);
        if (x < -20 || x > w + 20) continue;
        drawCyclist(ctx, x, yOf(d) - 3, riderK(pxm), row === 0 && col === 0 ? "#ffcf3f" : "#2f3a4a", (S.t + row * 2 + col) * 0.9, "ride", -Math.atan(C.gradAt(d) * 1.6));
      }
    }
  }

  // the riders — each carries his share of the pulling over his head
  const shareGrps = S.groups;
  const shareOf = (r) => {
    const grp = shareGrps.find((g) => g.includes(r));
    if (!grp || grp.length < 2) return null;
    const tot = grp.reduce((s, o) => s + o.paid, 0);
    return tot > 0 ? Math.round((100 * r.paid) / tot) : null;
  };
  const sorted = [...S.riders].sort((a, b) => a.dist - b.dist);
  const bubbles = [];
  for (const r of sorted) {
    if (r.caught) continue;
    const d = lerp(r.prevDist, r.dist, alpha);
    const x = xOf(d);
    if (x < -30 || x > w + 30) continue;
    const y = yOf(d) - 3;
    const g = C.gradAt(d);
    const b = bodyNow(r);
    const mode = r.power > 1.22 * b.T && g > 0.015 ? "stand" : "ride";
    r.ped = (r.ped || 0) + r.speed * 0.045;
    drawCyclist(ctx, x, y, riderK(pxm), r.color, r.ped, mode, -Math.atan(g * 1.6));
    // the arrow sits between his head and his bubble — still "this one is you"
    if (r.isPlayer) {
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 4, y - 27); ctx.lineTo(x + 4, y - 27); ctx.fill();
    }
    // the wheel he is on, for the gap readout — nearest man up the road
    let gap = null;
    for (const o of S.riders) {
      if (o === r || o.caught || o.finished != null || o.dist <= r.dist) continue;
      const wg = (o.dist - BIKE) - r.dist;
      if (gap == null || wg < gap) gap = wg;
    }
    bubbles.push({ r, b, x, tipY: y - 29, gap, share: shareOf(r), row: (r.groupPos || 1) % 2 });
  }

  // ...and the bubbles last, so no rider is ever drawn over one. Two staggered rows,
  // then a nudge pass per row — the same chips-on-stalks trick the race map uses,
  // because five riders wheel to wheel are closer together than their labels are wide
  {
    const BW = DEBUG ? 59 : 48, BH = DEBUG ? 72 : 50, GAPX = 3;
    for (const row of [0, 1]) {
      const mine = bubbles.filter((m) => m.row === row).sort((a, m) => m.x - a.x);
      mine.forEach((m) => { m.bx = m.x; });
      for (let i = 1; i < mine.length; i++) {
        if (mine[i - 1].bx - mine[i].bx < BW + GAPX) mine[i].bx = mine[i - 1].bx - (BW + GAPX);
      }
    }
    ctx.textAlign = "center";
    for (const m of bubbles) {
      const top = m.tipY - 8 - BH - (m.row ? BH + 4 : 0);
      drawBubble(ctx, m.bx, top, BW, BH, m.r.color, m.x, m.tipY);
      const { r, b } = m;
      // his name, in his own colour — the same signal as the bubble's border and the
      // stalk, so a glance ties the numbers to the man without following the line down
      ctx.font = "800 8px ui-monospace, monospace";
      ctx.fillStyle = r.color;
      ctx.fillText(r.name.split(".").pop().slice(0, 8), m.bx, top + 10);
      if (!DEBUG) {
        ctx.font = "800 10px ui-monospace, monospace";
        ctx.fillStyle = "#f2f6fa";
        ctx.fillText(Math.round(r.power) + " W", m.bx, top + 24);
        ctx.fillStyle = tankHue(b.sf);
        ctx.fillText("S" + Math.round(b.sf * 100) + "%", m.bx, top + 36);
        ctx.font = "800 9px ui-monospace, monospace";
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(m.share == null ? "—" : "D" + m.share + "%", m.bx, top + 47);
      } else {
        ctx.font = "800 9px ui-monospace, monospace";
        const L = m.bx - BW / 2 + 16, R = m.bx + BW / 2 - 15;
        ctx.fillStyle = "#f2f6fa";
        ctx.fillText(Math.round(r.power) + "W", L, top + 23);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(Math.round(b.T) + "T", L, top + 34);
        ctx.fillStyle = "#ffd23f";
        ctx.fillText(roleOf(S, r), L, top + 45);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        // wheels overlap by centimetres in a tight line, and "-0.0" is just noise
        ctx.fillText(m.gap == null ? "—" : (Math.abs(m.gap) < 0.05 ? 0 : m.gap).toFixed(1), L, top + 56);
        ctx.fillStyle = tankHue(b.sf);
        ctx.fillText("S" + Math.round(b.sf * 100), R, top + 23);
        ctx.fillStyle = tankHue(b.ff);
        ctx.fillText("F" + Math.round(b.ff * 100), R, top + 34);
        // legs reads as what is LEFT, the same way the instrument panel shows it —
        // so the number agrees with its own colour, and with the bar below
        ctx.fillStyle = tankHue(1 - r.legs);
        ctx.fillText("L" + Math.round((1 - r.legs) * 100), R, top + 45);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText("LY" + Math.round((r.shel / SHEL_MAX) * 100), R, top + 56);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(m.share == null ? "—" : "D" + m.share + "%", m.bx, top + 67);
      }
    }
  }

  // wind sock — top right corner, clear of the chyron
  const hw = C.windAt(cx);
  const wtxt = (hw > 0.4 ? "HEAD" : hw < -0.4 ? "TAIL" : "CROSS") + " " + Math.abs(C.wv).toFixed(1);
  ctx.font = "800 10px ui-monospace, monospace";
  const cw = ctx.measureText(wtxt).width + 62, chh = 20;
  const cxr = w - 88 - cw, cyr = 88;
  const grad = ctx.createLinearGradient(0, cyr, 0, cyr + chh);
  grad.addColorStop(0, "#f4f8fc"); grad.addColorStop(0.55, "#ccd9e6"); grad.addColorStop(1, "#b3c6d8");
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(cxr, cyr, cw, chh, 10); } else { ctx.rect(cxr, cyr, cw, chh); }
  ctx.fill();
  ctx.strokeStyle = "#6f8cab"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#0d3568";
  ctx.textAlign = "left";
  ctx.fillText("WIND", cxr + 9, cyr + 14);
  drawWindsock(ctx, cxr + 44, cyr + 16, hw, C.wv, S.t);
  ctx.textAlign = "right";
  ctx.fillStyle = hw > 0.4 ? "#c22a1e" : hw < -0.4 ? "#1d7a34" : "#123a6b";
  ctx.font = "800 10px ui-monospace, monospace";
  ctx.fillText(wtxt, cxr + cw - 9, cyr + 14);

  drawProfile(S, ctx, w, h, cx);
}

/* ---------------- Time gaps, measured from you ---------------- */
function raceGroups(S) {
  const live = S.riders.filter((r) => !r.caught && r.finished == null).sort((a, b) => b.dist - a.dist);
  // a compact line jitters on centimetre overlaps: an overtake must exceed
  // ORDER_EPS to register, otherwise last tick's order stands — so the rotation,
  // the ledger and the drawing all see one stable file
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = 0; i + 1 < live.length; i++) {
      const a = live[i], bb = live[i + 1];
      if (a.dist - bb.dist < ORDER_EPS && a.rank != null && bb.rank != null && bb.rank < a.rank) {
        live[i] = bb; live[i + 1] = a; swapped = true;
      }
    }
  }
  live.forEach((r, i) => { r.rank = i; });
  const out = [];
  for (const r of live) {
    const last = out[out.length - 1];
    if (last && wheelGap(last[last.length - 1], r) <= DRAFT) last.push(r);
    else out.push([r]);
  }
  return out;
}

// the one grouping pass per tick: S.groups is the cache everyone reads — the AI during
// the next tick (frozen, so it agrees with the d0 snapshot) and the UI between ticks
function tagGroups(S) {
  S.groups = raceGroups(S);
  S.groups.forEach((grp, gi) => {
    grp.forEach((r, k) => {
      r.groupNo = gi + 1;      // 1 = the front group on the road
      r.groupPos = k + 1;      // 1 = the front of that group
      r.groupSize = grp.length;
    });
  });
  for (const r of S.riders) if (r.caught || r.finished != null) { r.groupNo = null; r.groupPos = null; r.groupSize = null; }
}

function gapRows(S) {
  const me = S.riders[0];
  const rows = [];
  // one reference speed for every row: the bunch's smoothed pace — the same clock the
  // peloton strip below runs on, so board and strip can never disagree
  const vRef = Math.max(S.pel.vAvg || S.pel.speed, 8);
  const grps = S.groups;
  grps.forEach((grp, gi) => {
    const mine = grp.includes(me);
    const names = grp.map((r) => r.name.split(".").pop().slice(0, 8));
    let label = mine
      ? (grp.length > 1 ? "YOU +" + (grp.length - 1) : "YOU")
      : (grp.length > 2 ? names[0] + " +" + (grp.length - 1) : names.join(" "));
    if (grps.length > 1) label = "G" + (gi + 1) + " · " + label;
    rows.push({ key: "g" + grp[0].i, label, gapS: -(grp[0].dist - me.dist) / vRef, me: mine });
  });
  rows.push({ key: "pel", label: "PELOTON", gapS: S.pel.gapS });
  rows.sort((a, b) => a.gapS - b.gapS);
  return rows;
}

/* ---------------- The road book: whole profile, bottom strip ---------------- */
function drawProfile(S, ctx, w, h, cx) {
  const C = S.course;
  const PH = 46;                       // strip height
  const top = h - PH, pad = 8;
  const iw = w - pad * 2, ih = PH - 16;

  // chrome frame
  const fr = ctx.createLinearGradient(0, top, 0, h);
  fr.addColorStop(0, "#dbe6f2"); fr.addColorStop(1, "#a9bed3");
  ctx.fillStyle = fr; ctx.fillRect(0, top, w, PH);
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(0, top, w, 1);
  ctx.fillStyle = "#6f8cab"; ctx.fillRect(0, top - 2, w, 2);

  // elevation range across the whole course — the course never changes, so sample once
  const N = 140;
  if (!S.profile) {
    let lo = 1e9, hi = -1e9;
    const xs = [];
    for (let i = 0; i <= N; i++) {
      const e = C.eleAt((i / N) * C.total);
      xs.push(e); if (e < lo) lo = e; if (e > hi) hi = e;
    }
    S.profile = { xs, lo, hi };
  }
  const { xs, lo, hi } = S.profile;
  const span = Math.max(hi - lo, 30);
  const px = (i) => pad + (i / N) * iw;
  const py = (e) => top + 12 + ih - ((e - lo) / span) * ih;

  // the ridden part in flat grey, the rest in green
  const prog = clamp(cx / C.total, 0, 1);
  const cut = prog * N;
  const band = (from, to, fill) => {
    if (to <= from) return;
    ctx.beginPath();
    ctx.moveTo(px(from), top + 12 + ih);
    for (let i = Math.floor(from); i <= Math.ceil(to); i++) {
      const t = clamp(i, from, to);
      ctx.lineTo(px(t), py(xs[clamp(Math.round(t), 0, N)]));
    }
    ctx.lineTo(px(to), top + 12 + ih);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  };
  band(0, cut, "#9aa8b6");
  band(cut, N, "#6aa84f");

  // outline
  ctx.beginPath();
  for (let i = 0; i <= N; i++) (i ? ctx.lineTo(px(i), py(xs[i])) : ctx.moveTo(px(i), py(xs[i])));
  ctx.strokeStyle = "#2c4a2a"; ctx.lineWidth = 1; ctx.stroke();

  // 5-km ticks
  ctx.fillStyle = "rgba(20,45,75,0.45)";
  for (let km = 5; km < C.total / 1000; km += 5) {
    const x = pad + (km * 1000 / C.total) * iw;
    ctx.fillRect(x, top + 12, 1, ih);
  }

  // the race map: every group is flagged at all times — the bunch is chasing, after all —
  // chips on stalks, nudged apart so neighbours never overlap
  const grps = S.groups;
  {
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.textAlign = "center";
    const CW = 18, GAPX = 2;
    const marks = grps.map((grp, gi) => {
      const gd = clamp(grp[0].dist, 0, C.total);
      return { label: "G" + (gi + 1), mine: grp.includes(S.riders[0]), pel: false, lineX: pad + (gd / C.total) * iw, lineY: py(C.eleAt(gd)), x: 0 };
    });
    if (S.pel.dist > 0) {
      const pd = clamp(S.pel.dist, 0, C.total);
      marks.push({ label: "P", mine: false, pel: true, lineX: pad + (pd / C.total) * iw, lineY: py(C.eleAt(pd)), x: 0 });
    }
    marks.sort((a, b) => b.lineX - a.lineX);      // front to back
    marks.forEach((mk) => { mk.x = mk.lineX; });
    for (let i = 1; i < marks.length; i++) {
      const prev = marks[i - 1];
      if (prev.x - marks[i].x < CW + GAPX) marks[i].x = prev.x - (CW + GAPX);   // slide the rear one back
    }
    for (const mk of marks) {
      const top = mk.lineY - 22;
      ctx.strokeStyle = "rgba(19,58,107,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mk.x, top + 11); ctx.lineTo(mk.lineX, mk.lineY); ctx.stroke();
      ctx.fillStyle = mk.mine ? "rgba(255,210,63,0.95)" : mk.pel ? "rgba(16,28,44,0.94)" : "rgba(19,58,107,0.92)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(mk.x - CW / 2, top, CW, 11, 5); else ctx.rect(mk.x - CW / 2, top, CW, 11);
      ctx.fill();
      ctx.fillStyle = mk.mine ? "#14181d" : "#fff";
      ctx.fillText(mk.label, mk.x, top + 8.5);
    }
  }
  // labels
  ctx.font = "700 9px ui-monospace, monospace";
  ctx.fillStyle = "#0d3568"; ctx.textAlign = "left";
  ctx.fillText("START", pad, top + 9);
  ctx.textAlign = "right";
  ctx.fillText(Math.round(hi - lo) + " M", w - pad, top + 9);
}


/* ---------------- Roadside: trees, sunflowers, farmhouses ---------------- */
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function drawScenery(S, ctx, w, xOf, yOf, cx, pxm) {
  const SP = 34;                                   // metres between candidate spots
  const i0 = Math.floor((cx - 120) / SP), i1 = Math.ceil((cx + 200) / SP);
  const k = pxm;                                   // everything below is sized in metres
  for (let i = i0; i <= i1; i++) {
    const r1 = hash1(i), r2 = hash1(i + 0.37), r3 = hash1(i + 0.91);
    if (r1 > 0.62) continue;                       // most spots stay empty
    const d = i * SP + r2 * 22;
    const x = xOf(d);
    if (x < -70 || x > w + 70) continue;
    const y = yOf(d) - 5;                          // just behind the tarmac
    const j = 0.85 + r3 * 0.45;
    if (r1 < 0.24) drawTree(ctx, x, y, k * 0.19 * j, r3);
    else if (r1 < 0.44) drawSunflowers(ctx, x, y, k * 0.26 * j, i);
    else drawHouse(ctx, x, y, k * 0.34 * j, r2, r3);
  }
}

function drawTree(ctx, x, y, s, r) {
  const th = (16 + r * 12) * s;
  ctx.fillStyle = "#6b4a2d";
  ctx.fillRect(x - 1.1 * s, y - th * 0.45, 2.2 * s, th * 0.45);
  if (r < 0.35) {                                  // slim poplar
    ctx.fillStyle = "#3f7a34";
    ctx.beginPath();
    ctx.moveTo(x, y - th * 1.45);
    ctx.lineTo(x + 4.2 * s, y - th * 0.35);
    ctx.lineTo(x - 4.2 * s, y - th * 0.35);
    ctx.closePath(); ctx.fill();
  } else {                                         // broad plane tree
    ctx.fillStyle = "#417f37";
    ctx.beginPath(); ctx.arc(x, y - th * 0.95, 7.5 * s, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 5.5 * s, y - th * 0.72, 5.4 * s, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5.5 * s, y - th * 0.75, 5.8 * s, 0, 6.284); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath(); ctx.arc(x + 2.5 * s, y - th * 1.15, 4.2 * s, 0, 6.284); ctx.fill();
  }
}

function drawSunflowers(ctx, x, y, s, seed) {
  const wdt = 46 * s, hgt = 11 * s;
  ctx.fillStyle = "#5f9c3a";
  ctx.fillRect(x - wdt / 2, y - hgt, wdt, hgt);
  for (let j = 0; j < 16; j++) {
    const q = hash1(seed * 7.3 + j);
    const fx = x - wdt / 2 + 3 * s + q * (wdt - 6 * s);
    const fy = y - hgt - (1.5 + hash1(seed + j * 2.1) * 4) * s;
    ctx.strokeStyle = "#4a7d2e"; ctx.lineWidth = 0.9 * s;
    ctx.beginPath(); ctx.moveTo(fx, y - hgt * 0.2); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = "#f5c518";
    ctx.beginPath(); ctx.arc(fx, fy, 2.1 * s, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#7a4a12";
    ctx.beginPath(); ctx.arc(fx, fy, 0.9 * s, 0, 6.284); ctx.fill();
  }
}

function drawHouse(ctx, x, y, s, r2, r3) {
  const bw = (22 + r2 * 14) * s, bh = (16 + r3 * 10) * s;
  ctx.fillStyle = r3 < 0.5 ? "#e6d7b8" : "#d9c6a6";   // limewashed stone
  ctx.fillRect(x - bw / 2, y - bh, bw, bh);
  ctx.fillStyle = "#a8462f";                          // terracotta roof
  ctx.beginPath();
  ctx.moveTo(x - bw / 2 - 2.5 * s, y - bh);
  ctx.lineTo(x, y - bh - 8 * s);
  ctx.lineTo(x + bw / 2 + 2.5 * s, y - bh);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5c728a";                          // shutters and door
  const rows = bh > 20 * s ? 2 : 1;
  for (let rw = 0; rw < rows; rw++)
    for (let c = 0; c < 2; c++)
      ctx.fillRect(x - bw * 0.28 + c * bw * 0.34, y - bh + (4 + rw * 8) * s, 4.4 * s, 5 * s);
  ctx.fillStyle = "#6b4a2d";
  ctx.fillRect(x + bw * 0.24, y - 7 * s, 4.6 * s, 7 * s);
}


/* a windsock on its pole — it streams the way the wind actually blows */
function drawWindsock(ctx, px, py, hw, wv, t) {
  const H = 13;
  ctx.strokeStyle = "#3c5a7a"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - H); ctx.stroke();
  // riders travel left → right, so a headwind blows back down the road (to the left)
  const along = clamp(hw / Math.max(wv, 0.1), -1, 1);
  const dir = along > 0 ? -1 : 1;                 // headwind streams left, tailwind right
  const reach = (5 + 10 * Math.abs(along)) * dir; // pure crosswind barely reaches across
  const droop = 5 * (1 - Math.abs(along));        // and hangs more sideways instead
  const sway = Math.sin(t * 0.35) * 0.9;
  const ax = px, ay = py - H + 0.5;
  ctx.fillStyle = "#e0483c";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + reach, ay + droop + sway + 1.2);
  ctx.lineTo(ax, ay + 5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f4f8fc";
  ctx.beginPath();
  ctx.moveTo(ax, ay + 1.6);
  ctx.lineTo(ax + reach * 0.55, ay + (droop + sway) * 0.55 + 2.2);
  ctx.lineTo(ax, ay + 3.6);
  ctx.closePath(); ctx.fill();
}

/* ---------------- The watt slider mapping ---------------- */
function sliderPts(T, M) {
  return [[0, 0], [0.24, 0.55 * T], [0.6, T], [0.84, 1.35 * T], [1, Math.max(M, 1.5 * T)]];
}
function wFromT(t, pts) {
  t = clamp(t, 0, 1);
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, w0] = pts[i - 1], [t1, w1] = pts[i];
      return lerp(w0, w1, (t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
}
function tFromW(wv, pts) {
  wv = clamp(wv, 0, pts[pts.length - 1][1]);
  for (let i = 1; i < pts.length; i++) {
    if (wv <= pts[i][1]) {
      const [t0, w0] = pts[i - 1], [t1, w1] = pts[i];
      return lerp(t0, t1, (wv - w0) / Math.max(w1 - w0, 1));
    }
  }
  return 1;
}

/* ============================================================ */
export default function TheBreakaway() {
  const [phase, setPhase] = useState("menu");
  const [, setTick] = useState(0);
  const [speedMode, setSpeedMode] = useState(5);
  const [debugOn, setDebugOn] = useState(DEBUG);
  const speedRef = useRef(5);
  const simRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const seedRef = useRef((Math.random() * 1e9) | 0);
  const dragRef = useRef(false);

  const start = (seed) => {
    seedRef.current = seed;
    simRef.current = newSim(seed);
    // the fixture the telemetry reads from — the whole sim, and only when asked for
    if (DEBUG && typeof window !== "undefined") window.__S = simRef.current;
    speedRef.current = 5; setSpeedMode(5);
    setPhase("race");
  };

  // the button owns the flag; the D key is the same switch, kept so a keyboard and
  // an automated run can reach it without hunting for the chyron
  const toggleDebug = () => {
    const on = !DEBUG;
    setDebug(on, simRef.current);
    setDebugOn(on);
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "d" || e.key === "D") toggleDebug(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const fit = () => {
      const c = canvasRef.current, el = wrapRef.current;
      if (!c || !el) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = el.clientWidth * dpr;
      c.height = el.clientHeight * dpr;
      c.style.width = el.clientWidth + "px";
      c.style.height = el.clientHeight + "px";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [phase]);

  useEffect(() => {
    if (phase !== "race") return;
    let raf, last = performance.now(), acc = 0;
    const loop = (now) => {
      const S = simRef.current;
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      if (S && !S.ended) {
        const ff = speedRef.current;
        acc += dt * ff;
        let guard = 0;
        while (acc >= 1 && guard < 220) { stepSim(S); acc -= 1; guard++; }
        const p = S.riders[0];
        if (p.caught && !S.ended) { S.ended = true; S.result = { caught: true, atKm: (S.course.total - p.dist) / 1000 }; }
        if (p.finished != null && !S.ended) finalize(S);
      }
      if (S && canvasRef.current) draw(S, canvasRef.current, clamp(acc, 0, 1));
      if (S && now - S.uiAt > 140) { S.uiAt = now; setTick((t) => t + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const S = simRef.current;
  const player = S ? S.riders[0] : null;
  const body = player ? bodyNow(player) : null;
  const pts = player ? sliderPts(player.T0 * player.form, player.curve.p5s) : null;

  const onSlider = (e, elem) => {
    if (!S || S.ended) return;
    const rect = elem.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const t = 1 - clamp((y - 14) / (rect.height - 28), 0, 1);
    const asked = Math.round(wFromT(t, pts));
    if (S.sitting) S.sitting = false;   // grabbing the slider takes the controls back
    S.slider = asked;
  };
  const onSliderUp = () => {
    dragRef.current = false;
  };

  /* ---------- UI pieces ---------- */
  const font = "'Barlow Condensed','Arial Narrow',system-ui,sans-serif";
  const mono = "ui-monospace,'SF Mono',Menlo,monospace";

  // the two action buttons share everything but colour and height — one factory, like btn()
  const actionBtn = (bottom, extra) => ({
    position: "absolute", right: 6, bottom, width: 74, padding: "8px 0",
    fontFamily: font, fontWeight: 800, fontStyle: "italic", letterSpacing: 0.8, fontSize: 11, lineHeight: 1.15,
    borderRadius: 999, textShadow: "0 1px 1px rgba(0,0,0,0.35)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(20,40,70,0.35)",
    ...extra,
  });

  const Bar = ({ label, frac, color }) => (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 1.5, color: "#0d3568", fontWeight: 800, fontStyle: "italic", fontFamily: font }}>
        <span>{label}</span><span style={{ fontFamily: mono }}>{Math.round(frac * 100)}%</span>
      </div>
      <div style={{ height: 8, background: "#31455c", border: "1px solid #223349", borderRadius: 4, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.45)" }}>
        <div style={{ height: "100%", width: `${clamp(frac, 0, 1) * 100}%`, background: `linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0) 45%), ${color}`, borderRadius: 3, transition: "width .25s linear" }} />
      </div>
    </div>
  );

  let raceUI = null;
  if (phase === "race" && S && player && body) {
    const kmToGo = Math.max(0, (S.course.total - player.dist) / 1000);
    const grad = S.course.gradAt(player.dist);
    const inWheels = player.shel > 0.05;
    const tT = tFromW(body.T, pts), tC = tFromW(body.ceil, pts), tS = tFromW(S.slider, pts);

    raceUI = (
      <>
        {/* chyron */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <div style={{ background: "linear-gradient(180deg, #8dbce6 0%, #3a76bd 42%, #1c4f92 100%)", borderBottom: "2px solid #0d3568", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), 0 3px 8px rgba(15,35,60,0.4)", padding: "7px 10px 6px", fontFamily: font, fontStyle: "italic" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, color: "#f2f5f7" }}>
            <span style={{ color: "#e8443a", fontWeight: 800, fontSize: 11, letterSpacing: 2 }}>● LIVE</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: "#d7e6f5", fontStyle: "normal" }}>{fmtTime(S.clock0 + S.t)}</span>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1, textShadow: "0 1px 2px rgba(10,30,55,0.7)" }}>{kmToGo.toFixed(1)} KM</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {[1, 5, 10, 100].map((m) => (
                <button key={m} onClick={() => { speedRef.current = m; setSpeedMode(m); }}
                  style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #0d3568", cursor: "pointer", fontStyle: "normal",
                    boxShadow: speedMode === m ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.55)",
                    background: speedMode === m ? "linear-gradient(180deg, #ffffff, #cfe2f6 60%, #a9cdf0)" : "linear-gradient(180deg, #9cc0e6, #3a76bd 55%, #2a5f9e)",
                    color: speedMode === m ? "#0d3568" : "#eaf3fb" }}>
                  {m}×
                </button>
              ))}
              <button onClick={toggleDebug}
                title="Telemetri i boblene over hodene (eller trykk D)"
                style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #0d3568", cursor: "pointer", fontStyle: "normal",
                  boxShadow: debugOn ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.55)",
                  background: debugOn ? "linear-gradient(180deg, #ffffff, #cfe2f6 60%, #a9cdf0)" : "linear-gradient(180deg, #9cc0e6, #3a76bd 55%, #2a5f9e)",
                  color: debugOn ? "#0d3568" : "#eaf3fb" }}>
                DBG
              </button>
              <button onClick={() => start((Math.random() * 1e9) | 0)}
                title="Start et nytt løp"
                style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #5c1010", cursor: "pointer", fontStyle: "normal",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                  background: "linear-gradient(180deg, #f0a29a, #c0392b 55%, #96281c)",
                  color: "#fff" }}>
                ↻
              </button>
            </span>
          </div>
          {S.events[0] && S.t - S.events[0].t < 7 && (
            <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#ffe57a", textShadow: "0 1px 2px rgba(10,30,55,0.7)" }}>{S.events[0].txt.toUpperCase()}</div>
          )}
        </div>

        {/* time gaps — sits under the chyron, never behind it */}
        <div style={{ margin: "6px 0 0 10px", width: 168, background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)", border: "2px solid #6f8cab", borderRadius: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 8px rgba(15,35,60,0.3)", padding: "4px 0" }}>
          {gapRows(S).map((r) => (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "1px 7px", background: r.me ? "rgba(255,210,63,0.55)" : "transparent", fontFamily: mono, fontSize: 9.5, fontWeight: 700 }}>
              <span style={{ color: "#0d3568", overflow: "hidden", whiteSpace: "nowrap" }}>{r.label}</span>
              <span style={{ color: Math.abs(r.gapS) < 1 ? "#123a6b" : r.gapS < 0 ? "#1d7a34" : "#c22a1e" }}>{Math.abs(r.gapS) < 1 ? "—" : fmtGap(r.gapS)}</span>
            </div>
          ))}
        </div>
        </div>

        {/* sit on: park at the back of the rotation */}
        <button
          onClick={() => {
            if (!S || S.ended) return;
            if (S.sitting) {
              S.sitting = false;
              S.slider = Math.round(player.power);   // hand the controls back where they are
            } else {
              S.sitting = true;
              S.pulling = false;
            }
          }}
          style={actionBtn(94, {
            cursor: "pointer",
            border: "2px solid #145c27", color: "#fff",
            background: S.sitting
              ? "linear-gradient(180deg, #d8f7dd, #5fc978 45%, #1d7a34)"
              : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #2f9e4f",
          })}>
          {S.sitting ? "HOLDING" : "SIT ON"}
        </button>

        {/* take the front */}
        <button
          onClick={() => {
            if (!S || S.ended) return;
            if (S.pulling) {
              S.pulling = false;
              S.slider = Math.round(player.power);   // hand the controls back where they are
            } else {
              S.pulling = true;
              S.sitting = false;
            }
          }}
          style={actionBtn(56, {
            cursor: "pointer",
            border: "2px solid #123a6b", color: "#fff",
            background: S.pulling
              ? "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #c0392b"
              : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #3a76bd",
          })}>
          {S.pulling ? "MANUAL" : "RELAY"}
        </button>

        {/* mode chip — where you ARE; the buttons say where you can go */}
        <div style={{
          position: "absolute", right: 6, bottom: 132, width: 74, padding: "3px 0",
          fontFamily: font, fontWeight: 800, fontStyle: "italic", letterSpacing: 0.8, fontSize: 10,
          textAlign: "center", borderRadius: 999, color: "#dfe9f4",
          background: "rgba(10,25,45,0.55)", border: "1px solid rgba(255,255,255,0.25)",
        }}>
          {S.sitting ? "SIT ON" : S.pulling ? "RELAY" : "MANUAL"}
        </div>

        {/* instrument panel */}
        <div style={{ position: "absolute", left: 10, bottom: 56, width: 168, background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)", border: "2px solid #6f8cab", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(60,90,125,0.35), 0 3px 10px rgba(15,35,60,0.35)", borderRadius: 12, padding: "10px 12px 8px" }}>
          <Bar label="SURGE" frac={body.sf} color="#35c24d" />
          <Bar label="FUEL" frac={body.ff} color="#2e8fe0" />
          <Bar label="LEGS" frac={1 - player.legs} color="#e0483c" />
          <Bar label="LY" frac={player.shel / SHEL_MAX} color="#8e6bd6" />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: mono, fontSize: 11 }}>
            <span style={{ color: "#1d7a34", fontWeight: 700 }}>THR {Math.round(body.T)}</span>
            <span style={{ color: "#c22a1e", fontWeight: 700 }}>MAX {Math.round(body.ceil)}</span>
          </div>
          <div style={{ marginTop: 3, fontFamily: mono, fontSize: 11, color: "#0d3568" }}>
            I VINDEN <b>{Math.round((player.st.wind / Math.max(player.st.t, 1)) * 100)}%</b>
            <span style={{ float: "right", color: "#3c5a7a" }}>av tiden</span>
          </div>
          <div style={{ marginTop: 3, fontFamily: mono, fontSize: 11, color: "#123a6b", fontWeight: 700 }}>
            {`${Math.round(player.power)} W${inWheels ? " · " + Math.round(player.shel * 100) + "% LY" : ""}`}
            <span style={{ float: "right", color: "#3c5a7a" }}>{(player.speed * 3.6).toFixed(0)} km/h {grad > 0.005 ? "▲" : grad < -0.005 ? "▼" : ""}{Math.abs(grad * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* watt slider — its foot carries the WATTS label, so the column has to stop
            clear of the mode chip below it, not just above the chip's own top edge */}
        <div
          style={{ position: "absolute", right: 6, top: 84, bottom: 158, width: 74, touchAction: "none", userSelect: "none" }}
          onPointerDown={(e) => { dragRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); onSlider(e, e.currentTarget); }}
          onPointerMove={(e) => { if (dragRef.current) onSlider(e, e.currentTarget); }}
          onPointerUp={onSliderUp}
          onPointerCancel={onSliderUp}
        >
          <div style={{ position: "absolute", left: 26, top: 14, bottom: 14, width: 22, borderRadius: 11, background: "linear-gradient(180deg, rgba(224,72,60,0.55), #7e93a8 30%, #55708c)", border: "2px solid #35516e", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.35)" }} />
          {/* green threshold line */}
          <div style={{ position: "absolute", left: 20, width: 40, height: 2, background: "#2fdc55", top: markerTop(tT), boxShadow: "0 0 5px #2fdc55" }} />
          {/* red ceiling line — sinks when you burn your matches */}
          <div style={{ position: "absolute", left: 20, width: 40, height: 2, background: "#ff4b3a", top: markerTop(tC), boxShadow: "0 0 5px #ff4b3a", transition: "top .3s linear" }} />
          {/* thumb */}
          <div style={{ position: "absolute", left: 12, width: 50, height: 34, top: `calc(${markerTop(tS)} - 17px)`, borderRadius: 999, background: S.sitting ? "linear-gradient(180deg, #d8f7dd, #5fc978 45%, #1d7a34)" : "linear-gradient(180deg, #eaf3fb, #7db3e0 45%, #2f6cb3)", border: S.sitting ? "2px solid #145c27" : "2px solid #123a6b", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(15,35,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 800, fontSize: 13, color: "#fff", textShadow: "0 1px 2px rgba(10,30,55,0.7)" }}>
            {S.sitting ? (S.braking > 1 ? "BREMS" : "HJUL") : S.slider}
          </div>
          {S.sitting && (
            <div style={{ position: "absolute", right: 64, width: 42, textAlign: "right", top: `calc(${markerTop(tS)} - 8px)`, fontFamily: mono, fontWeight: 800, fontSize: 12, color: "#1d7a34", textShadow: "0 1px 0 rgba(255,255,255,0.8)" }}>
              {S.slider}
            </div>
          )}
          <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, textAlign: "center", fontSize: 9, letterSpacing: 2, color: "#0d3568", fontWeight: 800, fontStyle: "italic", fontFamily: font }}>WATTS</div>
        </div>

        {/* result card */}
        {S.ended && S.result && (
          <div style={overlay}>
            <div style={card}>
              <div style={{ fontFamily: font, fontSize: 12, letterSpacing: 3, color: "#3c5a7a", fontWeight: 800, fontStyle: "italic" }}>RESULT</div>
              <div style={{ fontFamily: font, fontWeight: 800, fontSize: 34, letterSpacing: 1, color: S.result.caught ? "#c22a1e" : "#0d3568", fontStyle: "italic", margin: "2px 0 10px" }}>
                {S.result.caught ? `CAUGHT · ${S.result.atKm.toFixed(1)} KM TO GO` : place(S.result.place)}
              </div>
              <ResultRow k="Average power" v={`${Math.round(player.st.work / Math.max(player.st.t, 1))} W  ·  ${(player.st.work / Math.max(player.st.t, 1) / player.mass).toFixed(1)} W/kg`} />
              <ResultRow k="Time in the wind" v={fmtTime(player.st.wind)} />
              <ResultRow k="Time above threshold" v={fmtTime(player.st.above)} />
              <ResultRow k="Deepest the tank went" v={`${Math.round(player.st.minFuel * 100)} % fuel`} />
              <ResultRow k="Wind on the day" v={`${S.course.wv.toFixed(1)} m/s`} />
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => start(seedRef.current)} style={btn("#3a76bd", "#fff", 1)}>SAME RACE AGAIN</button>
                <button onClick={() => start((Math.random() * 1e9) | 0)} style={btn("#2e7d46", "#fff", 1)}>NEW RACE</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#3c5a7a", fontFamily: font, letterSpacing: 1 }}>SAME RACE = same wind, same legs. A fair rematch.</div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ height: "100dvh", width: "100%", background: "linear-gradient(180deg, #e6edf4, #9fb2c5)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font, padding: 6, boxSizing: "border-box" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,700;0,800;1,700;1,800&display=swap'); button:active{transform:scale(0.97)} button{cursor:pointer}`}</style>
      <div ref={wrapRef} style={{ position: "relative", flex: 1, overflow: "hidden", borderRadius: 14, border: "2px solid #6f8cab", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.55), 0 4px 14px rgba(15,35,60,0.35)" }}>
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
        {raceUI}
        {phase === "menu" && (
          <div style={overlay}>
            <div style={{ ...card, textAlign: "center", maxWidth: 340 }}>
              <div style={{ fontSize: 13, letterSpacing: 5, color: "#b8791a", fontWeight: 800, fontStyle: "italic" }}>150 KM ALREADY IN THE LEGS</div>
              <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: 2, color: "#0d3568", fontStyle: "italic", lineHeight: 1, margin: "6px 0 14px", textShadow: "0 1px 0 rgba(255,255,255,0.8)" }}>THE<br />BREAKAWAY</div>
              <div style={{ fontSize: 12, letterSpacing: 4, color: "#3a76bd", fontWeight: 800, fontStyle: "italic", marginTop: -8, marginBottom: 12 }}>LEGENDS 0.2</div>
              <div style={{ fontSize: 14, color: "#22456b", lineHeight: 1.5, textAlign: "left" }}>
                You're away with Van der Poel, Van Aert, Küng and Pantani, ~23 km from the line, the peloton about a minute back — pacing to catch the best of you by a single second.
                <br /><br />
                <b style={{ color: "#0d3568" }}>One thumb, one control:</b> drag the watt slider. It stays where you leave it.
                <br />• <span style={{ color: "#1d7a34", fontWeight: 700 }}>Green line</span> = your threshold
                <br />• <span style={{ color: "#c22a1e", fontWeight: 700 }}>Red line</span> = all you've got right now — burn your matches and it sinks
              </div>
              <button onClick={() => start(seedRef.current)} style={{ ...btn("#2e7d46", "#fff", 1), marginTop: 18, fontSize: 16, width: "100%", padding: "14px 0" }}>ROLL OUT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const markerTop = (t) => `calc(14px + ${((1 - clamp(t, 0, 1)) * 100).toFixed(2)}% - ${((1 - clamp(t, 0, 1)) * 28).toFixed(1)}px)`;
const place = (p) => (p === 1 ? "🏆 YOU WIN THE STAGE" : p === 2 ? "2ND ON THE STAGE" : p === 3 ? "3RD ON THE STAGE" : p + "TH ON THE STAGE");
const btn = (bg, fg, big) => ({
  background: `linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), ${bg}`,
  color: fg, border: "1px solid #123a6b", borderRadius: 999,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(20,40,70,0.35)",
  padding: big ? "12px 18px" : "10px 14px", fontFamily: "'Barlow Condensed','Arial Narrow',system-ui,sans-serif",
  fontWeight: 800, fontStyle: "italic", letterSpacing: 1.5, fontSize: 13, textShadow: "0 1px 1px rgba(0,0,0,0.35)",
});
const overlay = { position: "absolute", inset: 0, background: "rgba(28,58,96,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 5 };
const card = {
  background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)",
  border: "2px solid #6f8cab", borderRadius: 16, padding: "18px 20px", width: "100%", maxWidth: 360,
  boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(60,90,125,0.35), 0 12px 40px rgba(15,35,60,0.45)",
};
const ResultRow = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(60,90,125,0.25)", fontSize: 13 }}>
    <span style={{ color: "#3c5a7a" }}>{k}</span>
    <span style={{ color: "#0d3568", fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{v}</span>
  </div>
);
