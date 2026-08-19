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

   merits, look and full are the same kind of dressing, for the rider card: merits is
   the palmarès in one short line, look drives the stylized portrait head (skin/hair
   hexes, style: bald|short|slick|curls|bandana|cap, extra: shades|goatee|sideburns|
   stubble|earring), and full is the whole name — the card says "Eddy Merckx", the
   road and the chyron keep the surname. Nothing in sim/ reads any of them.

   class is the DRAW's word, not the engine's: "sprinter" | "breaker" | "climber".
   The day's finale weights which classes get drawn (DRAW_W in tuning.js); once the
   race rolls, the six numbers are all anyone is. */

export const COLORS = ["#f5f2e9", "#ffd23f", "#2ec4b6", "#ff5d73", "#b78bfa", "#4d96ff"];

/* The player's body until the builder ships: the classics rouleur's numbers, the
   white jersey. Index 0 is the player everywhere — the pool below never includes him. */
export const PLAYER = { name: "PEDERSEN", full: "Mads Pedersen", team: "LIDL-TREK", color: "#f5f2e9", class: "breaker",
  mass: 78, h: 1.80, curve: { p5s: 1520, p1: 810, p5: 545, p20: 478, p60: 447, wp: 27 }, dura: 1.04,
  merits: "", look: { skin: "#e8c9a0", hair: "#7a5a30", style: "cap", extra: ["stubble"] } };

/* Twenty-three legends at the height of their careers — and the three Norwegians the
   user grew up with. The curves are best-year estimates anchored to the same
   physiology the engine already speaks: sprinters live above 1550 W for five seconds
   and pay for it uphill through mass; the breakaway men hold the biggest hour-powers
   and wear slowest; the climbers are the lightest men with the flattest curves —
   small absolute watts, enormous W/kg. Classes run 7 sprinters / 9 breakers /
   7 climbers; DRAW_W weighs the classes, so the split shifts the draw, not the race. */
