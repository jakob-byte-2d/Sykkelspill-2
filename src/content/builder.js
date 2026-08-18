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
import { POOL } from "./riders.js";

/* The jerseys on offer: the great teams of road cycling, one hex each — the same
   dressing rule as the roster (the engine never reads team or color). The pool's
   fifteen kits are borrowed straight from POOL so the two lists cannot drift; the
   nine above them are legends whose captains didn't make the draw pool. The build
   screen strikes out whatever the four drawn opponents are wearing — you cannot
   ride in a kit that is already in the break — which is also why the extras lead
   the list: the default choice can never be the one that just got struck. */
export const TEAMS = [
  { team: "BIANCHI", color: "#8fd8cf" },       // Coppi's celeste
  { team: "FAEMA", color: "#efe3c9" },         // Merckx's first great kit
  { team: "PEUGEOT", color: "#dde3f0" },       // the checkerboard
  { team: "RENAULT-ELF", color: "#f6d431" },   // Hinault and Fignon in yellow-black
  { team: "LA VIE CLAIRE", color: "#2f4de0" }, // the Mondrian jersey
  { team: "MAPEI", color: "#6b46d8" },         // the cubes
  { team: "BANESTO", color: "#7fa8e6" },       // Indurain's five Julys
  { team: "US POSTAL", color: "#33508f" },     // the blue train
  { team: "TEAM SKY", color: "#1c2735" },      // the black line
  ...POOL.map((p) => ({ team: p.team, color: p.color })),
];

export const BUILD_PTS = 24;    // points across the four attributes, 1-10 each — all
                                // sixes spends the budget exactly: a balanced pro.
                                // The cap is the whole game: you cannot out-legend
                                // the legends everywhere, only somewhere.

export const MASSES = [50, 54, 58, 62, 66, 70, 74, 78, 82, 86];

/* info is the builder screen's one-line explainer, shown when the row is tapped —
   it lives here with the mapping so the words and the numbers cannot drift apart. */
export const ATTRS = [
  { key: "spurt", label: "SPRINT",
    info: "The 5-second kick and the deep battery behind it — the last 200 m, and the jump that opens an attack." },
  { key: "punch", label: "PUNCH",
    info: "1-5 minute power: attacks, covering moves, short steep climbs. The matches you strike above threshold." },
  { key: "motor", label: "ENGINE",
    info: "Threshold and hour power — the day's cruise, your pulls in the rotation, everything long." },
  { key: "seighet", label: "GRIT",
    info: "Durability: how slowly the day wears you down — and how little the 150 km already ridden has cost you." },
];

export const MASS_INFO = "Real kilograms, and it costs no points: heavy = more raw watts for flat roads "
  + "and big pulls, light = more watts per kilo where the road climbs.";

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
    merits: "", look: { skin: "#e8c9a0", style: "cap" },  // the cap paints itself kit-colored
  };
}

/* The rider card's 1-10 pips, for legends and built men alike: the INVERSE of
   buildSpec's own anchors, so the two can never drift — a drawn Merckx and a
   10-ENGINE build read the same scale. Reads only mass/curve/dura; values past
   the anchors (the pool's freaks) simply pin at 10. */
const unlerp = (v, lo, hi) => Math.round(clamp(1 + (9 * (v - lo)) / (hi - lo), 1, 10));
export function ratingsOf(spec) {
  const kg = spec.mass, c = spec.curve;
  const aw = 70 * Math.pow(kg / 70, 0.75);   // allometric divisor, allo()'s mirror
  return {
    spurt: unlerp(c.p5s / kg, 13.5, 24.5),
    punch: unlerp(c.p5 / aw, 5.6, 8.2),
    motor: unlerp(c.p60 / aw, 5.0, 6.4),
    seighet: unlerp(spec.dura || 1, 0.85, 1.17),
  };
}

export const budgetLeft = (a) => BUILD_PTS - ATTRS.reduce((s, at) => s + (a[at.key] || 1), 0);
