import { COOP_COAST_KMH, COOP_COAST_SPAN } from "../content/tuning.js";
import { clamp } from "./rng.js";

/* The physics: what a speed costs in watts, what a wattage buys in speed, and how
   much of the wind the man in front takes off you. No rider, no race — just air,
   gravity and rolling resistance. */

/* ---------------- Physics ---------------- */
export const G = 9.81;

export const rhoAt = (alt) => 1.2255 * Math.exp(-alt / 8700);

export function powerRaw(v, m, cda, grad, rho, hw, shel) {
  const va = v + hw;
  return ((0.004 * m * G + m * G * grad) * v + 0.5 * rho * cda * (1 - shel) * Math.abs(va) * va * v) / 0.975;
}

export function powerFor(v, m, cda, grad, rho, hw, shel) {
  return Math.max(0, powerRaw(v, m, cda, grad, rho, hw, shel));
}

export function speedFor(P, m, cda, grad, rho, hw, shel, vg) {
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

export const BIKE = 1.7;        // one bicycle length

export const ORDER_EPS = BIKE;  // overtakes shorter than this don't reorder the line — near-ties keep last tick's order

export const DRAFT = 12;        // beyond this there is no useful wind shadow left

export const DRAFT_TAU = 3.5;   // it decays by 1/e every 3.5 m

export const SHEL_MAX = 0.36;   // most drag ONE wheel can take off you — the real figure
                                // for second wheel, glued on, in a wind tunnel
export const DEPTH_FALL = 0.35; // ...and every further body up the road adds this much of
                                // what the ones behind him left, so the line deepens:
                                // 36 % on second wheel, 44 on third, 46 on fourth, 47 on
                                // fifth, against a measured 33-38 / 38-43 / 42-47 / 44-48
// the most the line can ever give, with a full file glued together — the reference the
// LY readout is a percentage of
export const SHEL_DEEP = 0.48;

// gap is measured wheel to wheel: from the back of his rear tyre to the front of yours.
// gap = 0 → your front wheel is touching his rear wheel.
// gap < 0 → the wheels overlap; you are moving up alongside him.
export function shelterAt(gap) {
  if (gap >= 0) return gap < DRAFT ? SHEL_MAX * Math.exp(-gap / DRAFT_TAU) : 0;
  if (gap > -BIKE) { const f = 1 + gap / BIKE; return SHEL_MAX * f * f; }   // alongside him it goes fast
  return 0;                                              // a full bike length clear
}

/* Every body up the road takes a little wind off you. The nearest wheel does most of it;
   a man further up already sits inside the wake of the one behind him, so only what is
   left of the wind reaches him as a new contribution — which is why a line stops paying
   after about the fourth wheel. Given the shelter each rider ahead would give on his own,
   this is what the whole file gives together. */
export function shelterStack(each) {
  let shel = 0, w = 1;
  for (const s of each.sort((a, b) => b - a)) {
    if (s <= 0) continue;
    shel += (1 - shel) * s * w;
    w *= DEPTH_FALL;
  }
  return shel;
}

// past COOP_COAST_KMH a pace-setting effort buys nothing — watts taper to zero
// over the next COOP_COAST_SPAN km/h (front pulls, drop-backs, riding alone)
export const coast = (P, v) => P * (1 - clamp((v * 3.6 - COOP_COAST_KMH) / COOP_COAST_SPAN, 0, 1));
