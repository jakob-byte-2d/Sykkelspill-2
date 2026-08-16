/* ============================================================
   TUNING — every number that decides how the racing feels.
   No code here, and nothing in this file knows what a canvas is: it is the sheet
   a designer opens. The engine imports these; they never import the engine.
   ============================================================ */

export const COOP_SEED = 90;      // seconds of pulling everyone is credited at the start — they've rotated all day
export const COOP_REF = 140;      // watts of gift that count as one second's worth of pull
export const COOP_MARGIN = 0.10;  // the pull ends once your share is this many points over fair.
                           // Nobody in a break counts to the nearest five per cent: at that
                           // margin two turns in five ended at the twelve-second floor
export const COOP_BLEND = 6;      // over the last metres of the drop-back, watts blend up to the wheel price
export const COOP_PULL_SEC = 300; // a rotation pull sits about here on each rider's power–duration curve
export const COOP_PULL_SPEND = 0.09; // a turn also ends once it has cost this much of the tank you carried
                              // to the front. At two per cent the median turn ran twelve seconds —
                              // a full-gas through-and-off, which is what a break does when it is
                              // being hunted, not what one riding its own tempo all day does
export const COOP_PULL_MIN = 12;  // ...but no turn is shorter than this — a rotation that swaps every second is no rotation
export const COOP_PULL_MAX = 90;  // ...and on the flat none is longer: a wheel is worth a third of
                           // your power there, so real breakaway turns run 30-90 s
export const COOP_PULL_MAX_UP = 150; // ...but at five per cent a wheel is worth six, the swap stops
                              // paying for itself, and a real break settles into single file
                              // at its own tempo. Turns lengthen to match — only the
                              // seven-minute solo effort is ruled out.
export const COOP_COAST_KMH = 50; // past this speed a pace-setting effort buys nothing...
export const COOP_COAST_SPAN = 8; // ...watts tapering to zero over the next this-many km/h
export const PULL_MIN_SF = 0.3;   // under this much tank you stop taking turns — drop-backs slot in ahead of you
export const WHEEL_COOKED_SF = 0.2; // ...and under this much, his wheel is about to go backwards
export const WHEEL_DEAD_EDGE = 0.15; // ...but you only look through it if you hold this much more tank
                              // than him. Judged on a hair's difference, a break where everyone
                              // is empty dissolved: each man refused the next man's wheel (0.93
                              // dead-wheel pairs per second against 0.02 healthy) and rode beside
                              // it instead. Equally dead men keep the line — shelter is still
                              // free watts, and grinding on in a slow file is what a cooked
                              // break actually does
export const DOOR_NEAR = 10;      // this close ahead of a resting rider, a man dropping back becomes his wheel
export const SPRINT_FINALE_M = 1000; // inside this the ledger stops deciding: everyone holds a wheel
export const SPRINT_M = 200;      // the fastest man in the group can afford to wait until here...
export const SPRINT_LONG = 300;   // ...and the slowest opens from here, to try to blunt him
export const SWING_W = 80;        // swinging off, you ease this many watts below holding your own speed in the wind...
export const DROP_W = 80;         // ...and drift back at most this many watts below the wheel price
export const PEL_FINALE_X = 1.5;  // inside the finale the bunch rides this multiple of the benchmark
                           // threshold — a lead-out train, not a tempo
export const PEL_FINALE_M = 1000; // ...and the finale starts this many metres from the line
export const PEL_MASS = 68, PEL_CDA = 0.28;   // the bunch modelled as one body: this one
export const BRK_MASS = 76, BRK_CDA = 0.30;   // and the break as another: the man on the front
export const PACE_MARGIN = 15;    // seconds the break wants to cross the line ahead of the bunch
export const WARMUP_S = 60;       // seconds the move is ridden before the clock starts, so the player
                           // is handed a rotation that is already turning rather than five men
                           // dropped abreast on identical speeds
