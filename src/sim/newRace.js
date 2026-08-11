import { COOP_SEED, PACE_MARGIN, PEL_FINALE_X, PEL_LEAD, WARMUP_S } from "../content/tuning.js";
import { bodyNow, makeRiders, thresholdFull } from "./body.js";
import { buildCourse } from "./course.js";
import { tagGroups } from "./groups.js";
import { calibratePel } from "./peloton.js";
import { breakSchedule, planSpeedAt, soloBenchmark } from "./plan.js";
import { mulberry32 } from "./rng.js";
import { stepSim } from "./step.js";

/* A new race: build the stage and the bodies, solve the deadline, then ride the move
   for a minute before the clock is allowed to start. */

export function newSim(seed) {
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
