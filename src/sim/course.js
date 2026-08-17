import { DEFAULT_STAGE } from "../content/stage.js";
import { CLIMB_GRAD, CLIMB_SMOOTH } from "../content/tuning.js";
import { clamp, lerp } from "./rng.js";

/* The road: one seeded stage, sampled every ten metres. */

/* ---------------- The road ---------------- */
export const STEP = 10; // metres between samples

export function buildCourse(rng, stage = DEFAULT_STAGE) {
  // a stage is { kind, segs }; a bare segment array (older stage functions, custom
  // tools) still works and reads as the rouleur archetype it always was
  const st = stage(rng);
  const segs = st.segs || st;
  const kind = st.kind || "rouleur";
  let total = 0; for (const s of segs) total += s.len;
  const n = Math.ceil(total / STEP) + 2;
  const rawG = new Float32Array(n);
  let si = 0, segStart = 0;
  for (let i = 0; i < n; i++) {
    const s = i * STEP;
    while (si < segs.length - 1 && s > segStart + segs[si].len) { segStart += segs[si].len; si++; }
    rawG[i] = segs[si].g;
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
  // One wind for the whole day, and it is either on the nose or on the back — no
  // crosswind, no turning into and out of it as the road wanders. A rider can read
  // it once at the start and it stays true to the line, which is what makes the
  // deadline something you can reason about instead of something you discover.
  const wv = 1.5 + rng() * 4.5;
  const wHead = new Float32Array(n).fill(rng() < 0.5 ? wv : -wv);   // + on the nose, − on the back
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
    total, n, ele, wv, kind,
    gradAt: (d) => at(grad, d),
    eleAt: (d) => at(ele, d),
    windAt: (d) => at(wHead, d),
    climbTopAt: (d) => top[clamp(Math.floor(d / STEP), 0, n)],
  };
}
