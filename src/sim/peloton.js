import { PEL_CDA, PEL_FINALE_M, PEL_MASS } from "../content/tuning.js";
import { rhoAt, speedFor } from "./physics.js";

/* The bunch: one body with a solved base power, so the hour it crosses the line is
   known from the gun. That is what turns the requirement into a deadline. */

/* ---------------- The peloton, one organism with memory ---------------- */
/* One second of the bunch — shared verbatim by the live sim and the calibration,
   so the two can never drift apart: steady base watts, lifted by PEL_FINALE_X
   inside the last PEL_FINALE_M metres. Returns the new speed. */
export function pelSpeed(course, dist, v, base, finaleP) {
  const d = Math.max(dist, 0);
  const grad = course.gradAt(d), rho = rhoAt(course.eleAt(d)), hw = course.windAt(d);
  // inside the last kilometre it stops riding tempo and rides the sprint: an absolute
  // number off the benchmark threshold, not a multiple of whatever base it was given
  const P = (course.total - dist) < PEL_FINALE_M ? finaleP : base;
  return speedFor(P, PEL_MASS, PEL_CDA, grad, rho, hw, 0, v);
}

export function stepPel(S) {
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

/* The bunch must cross the line exactly one second after that benchmark.
   It rides the same pelSpeed step as the live bunch — solve for the base. */
export function pelSimTime(course, startGap, base, finaleP) {
  let dist = -startGap, v = 11.8, t = 0;
  while (dist < course.total && t < 12000) {
    t++;
    v = pelSpeed(course, dist, v, base, finaleP);
    dist += v;
  }
  return t - (dist - course.total) / Math.max(v, 1);
}

export function calibratePel(course, startGap, targetT, finaleP) {
  // wide enough that the search never sits on its own ceiling: clamped, the bunch would
  // quietly ride slower than the deadline asks for and the knob would stop meaning anything
  let lo = 150, hi = 900;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (pelSimTime(course, startGap, mid, finaleP) > targetT) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
