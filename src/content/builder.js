/* ============================================================
   THE BUILDER — five sliders, one body. The player's simplified attributes map to
   the same six roster numbers every legend is made of; nothing downstream knows a
   built rider from a drawn one.

   Every power attribute maps to W/kg AT ITS OWN DURATION, then multiplies by the
   chosen mass — so the weight trade-off falls out of the physics instead of special
   rules: a light build loses absolute watts on the flat and wins them back where the
   road climbs, exactly the way the pool's climbers do. Anchors are the pool's own
   spread: a 10 sits at the top of the legends' range, a 5-6 in the middle of it.
   ============================================================ */

import { clamp } from "../sim/rng.js";

export const BUILD_PTS = 30;    // points to spend across the five attributes, 1-10 each —
                                // all sixes spends the budget exactly: a balanced pro.
                                // The cap is the whole game: you cannot out-legend the
                                // legends everywhere, only somewhere.

export const ATTRS = [
  { key: "spurt", label: "SPRINT" },      // the 5-second kick, and the alactic tank behind it
  { key: "punch", label: "PUNCH" },       // 1-5 minutes: the attack, the cover, the kicker
  { key: "motor", label: "ENGINE" },      // 20-60 minutes: threshold, the day's cruise
  { key: "vekt", label: "WEIGHT" },       // 10 = 58 kg climber, 1 = 82 kg rouleur
  { key: "seighet", label: "GRIT" },      // durability: how slowly the day eats you
];

const lerp = (k, lo, hi) => lo + ((clamp(k, 1, 10) - 1) / 9) * (hi - lo);

/* attributes {spurt, punch, motor, vekt, seighet} (each 1-10) → a roster spec.
   Monotonicity guards keep impossible curves out (a 10-ENGINE 1-PUNCH body would
   otherwise hold more for 20 minutes than for 5): each shorter duration is at least
   a real step above the longer one, the way every human curve is. */
export function buildSpec(a) {
  const mass = Math.round(lerp(a.vekt, 82, 58));
  const h = Math.round((lerp(a.vekt, 1.91, 1.69)) * 100) / 100;
  // capped in W/kg AND in absolute watts: the pool tops out at 478 (CANCELLARA),
  // and a heavy build must not buy past it by sheer kilograms
  const p60 = Math.min(lerp(a.motor, 5.0, 6.4) * mass, 480);
  const p20 = Math.max(Math.min(lerp(a.motor, 5.4, 6.9) * mass, 512), p60 * 1.055);
  const p5 = Math.max(lerp(a.punch, 5.6, 8.2) * mass, p20 * 1.045);
  const p1 = Math.max(lerp(a.punch, 8.6, 11.6) * mass, p5 * 1.25);
  const p5s = Math.max(lerp(a.spurt, 13.5, 24.5) * mass, p1 * 1.35);
  // W' follows the aerobic gap (the roster's own doctrine), plus the sprinter
  // exception: a big SPRINT number buys the oversized battery that class carries
  const T = p60 * 1.045;
  const wp = clamp((p5 - T) * 0.3 + Math.max(a.spurt - 6, 0) * 2.5, 14, 34);
  const dura = Math.round(lerp(a.seighet, 0.85, 1.17) * 100) / 100;
  const r = (x) => Math.round(x);
  return {
    name: "YOU", team: "PRIVATEER", color: "#f5f2e9",
    mass, h,
    curve: { p5s: r(p5s), p1: r(p1), p5: r(p5), p20: r(p20), p60: r(p60), wp: r(wp) },
    dura,
  };
}

export const budgetLeft = (a) => BUILD_PTS - ATTRS.reduce((s, at) => s + (a[at.key] || 1), 0);
