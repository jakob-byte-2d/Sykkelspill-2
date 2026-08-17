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

   dura is durability — how slowly the day wears him. Wear divides by it, and so does
   the wear he starts with, because a durable man also took less damage from the 150 km
   already ridden. 1.0 is an ordinary professional; the spread inside THIS roster is
   deliberately narrow because all five are hardmen in life — the attribute exists so a
   future sprinter (0.8) or grand-tour diesel (1.2) needs a number, not new code.
   ============================================================ */

export const COLORS = ["#f5f2e9", "#ffd23f", "#2ec4b6", "#ff5d73", "#b78bfa", "#4d96ff"];

/* Five real riders at the height of their careers. Nobody here is a pure sprinter — one
   would never have survived 150 km and a six per cent climb to reach this move — but the
   five are separated by everything else: how long they can hold it, how much they have
   over threshold, and what they can do in the last two hundred metres.

   team is chyron dressing for the results board — the engine never reads it, same as
   the name. Each man carries the jersey of the years his numbers are drawn from. */
export const ROSTER = [
  // The classics rouleur, world champion: heavy, a real sprint out of a reduced group,
  // and the first of these five to suffer once the road tips up for long.
  { name: "PEDERSEN", team: "LIDL-TREK", mass: 78, h: 1.80, curve: { p5s: 1520, p1: 810, p5: 545, p20: 478, p60: 447, wp: 27 }, dura: 1.04 },
  // The best all-round engine in the break: strongest from one minute to ten, and the
  // fastest finish. If he is still there at the line, he wins.
  { name: "V.D.POEL", team: "ALPECIN-DECEUNINCK", mass: 75, h: 1.84, curve: { p5s: 1650, p1: 855, p5: 570, p20: 497, p60: 465, wp: 29 }, dura: 1.12 },
  { name: "VAN AERT", team: "JUMBO-VISMA", mass: 78, h: 1.90, curve: { p5s: 1640, p1: 850, p5: 585, p20: 508, p60: 476, wp: 30 }, dura: 1.1 },
  // The diesel, and the reason he rides breakaways: the flattest curve of the five, so he
  // goes from last of them to first once the effort passes twenty minutes. That is the
  // Stelvio and the Ventoux, not a six-minute kicker — on a hill this short he is the
  // worst man here. The tiny p5s and the small wp are the same rider from the other end:
  // no kick at all, so being together at the line is the one thing he cannot allow.
  { name: "DE GENDT", team: "LOTTO SOUDAL", mass: 72, h: 1.80, curve: { p5s: 1010, p1: 630, p5: 505, p20: 465, p60: 435, wp: 18 }, dura: 1.06 },
  // Light, quick, and a genuine finish from a small group — but 67 kg against a modest
  // threshold makes the flat the most expensive road in the race for him, dearer even
  // than it was for the 83-kilo man he replaces. In life he is the finest descender in
  // the peloton; here the road hands speed out by mass and frontal area alone, and there
  // is nowhere in the model for bike handling to live. Spelled without its háček the way
  // a race chyron does: the caron lives in the font's latin-ext block, and pulling that
  // in for one letter costs fifty-eight kilobytes on a three-hundred kilobyte page.
  { name: "MOHORIC",  team: "BAHRAIN VICTORIOUS", mass: 67, h: 1.80, curve: { p5s: 1280, p1: 695, p5: 485, p20: 428, p60: 400, wp: 23 }, dura: 0.96 },
];