export const PEL_LEAD = -0.040;   // the bunch crosses the line this much earlier than the benchmark: one
                           // rider, alone in the wind, holding his threshold the whole way and
                           // never running out of fuel. Negative because that ride is a fiction —
                           // nobody has a tank that deep — so the bunch has to give some of it
                           // back. Tightened from -0.044 when the hunt and the in-window leash
                           // taught the break to chase its own escapees: riding a dangler back is
                           // riding hard, and survival rose ~8 points in both winds. At -0.040,
                           // over 80 seeds (1000 + s·7919), a headwind move survives 35/44 and a
                           // tailwind 28/36 — the same profile main measured before the hunt
                           // (35/44, 27/36), wind split preserved: headwind breaks outlive
                           // tailwind ones because cheap sitting-in matters most into the wind.
export const PACE_WINDOW = 20;    // seconds behind schedule that count as full alarm
export const PACE_GAIN = 0.5;     // at full alarm the front digs this much over the plan's base watts
export const DH_GRAD = -0.018;    // steeper than this is a descent — wheels don't die where speed is free
export const FUEL_START = 0.44;   // fraction of the tank left at the start — 150 km already in the legs
export const EFF = 0.225;         // gross efficiency, chemical energy to watts — a constant: the
                           // depleted body's weakness is priced once, in bodyNow's threshold
export const CARB_BASE = 0.30;    // glycogen's share of the bill at zero effort; rises linearly to all
                           // of it at threshold. The whole economics of sitting in: a wheel does
                           // not just cost fewer watts, it costs cheaper ones — fat pays the rest
/* ---- attacks: the cooperation's endgame ---- */
export const ATT_FROM = 8000;     // the racing-each-other window opens this far from the line...
export const ATT_SAFE = 42;       // ...but only once the bunch is this many seconds back: the gap the
                           // group built together is the capital an attack spends. Measured: races
                           // the break survives show 46 s here at 8 km, races it loses show 23
export const ATT_SPRINT_EDGE = 0.10; // motive one: you attack when your sprint gives away this share to
                              // the group's best — the man who loses the gallop must go early
export const ATT_ENGINE_EDGE = 0.05; // motive two: you attack when the rest of the course costs you this
                              // much less (as a share of what you can hold to the line) than it costs
                              // the next man — the strongest rider drops his passengers rather than
                              // tow them home
export const ATT_SF = 0.55;       // matches needed to fire: below this he LOADS instead — skips his
                           // turns, sits at the back and refills, the gun loading everyone can see
export const ATT_COMMIT = 75;     // seconds of full commitment before the attack is judged
export const ATT_COOL = 150;      // seconds before a brought-back attacker considers going again
export const ATT_KICK_T = 10;     // the opening jump: this many seconds at the burst ceiling before the
                           // attack settles into its dosing — an attack IS a sprint out of the group,
                           // and the alactic tank pays for it
export const ATT_REACT = 2;       // a jump is answered at once or not at all: seconds before a rider
                           // who chooses to cover it launches
export const ATT_FOLLOW_SF = 0.35; // the tank it takes to even try to go with an attack
export const ATT_FOLLOW_EDGE = 0.03; // the motive: you only follow a man you would beat (or match) in the
                              // sprint — being towed to the line by one who beats you is pointless
export const ATT_FOLLOW_N = 2;    // at most this many cover the move; the rest free-ride on the strongest
                           // closers, which is the whole game theory of a break
export const ATT_GIVEUP = 25;     // seconds of gap at which the chase stops bothering — "let him die
                           // out there" — and the group rides for the remaining placings
export const HUNT_DELAY = 50;     // seconds a defector must be clear before the group organises the
                           // chase: looks are exchanged, somebody shouts, the rotation lays
                           // itself over — and only then does the hunt (and its headline) begin.
                           // The clock does NOT reset on contact: touching the group's front is
                           // not being caught, and a man who kicks again mid-catch is answered at
                           // once. It resets only when he is properly swallowed — a wheel ahead
                           // of him in the line — which is also what ends the hunt itself.
export const CHASE_NEAR = 30;     // metres: closer than this is not a chase but a regain — the
                           // minimum-time dose solved a 15 m gap as a 15-second sprint (measured
                           // ~690 W on a fresh body, bang-banging at the 12 m group boundary)