export const POOL = [
  // ---- sprinters: the gallop, and the price of carrying it over the climb ----
  { name: "CIPOLLINI", full: "Mario Cipollini", team: "SAECO", color: "#ff3b30", class: "sprinter",
    mass: 73, h: 1.89, curve: { p5s: 1750, p1: 840, p5: 505, p20: 448, p60: 415, wp: 32 }, dura: 0.90,
    merits: "42 Giro stage wins · Milan-San Remo '02 · World Champion '02",
    look: { skin: "#d4a276", hair: "#2a2118", style: "slick", extra: ["shades", "stubble"] } },
  { name: "ZABEL", full: "Erik Zabel", team: "TELEKOM", color: "#ea4c9c", class: "sprinter",
    mass: 69, h: 1.76, curve: { p5s: 1580, p1: 790, p5: 495, p20: 430, p60: 400, wp: 30 }, dura: 1.02,
    merits: "6× Tour green jersey · 4× Milan-San Remo · 12 Tour stages",
    look: { skin: "#e8c9a0", hair: "#8a6b3a", style: "short", extra: [] } },
  { name: "CAVENDISH", full: "Mark Cavendish", team: "HTC-HIGHROAD", color: "#f4f4f4", class: "sprinter",
    mass: 70, h: 1.75, curve: { p5s: 1720, p1: 790, p5: 478, p20: 428, p60: 402, wp: 30 }, dura: 0.90,
    merits: "35 Tour stage wins · World Champion '11 · Milan-San Remo '09",
    look: { skin: "#e8c9a0", hair: "#3a2c1e", style: "short", extra: ["sideburns"] } },
  { name: "BOONEN", full: "Tom Boonen", team: "QUICK-STEP", color: "#1f6fd0", class: "sprinter",
    mass: 82, h: 1.92, curve: { p5s: 1700, p1: 855, p5: 555, p20: 485, p60: 452, wp: 32 }, dura: 1.10,
    merits: "4× Paris-Roubaix · 3× Tour of Flanders · World Champion '05",
    look: { skin: "#e2bd92", hair: "#5a432a", style: "short", extra: [] } },
  { name: "SAGAN", full: "Peter Sagan", team: "BORA-HANSGROHE", color: "#0d5c4d", class: "sprinter",
    mass: 78, h: 1.84, curve: { p5s: 1660, p1: 845, p5: 548, p20: 478, p60: 447, wp: 31 }, dura: 1.10,
    merits: "3× World Champion · 7× Tour green jersey · Roubaix and Flanders",
    look: { skin: "#e2bd92", hair: "#4a3320", style: "curls", extra: ["goatee"] } },
  { name: "HUSHOVD", full: "Thor Hushovd", team: "CREDIT AGRICOLE", color: "#7dbb42", class: "sprinter",
    mass: 83, h: 1.83, curve: { p5s: 1680, p1: 850, p5: 545, p20: 478, p60: 445, wp: 31 }, dura: 1.08,
    merits: "World Champion '10 · 2× Tour green jersey · 10 Tour stages",
    look: { skin: "#e2bd92", hair: "#2a2118", style: "short", extra: ["stubble"] } },
  { name: "KELLY", full: "Sean Kelly", team: "KAS", color: "#ffb400", class: "sprinter",
    mass: 74, h: 1.77, curve: { p5s: 1620, p1: 810, p5: 520, p20: 460, p60: 428, wp: 30 }, dura: 1.12,
    merits: "9 monuments · 4× green jersey · 7× Paris-Nice in a row",
    look: { skin: "#e2bd92", hair: "#3a2c1e", style: "short", extra: [] } },
  // ---- breakaway men: the biggest engines, the slowest wear ----
  { name: "MERCKX", full: "Eddy Merckx", team: "MOLTENI", color: "#e07f28", class: "breaker",
    mass: 74, h: 1.85, curve: { p5s: 1500, p1: 825, p5: 560, p20: 504, p60: 476, wp: 26 }, dura: 1.15,
    merits: "5× Tour · 5× Giro · 3× World Champion · 19 monuments",
    look: { skin: "#e8c9a0", hair: "#1e1a16", style: "short", extra: ["sideburns"] } },
  { name: "CANCELLARA", full: "Fabian Cancellara", team: "SAXO BANK", color: "#0b2545", class: "breaker",
    mass: 80, h: 1.86, curve: { p5s: 1560, p1: 845, p5: 578, p20: 508, p60: 478, wp: 29 }, dura: 1.12,
    merits: "4× TT World Champion · 3× Roubaix · 3× Flanders · Olympic gold",
    look: { skin: "#e2bd92", hair: "#2e2419", style: "short", extra: ["stubble"] } },
  { name: "VOIGT", full: "Jens Voigt", team: "CSC", color: "#8c1d40", class: "breaker",
    mass: 76, h: 1.90, curve: { p5s: 1290, p1: 745, p5: 540, p20: 482, p60: 452, wp: 26 }, dura: 1.10,
    merits: "Two days in yellow · 5× Critérium International · the Hour Record '14",
    look: { skin: "#e8c9a0", hair: "#a8834a", style: "short", extra: [] } },
  { name: "VOECKLER", full: "Thomas Voeckler", team: "EUROPCAR", color: "#00a651", class: "breaker",
    mass: 66, h: 1.77, curve: { p5s: 1340, p1: 715, p5: 495, p20: 442, p60: 412, wp: 24 }, dura: 1.05,
    merits: "10 days in yellow '04 and 10 more '11 · Tour KOM '12 · 4 Tour stages",
    look: { skin: "#e2bd92", hair: "#2a2118", style: "short", extra: [] } },
  { name: "DE GENDT", full: "Thomas De Gendt", team: "LOTTO SOUDAL", color: "#b00d10", class: "breaker",
    mass: 72, h: 1.80, curve: { p5s: 1010, p1: 630, p5: 505, p20: 465, p60: 435, wp: 18 }, dura: 1.06,
    merits: "Stage wins in all three grand tours · the Stelvio '12 · Ventoux '16",
    look: { skin: "#e8c9a0", hair: "#6b4a2a", style: "short", extra: ["stubble"] } },
  { name: "HINAULT", full: "Bernard Hinault", team: "RENAULT-ELF", color: "#f6d431", class: "breaker",
    mass: 62, h: 1.74, curve: { p5s: 1300, p1: 720, p5: 500, p20: 448, p60: 415, wp: 23 }, dura: 1.15,
    merits: "5× Tour · 3× Giro · 2× Vuelta · World Champion '80 — the Badger",
    look: { skin: "#d9b088", hair: "#241c14", style: "curls", extra: ["sideburns"] } },
  { name: "INDURAIN", full: "Miguel Indurain", team: "BANESTO", color: "#7fa8e6", class: "breaker",
    mass: 80, h: 1.88, curve: { p5s: 1400, p1: 800, p5: 565, p20: 502, p60: 474, wp: 24 }, dura: 1.15,
    merits: "5× Tour in a row · 2× Giro · the hour record '94",
    look: { skin: "#d4a276", hair: "#1e1a16", style: "short", extra: [] } },
  { name: "B.HAGEN", full: "Edvald Boasson Hagen", team: "TEAM SKY", color: "#1c2735", class: "breaker",
    mass: 76, h: 1.82, curve: { p5s: 1500, p1: 790, p5: 525, p20: 465, p60: 435, wp: 24 }, dura: 1.06,
    merits: "3 Tour stages · Gent-Wevelgem '09 · Norway's man for the hard finales",
    look: { skin: "#e8c9a0", hair: "#6b4a2a", style: "short", extra: [] } },
  { name: "LAURITZEN", full: "Dag Otto Lauritzen", team: "7-ELEVEN", color: "#ff6a3d", class: "breaker",
    mass: 72, h: 1.78, curve: { p5s: 1280, p1: 700, p5: 490, p20: 440, p60: 410, wp: 20 }, dura: 1.10,
    merits: "Luz Ardiden '87 — the first Norwegian Tour stage win · ex-paratrooper",
    look: { skin: "#e2bd92", hair: "#7a5a30", style: "short", extra: ["stubble"] } },
  // ---- climbers: small watts, light bodies, the wall is theirs ----
  { name: "PANTANI", full: "Marco Pantani", team: "MERCATONE UNO", color: "#ffd23f", class: "climber",
    mass: 57, h: 1.72, curve: { p5s: 1050, p1: 660, p5: 462, p20: 410, p60: 385, wp: 20 }, dura: 1.00,
    merits: "The Tour–Giro double '98 · fastest ascent of Alpe d'Huez ever ridden",
    look: { skin: "#d4a276", hair: "#2a2118", style: "bandana", extra: ["goatee", "earring"] } },
  { name: "CONTADOR", full: "Alberto Contador", team: "ASTANA", color: "#35b6b4", class: "climber",
    mass: 62, h: 1.76, curve: { p5s: 1250, p1: 710, p5: 492, p20: 442, p60: 410, wp: 22 }, dura: 1.05,
    merits: "2× Tour · 2× Giro · 3× Vuelta — seven grand tours",
    look: { skin: "#d9b088", hair: "#241c14", style: "short", extra: [] } },
  { name: "QUINTANA", full: "Nairo Quintana", team: "MOVISTAR", color: "#16357f", class: "climber",
    mass: 59, h: 1.67, curve: { p5s: 1000, p1: 635, p5: 458, p20: 415, p60: 388, wp: 18 }, dura: 1.02,
    merits: "Giro '14 · Vuelta '16 · twice runner-up at the Tour",
    look: { skin: "#a9713f", hair: "#151210", style: "short", extra: [] } },
  { name: "L.HERRERA", full: "Lucho Herrera", team: "CAFE DE COLOMBIA", color: "#e8a013", class: "climber",
    mass: 57, h: 1.69, curve: { p5s: 980, p1: 630, p5: 450, p20: 404, p60: 378, wp: 18 }, dura: 0.98,
    merits: "Vuelta '87 · KOM in all three grand tours · Alpe d'Huez '84",
    look: { skin: "#b47c48", hair: "#171310", style: "curls", extra: [] } },
  { name: "VIRENQUE", full: "Richard Virenque", team: "FESTINA", color: "#de5a6a", class: "climber",
    mass: 65, h: 1.79, curve: { p5s: 1150, p1: 680, p5: 484, p20: 435, p60: 402, wp: 20 }, dura: 1.05,
    merits: "7× Tour King of the Mountains · Ventoux '02 · Paris–Tours '01",
    look: { skin: "#e2bd92", hair: "#2c2015", style: "short", extra: [] } },
  { name: "COPPI", full: "Fausto Coppi", team: "BIANCHI", color: "#8fd8cf", class: "climber",
    mass: 66, h: 1.77, curve: { p5s: 1100, p1: 680, p5: 490, p20: 440, p60: 412, wp: 20 }, dura: 1.10,
    merits: "5× Giro · 2× Tour · the hour record · Il Campionissimo",
    look: { skin: "#d9b088", hair: "#1e1a16", style: "slick", extra: [] } },
  { name: "LEMOND", full: "Greg LeMond", team: "LA VIE CLAIRE", color: "#2f4de0", class: "climber",
    mass: 67, h: 1.78, curve: { p5s: 1200, p1: 700, p5: 495, p20: 445, p60: 415, wp: 21 }, dura: 1.08,
    merits: "3× Tour · 2× World Champion · the 8-second Tour of '89",
    look: { skin: "#e8c9a0", hair: "#8a6b3a", style: "curls", extra: [] } },
];

