import { clamp, lerp } from "../sim/rng.js";

/* The watt slider mapping: a non-linear scale that gives the useful range room. */

/* ---------------- The watt slider mapping ---------------- */
export function sliderPts(T, M) {
  return [[0, 0], [0.24, 0.55 * T], [0.6, T], [0.84, 1.35 * T], [1, Math.max(M, 1.5 * T)]];
}

export function wFromT(t, pts) {
  t = clamp(t, 0, 1);
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, w0] = pts[i - 1], [t1, w1] = pts[i];
      return lerp(w0, w1, (t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
}

export function tFromW(wv, pts) {
  wv = clamp(wv, 0, pts[pts.length - 1][1]);
  for (let i = 1; i < pts.length; i++) {
    if (wv <= pts[i][1]) {
      const [t0, w0] = pts[i - 1], [t1, w1] = pts[i];
      return lerp(t0, t1, (wv - w0) / Math.max(w1 - w0, 1));
    }
  }
  return 1;
}