export const CHASE_NEAR_W = 150;  // ...and a regain rides the wheel's price plus at most this many
                           // watts, ramping up with the gap so the handover to the real chase
                           // at CHASE_NEAR is seamless. What a rider actually does for 15 metres
/* ---- the player's attack, read off the physics ---- */
export const ATT_JUMP_X = 1.5;    // the gesture the group registers: watts above this multiple of the
                           // price of sitting in (the plan's pace at HIS shelter — the offline
                           // flag's reference, read the other way) while also above threshold
export const ATT_JUMP_T = 3;      // ...held this many seconds before it is an attack and not a slider
                           // twitch — then the AI's whole response machinery answers it
export const ATT_JUMP_DV = 0.8;   // ...and the part that makes it a JUMP: he must actually be pulling
                           // away — faster than the quickest of his companions by this much (m/s).
                           // Watts alone flagged a man grinding threshold in the wheels as an
                           // attacker nine races in fifteen; nobody attacks at the group's speed
export const ATT_REARM = 20;      // the breather after being brought back before a new jump can
                           // register. Short, unlike the AI's ATT_COOL: their discipline is
                           // self-imposed; a real second jump from the player must be answered

export const JUMP_TAU = 240;     // the alactic tank (the jump) refills on about this clock below
                           // threshold — roughly one jump per situation, the way
                           // creatine-phosphate actually behaves
export const SUL_N = 2;           // "shut up legs": times per race the governor can be silenced
export const SUL_T = 25;          // ...for this many seconds each time
export const SUL_WEAR = 0.5;      // ...billed afterwards at this multiple of the empty-tank wear rate.
                           // Half, not full: the reserve was real energy the governor hid, not
                           // energy that never existed — a full use costs about 0.06 wear
export const CLIMB_GRAD = 0.02;   // from here the road is "up"...
export const CLIMB_SMOOTH = 300;  // ...and a shelf shorter than this is a shelf inside the climb, not the top of it
export const CLIMB_MIN_T = 60;    // ...and under a minute of climbing there is nothing to pace
export const TERRAIN_EDGE = 0.10; // you lift when the pace costs the man it suits least this many points
                           // more of what he could hold to the top than it costs you. Measured
                           // over the climbs of five races: a tenth is the middle of the range,
                           // so the drags nobody would attack on stay quiet and the real ones do not
export const WHEEL_WARN_SF = 0.5; // the commentator calls the player's own lost wheel only above
                           // this much tank: the warning is a call to action — you HAVE the
                           // matches to close it — and a man losing the wheel empty is not
                           // being told anything he can use. Sits just under ATT_SF, the
                           // same "enough to do something about it" neighbourhood
export const WHEEL_NEAR = 20;     // metres around the player within which ANOTHER man losing his
                           // wheel is news: ahead of you it is a gap opening in front of the
                           // whole file, behind you it is the race leaving him
export const WHEEL_WARN_M = 3;    // the warning line, wheel to wheel: past this the wheel is GOING
                           // — shelterAt(3) still pays ~15 %, so it can yet be saved. DRAFT
                           // (12 m, the group split) is where it is gone; warning there was
                           // warning at the funeral. Measured: called at 3 m the news leads
                           // the real split by a median 11 s
export const WHEEL_WARN_DV = 1.0; // ...and only when it is OPENING: this many metres over the
                           // last two seconds. The file breathes 3-6 m of elastic that comes
                           // back on its own — measured over 40 seeds, without a rate test
                           // barely two in five 3 m departures reached a real split, and the
                           // rate test cut the false calls hardest (relay banners 2.6 → 1.5
                           // per race) while keeping every loss that mattered
export const TERRAIN_WHEEL = 0.16; // ...and only where a wheel is worth no more than this. On the flat it
                            // saves them a third of the work and the lift just tows them to the line.
                            // Read over the whole climb rather than at the wheel, what a wheel is worth
                            // at the foot of the 83 climbs in forty races runs 0.05 to 0.20 — so this
                            // sits mid-range: the slow hills where a lift bites are in, the fast
                            // shallow ones with the wind behind, where it would only tow, are out
