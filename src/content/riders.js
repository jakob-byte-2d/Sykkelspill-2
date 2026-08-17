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
   up on every climb or never be able to attack at all. The sanctioned exception is
   the pure sprinter: his W' runs far past what his aerobic gap predicts — a 30 kJ
   battery on a 425 W engine IS the sprinter, and without it he arrives at his own
   finale too empty to use the kick he lives for.

   dura is durability — how slowly the day wears him. Wear divides by it, and so does
   the wear he starts with, because a durable man also took less damage from the 150 km
   already ridden.

   team and color are chyron dressing plus the jersey on the road — the engine never
   reads either. Each man carries the team he is most bound to, in that kit's colour;
   the hexes are nudged for contrast against the sky and the grass and against each
   other, because a canvas sprite is four pixels of torso, not a photograph.

   class is the DRAW's word, not the engine's: "sprinter" | "breaker" | "climber".
   The day's finale weights which classes get drawn (DRAW_W in tuning.js); once the
   race rolls, the six numbers are all anyone is. */

export const COLORS = ["#f5f2e9", "#ffd23f", "#2ec4b6", "#ff5d73", "#b78bfa", "#4d96ff"];

/* The player's body until the builder ships: the classics rouleur's numbers, the
   white jersey. Index 0 is the player everywhere — the pool below never includes him. */
export const PLAYER = { name: "PEDERSEN", team: "LIDL-TREK", color: "#f5f2e9", class: "breaker",
  mass: 78, h: 1.80, curve: { p5s: 1520, p1: 810, p5: 545, p20: 478, p60: 447, wp: 27 }, dura: 1.04 };

/* Fifteen legends at the height of their careers, five to a class. The curves are
   best-year estimates anchored to the same physiology the engine already speaks:
   sprinters live above 1550 W for five seconds and pay for it uphill through mass;
   the breakaway men hold the biggest hour-powers and wear slowest; the climbers are
   the lightest men with the flattest curves — small absolute watts, enormous W/kg. */
export const POOL = [
  // ---- sprinters: the gallop, and the price of carrying it over the climb ----
  { name: "CIPOLLINI", team: "SAECO", color: "#ff3b30", class: "sprinter",
    mass: 73, h: 1.89, curve: { p5s: 1750, p1: 840, p5: 505, p20: 448, p60: 415, wp: 32 }, dura: 0.90 },
  { name: "ZABEL", team: "TELEKOM", color: "#ea4c9c", class: "sprinter",
    mass: 69, h: 1.76, curve: { p5s: 1580, p1: 790, p5: 495, p20: 430, p60: 400, wp: 30 }, dura: 1.02 },
  { name: "CAVENDISH", team: "HTC-HIGHROAD", color: "#f4f4f4", class: "sprinter",
    mass: 70, h: 1.75, curve: { p5s: 1720, p1: 790, p5: 478, p20: 428, p60: 402, wp: 30 }, dura: 0.90 },
  { name: "BOONEN", team: "QUICK-STEP", color: "#1f6fd0", class: "sprinter",
    mass: 82, h: 1.92, curve: { p5s: 1700, p1: 855, p5: 555, p20: 485, p60: 452, wp: 32 }, dura: 1.10 },
  { name: "SAGAN", team: "BORA-HANSGROHE", color: "#0d5c4d", class: "sprinter",
    mass: 78, h: 1.84, curve: { p5s: 1660, p1: 845, p5: 548, p20: 478, p60: 447, wp: 31 }, dura: 1.10 },
  // ---- breakaway men: the biggest engines, the slowest wear ----
  { name: "MERCKX", team: "MOLTENI", color: "#e07f28", class: "breaker",
    mass: 74, h: 1.85, curve: { p5s: 1500, p1: 825, p5: 560, p20: 504, p60: 476, wp: 26 }, dura: 1.15 },
  { name: "CANCELLARA", team: "SAXO BANK", color: "#0b2545", class: "breaker",
    mass: 80, h: 1.86, curve: { p5s: 1560, p1: 845, p5: 578, p20: 508, p60: 478, wp: 29 }, dura: 1.12 },
  { name: "VOIGT", team: "CSC", color: "#8c1d40", class: "breaker",
    mass: 76, h: 1.90, curve: { p5s: 1290, p1: 745, p5: 540, p20: 482, p60: 452, wp: 26 }, dura: 1.10 },
  { name: "VOECKLER", team: "EUROPCAR", color: "#00a651", class: "breaker",
    mass: 66, h: 1.77, curve: { p5s: 1340, p1: 715, p5: 495, p20: 442, p60: 412, wp: 24 }, dura: 1.05 },
  { name: "DE GENDT", team: "LOTTO SOUDAL", color: "#b00d10", class: "breaker",
    mass: 72, h: 1.80, curve: { p5s: 1010, p1: 630, p5: 505, p20: 465, p60: 435, wp: 18 }, dura: 1.06 },
  // ---- climbers: small watts, light bodies, the wall is theirs ----
  { name: "PANTANI", team: "MERCATONE UNO", color: "#ffd23f", class: "climber",
    mass: 57, h: 1.72, curve: { p5s: 1050, p1: 660, p5: 462, p20: 410, p60: 385, wp: 20 }, dura: 1.00 },
  { name: "CONTADOR", team: "ASTANA", color: "#35b6b4", class: "climber",
    mass: 62, h: 1.76, curve: { p5s: 1250, p1: 710, p5: 492, p20: 442, p60: 410, wp: 22 }, dura: 1.05 },
  { name: "QUINTANA", team: "MOVISTAR", color: "#16357f", class: "climber",
    mass: 59, h: 1.67, curve: { p5s: 1000, p1: 635, p5: 458, p20: 415, p60: 388, wp: 18 }, dura: 1.02 },
  { name: "L.HERRERA", team: "CAFE DE COLOMBIA", color: "#e8a013", class: "climber",
    mass: 57, h: 1.69, curve: { p5s: 980, p1: 630, p5: 450, p20: 404, p60: 378, wp: 18 }, dura: 0.98 },
  { name: "VIRENQUE", team: "FESTINA", color: "#de5a6a", class: "climber",
    mass: 65, h: 1.79, curve: { p5s: 1150, p1: 680, p5: 484, p20: 435, p60: 402, wp: 20 }, dura: 1.05 },
];

