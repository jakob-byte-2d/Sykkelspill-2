/* ============================================================
   THE ROSTER — six numbers per rider, and nothing else. Everything that separates
   these men in a race (frontal area, threshold, how long a turn he can hold, when he
   has to open his sprint, how deep his anaerobic battery is) is derived from these by
   sim/body.js. Nothing in the engine ever asks a rider's name, so handing a player a
   different profile is a matter of handing him a different row.

   The curve is his power–duration points in watts: five seconds, one, five and twenty
   minutes, and the hour. wp is the anaerobic battery in kilojoules — what he has above
   his threshold. Keep it near (p5 − threshold) × 300 s: the curve and the tank are two
   statements about the same body, and a rider whose numbers disagree will either blow
   up on every climb or never be able to attack at all.
   ============================================================ */

export const COLORS = ["#f5f2e9", "#ffd23f", "#2ec4b6", "#ff5d73", "#b78bfa", "#4d96ff"];

/* Three all-rounders, an explosive climber and a big diesel. No pure sprinter: one
   would never have survived 150 km and a six per cent climb to reach this move. */
export const ROSTER = [
  { name: "PEDERSEN", mass: 76, h: 1.80, curve: { p5s: 1450, p1: 800, p5: 560, p20: 490, p60: 455, wp: 26 } },
  { name: "V.D.POEL", mass: 75, h: 1.84, curve: { p5s: 1560, p1: 800, p5: 565, p20: 495, p60: 460, wp: 28 } },
  { name: "VAN AERT", mass: 78, h: 1.90, curve: { p5s: 1600, p1: 820, p5: 570, p20: 500, p60: 465, wp: 29 } },
  // The climber is the explosive kind, not the diesel: best man in this group from about
  // four minutes upward, which is what this stage's hill actually lasts. A flatter, more
  // aerobic climber would beat him on a twenty-minute col and lose to him here. The low
  // p5s and the small wp are the same rider seen from the other end — he attacks with an
  // aerobic engine and cannot sprint at all, so arriving together is the one thing he
  // must not allow. And he weighs what he weighs: any lighter and he falls off the back
  // on the descents, where the road hands speed out by the kilogram.
  { name: "PANTANI",  mass: 62, h: 1.72, curve: { p5s: 800,  p1: 590, p5: 517, p20: 455, p60: 402, wp: 15 } },
  { name: "KÜNG",     mass: 83, h: 1.93, curve: { p5s: 1300, p1: 720, p5: 555, p20: 480, p60: 450, wp: 24 } },
];
