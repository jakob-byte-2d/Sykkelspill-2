/* ============================================================
   THE BUILDER — four sliders, one body weight, one body. The player's simplified
   attributes map to the same six roster numbers every legend is made of; nothing
   downstream knows a built rider from a drawn one.

   WEIGHT is chosen in real kilograms (MASSES, ten 4 kg steps 50–86) and costs no
   points: it prices itself through allometry. Big bodies make more absolute watts
   but fewer watts per kilo — endurance power scales as roughly mass^0.75, not
   mass — and the pool obeys the rule already: the legends' hour power divided by
   mass^0.75 clusters at 16.6–18.9 (Pantani 18.6, Merckx 18.9, Cancellara 17.9,
   Cavendish 16.6). So ENGINE and PUNCH buy allometric coefficients, anchored so a
   70 kg build matches the old per-kg anchors exactly; SPRINT stays linear in mass
   (a sprint is muscle). Heavy = the flat and the pulls, light = the wall, and the
   pool's own caps (absolute 480/512 up top, ~6.9 W/kg for the featherweights)
   keep both ends inside the legends' physiological envelope.
   ============================================================ */

import { clamp } from "../sim/rng.js";

export const BUILD_PTS = 24;    // points across the four attributes, 1-10 each — all
                                // sixes spends the budget exactly: a balanced pro.
                                // The cap is the whole game: you cannot out-legend
                                // the legends everywhere, only somewhere.

export const MASSES = [50, 54, 58, 62, 66, 70, 74, 78, 82, 86];

export const ATTRS = [
  { key: "spurt", label: "SPRINT" },      // the 5-second kick, and the alactic tank behind it
  { key: "punch", label: "PUNCH" },       // 1-5 minutes: the attack, the cover, the kicker
  { key: "motor", label: "ENGINE" },      // 20-60 minutes: threshold, the day's cruise
  { key: "seighet", label: "GRIT" },      // durability: how slowly the day eats you
];

const lerp = (k, lo, hi) => lo + ((clamp(k, 1, 10) - 1) / 9) * (hi - lo);
// the allometric body: watts from a coefficient anchored at 70 kg, scaled by kg^0.75
const allo = (wkg70, kg) => wkg70 * 70 * Math.pow(kg / 70, 0.75);

/* attributes {spurt, punch, motor, seighet} (each 1-10) + kg → a roster spec.
   Monotonicity guards keep impossible curves out (a 10-ENGINE 1-PUNCH body would
   otherwise hold more for 20 minutes than for 5): each shorter duration is at least
   a real step above the longer one, the way every human curve is. */
export function buildSpec(a) {
  const kg = clamp(a.kg || 70, MASSES[0], MASSES[MASSES.length - 1]);
  const h = Math.round((1.65 + ((kg - 50) / 36) * 0.28) * 100) / 100;
  // ENGINE: allometric, capped in absolute watts (the pool tops out at CANCELLARA's
  // 478) AND in W/kg (just over PANTANI's 6.75) — neither end of the scale escapes
  const p60 = Math.min(allo(lerp(a.motor, 5.0, 6.4), kg), 480, 6.9 * kg);
  const p20 = Math.max(Math.min(allo(lerp(a.motor, 5.4, 6.9), kg), 512, 7.4 * kg), p60 * 1.055);
  // PUNCH: allometric with the same two-sided caps
  const p5 = Math.max(Math.min(allo(lerp(a.punch, 5.6, 8.2), kg), 590, 8.3 * kg), p20 * 1.045);
  const p1 = Math.max(Math.min(allo(lerp(a.punch, 8.6, 11.6), kg), 860), p5 * 1.25);
  // SPRINT: linear in mass — a sprint is muscle, and the pool's sprinters carry it
  const p5s = Math.max(Math.min(lerp(a.spurt, 13.5, 24.5) * kg, 1760), p1 * 1.35);
  // W' follows the aerobic gap (the roster's own doctrine), plus the sprinter
  // exception: a big SPRINT number buys the oversized battery that class carries
  const T = p60 * 1.045;
  const wp = clamp((p5 - T) * 0.3 + Math.max(a.spurt - 6, 0) * 2.5, 14, 34);
  const dura = Math.round(lerp(a.seighet, 0.85, 1.17) * 100) / 100;
  const r = (x) => Math.round(x);
  return {
    name: "YOU", team: "PRIVATEER", color: "#f5f2e9",
    mass: kg, h,
    curve: { p5s: r(p5s), p1: r(p1), p5: r(p5), p20: r(p20), p60: r(p60), wp: r(wp) },
    dura,
  };
}

export const budgetLeft = (a) => BUILD_PTS - ATTRS.reduce((s, at) => s + (a[at.key] || 1), 0);
