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
export const COOP_PULL_MIN = 20;  // ...but no turn is shorter than this — a rotation that swaps every
                           // few seconds is no rotation, and a man who comes to the front at all
                           // commits to a real pull (the user's rule: never under twenty). The
                           // player's END TURN is exempt — his turn is his to end
export const COOP_PULL_MAX = 90;  // ...and on the flat none is longer: a wheel is worth a third of
                           // your power there, so real breakaway turns run 30-90 s
export const COOP_PULL_MAX_UP = 150; // ...but at five per cent a wheel is worth six, the swap stops
                              // paying for itself, and a real break settles into single file
                              // at its own tempo. Turns lengthen to match — only the
                              // seven-minute solo effort is ruled out.
export const COOP_COAST_KMH = 50; // past this speed a pace-setting effort buys nothing...
export const COOP_COAST_SPAN = 8; // ...watts tapering to zero over the next this-many km/h
export const PULL_MIN_SF = 0.3;   // the front-RELIEF line only: an emptier front hands over once somebody
                           // fresher is there to take it (step.js). Resting by tank is GONE —
                           // sitting on is a CHOICE (loading a gun, or sulking at freeloaders);
                           // an empty man still rotates, his pulls just soft and short
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
export const PEL_LEAD = -0.041;   // the bunch crosses the line this much earlier than the benchmark: one
                           // rider, alone in the wind, holding his threshold the whole way and
                           // never running out of fuel. Negative because that ride is a fiction —
                           // nobody has a tank that deep — so the bunch has to give some of it
                           // back. Shallowed again (-0.050 → -0.049 with softer KIND trims)
                           // when resting-by-tank was removed: a rotation where NOBODY sits
                           // out on a low tank is faster, and survival ran 75/85/82 at the
                           // old deadline. At these values all three archetypes measure
                           // 72/76/76 over 120 seeds (1000 + s·7919).
export const PEL_LEAD_KIND = { sprint: 0.006, rouleur: -0.001, climb: -0.015 };
                           // ...per finale archetype, added to PEL_LEAD. One deadline knob
                           // cannot serve three terrains: the benchmark (the player's
                           // threshold ride) is cheapest to beat on flat roads and dearest
                           // on a summit finish. Re-based twice: for the 15 km racing
                           // window, then again when resting-by-tank went (the no-rest
                           // rotation gains most where cooperation is longest — rouleur
                           // days ran 85 % before the softer trim). Measured 72/76/76.
export const DRAW_W = {          // the day's finale weights which classes get drawn as the
  sprint:  { sprinter: 0.50, breaker: 0.30, climber: 0.20 },   // player's four companions —
  rouleur: { sprinter: 0.30, breaker: 0.40, climber: 0.30 },   // the men who go in the move
  climb:   { sprinter: 0.20, breaker: 0.30, climber: 0.50 },   // are the men the finish suits
};
export const EVENT_NEAR = 25;     // a red headline (and the 1x slam it forces) is only owed for
                           // things happening this close ahead of or behind the player —
                           // an attack fired 200 m up the road is chyron news, not an alarm
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
export const ATT_FROM = 15000;    // the racing-each-other window opens this far from the line —
                           // most of the race, in a 20-25 km finale: the cooperation is only
                           // sacred for the opening kilometres, and a break with the legs can
                           // go long. Moved from 8000 (where every attack fired in the same
                           // 8-5 km slot); the capital rule below and the 25 s leash still
                           // make an early move expensive to stick...
export const ATT_SAFE = 42;       // ...but only once the bunch is this many seconds back: the gap the
                           // group built together is the capital an attack spends. Measured: races
                           // the break survives show 46 s here at 8 km, races it loses show 23
export const ATT_SAFE_M = 8000;   // ...and that price was set for 8 km of exposure. Beyond it the
                           // requirement scales with the road left (42 s at 8 km, ~79 s at 15),
                           // because an attack must outlive every kilometre it buys: priced flat,
                           // opening the window at 15 km fired 276 attacks in the first three
                           // kilometres of it — the untouched 65-105 s start cushion read as
                           // capital — and climb-day survival fell 70 % → 30 %. Inside 8 km
                           // nothing changes: the flat rule IS the scaled rule there.
export const ATT_SPRINT_EDGE = 0.10; // motive one: you attack when your sprint gives away this share to
                              // the group's best — the man who loses the gallop must go early
export const ATT_ENGINE_EDGE = 0.05; // motive two: you attack when the rest of the course costs you this
                              // much less (as a share of what you can hold to the line) than it costs
                              // the next man — the strongest rider drops his passengers rather than
                              // tow them home
export const ATT_SF = 0.05;       // matches needed to fire: barely any — a rider with a motive goes on
                           // what he has (the jump tank pays the kick; the dosing after is near
                           // threshold — the desperate flyer, as real racing knows him). Below
                           // even this he LOADS: skips turns and refills, the visible gun —
                           // now rare, where it used to be every attack's prelude (was 0.55)
export const ATT_COMMIT = 75;     // seconds of full commitment before the attack is judged
export const ATT_COOL = 150;      // seconds before a brought-back attacker considers going again
export const ATT_KICK_T = 10;     // the opening jump: this many seconds at the kick wattage before the
                           // attack settles into its dosing — an attack IS a sprint out of the group,
                           // and the alactic tank pays for whatever tops the ordinary ceiling
export const ATT_KICK_HOLD = 40;  // ...but the kick is paced like a ~40 s effort, not a finish sprint:
                           // the curve read at this duration caps it (measured at the burst ceiling
                           // the median kick ran 1069 W = 16.6 W/kg — real attacks go 8-12 W/kg;
                           // anchored here it is the man's own half-minute-plus power, tired as
                           // he is, which is exactly what a road attack is)
export const ATT_RESERVE = 0.30;  // share of usable W′ the commitment dosing keeps back: an attacker
                           // does not zero his matches ON the attack — he keeps a re-kick and a
                           // sprint (measured pre-reserve, 157/157 attackers hit sf < 0.05 within
                           // two minutes). The LAST move — solo against the line — still empties
                           // everything: that branch doses on road left, not on the commitment
export const ATT_REACT = 2;       // a jump is answered at once or not at all: seconds before a rider
                           // who chooses to cover it launches
export const ATT_FOLLOW_SF = 0.35; // the tank it takes to even try to go with an attack
export const ATT_FOLLOW_EDGE = 0.03; // the motive: you only follow a man you would beat (or match) in the
                              // sprint — being towed to the line by one who beats you is pointless
export const ATT_FOLLOW_N = 2;    // at most this many cover the move; the rest free-ride on the strongest
                           // closers, which is the whole game theory of a break
export const ATT_GIVEUP = 25;     // seconds of gap at which the chase stops bothering — "let him die
                           // out there" — and the group rides for the remaining placings
export const GRP_SPLIT = 16;      // metres of wheel gap before a rider has LEFT the group...
export const GRP_JOIN = 12;       // ...and metres before a rider outside it has JOINED (the draft
                           // line, exactly where joining always happened). The old single line
                           // made membership stateless, and a man hovering at it flipped group
                           // every other second — measured, most "drops" lived six seconds,
                           // pure bookkeeping flutter that the gap rows, the statuses and every
                           // size-reading tactic (hunt, covers, launch) repeated out loud. Only
                           // the STAY side widened: tightening the join to 10 m kept scattered
                           // chasers from reforming into a hunting group and npm run solo went
                           // red — a wire-to-wire escape through a field that could not regroup.
                           // Physics never read the line — shelter has its own.
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
