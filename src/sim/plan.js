import { BRK_CDA, BRK_MASS, DH_GRAD } from "../content/tuning.js";
import { bodyNow, spend, thresholdFull } from "./body.js";
import { STEP } from "./course.js";
import { G, coast, rhoAt, speedFor } from "./physics.js";
import { clamp } from "./rng.js";

/* The pace plan and the benchmarks it is built from. */

/* ---------------- The pace plan: what the break has to do to stay away ----------- */
/* The bunch is deterministic, so the hour it crosses the line is known from the gun.
   That makes the requirement a deadline, not a speed. These four mirror the peloton's
   own machinery: one step, one run to the line, a bisection, and a stored schedule. */
export function breakSpeed(course, dist, v, base) {
  const d = Math.max(dist, 0);
  return speedFor(base, BRK_MASS, BRK_CDA, course.gradAt(d), rhoAt(course.eleAt(d)), course.windAt(d), 0, v);
}

export function breakTime(course, base, v0 = 11.5) {
  let dist = 0, v = v0, t = 0;
  while (dist < course.total && t < 12000) {
    t++;
    v = breakSpeed(course, dist, v, base);
    dist += v;
  }
  return t - (dist - course.total) / Math.max(v, 1);
}

export function calibrateBreak(course, targetT, v0) {
  let lo = 200, hi = 520;
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (breakTime(course, mid, v0) > targetT) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* One more run at the solved effort, keeping the clock every 100 m: distance → time.
   Reading it later is an array lookup, so the controller costs nothing per tick. */
export function breakSchedule(course, targetT, v0 = 11.5) {
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
export function planTimeAt(plan, dist) {
  const x = clamp(dist, 0, (plan.at.length - 1) * plan.step) / plan.step;
  const i = Math.floor(x);
  const a = plan.at[i], b = plan.at[Math.min(i + 1, plan.at.length - 1)];
  return a + (b - a) * (x - i);
}

// ...and the speed it holds there, same lerp on the recorded speeds
export function planSpeedAt(plan, dist) {
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
export function soloBenchmark(course, rider, shel = 0, steady = false) {
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
