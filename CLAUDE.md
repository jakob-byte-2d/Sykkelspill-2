# The Breakaway — Legends 0.4

A one-thumb road-cycling simulation: you are in a five-man breakaway ~23 km from the
line, the peloton pacing to catch the best of you by a single second. Vite 5 + React
18, canvas rendering. The user speaks Norwegian; the game's text is English.

## Architecture (dependency order — never import upward)

```
src/content/   tuning.js (ALL constants), riders.js (PLAYER + POOL of 23 legends,
               7 sprinters / 9 breakers / 7 climbers incl. the Norwegians Hushovd,
               B.Hagen and Lauritzen, team+color+curve per man),
               stage.js (three finale archetypes: sprint/rouleur/climb, drawn by
               the seed's first roll; course.kind rides on the course object)
src/sim/       DOM-free, Node-importable. newRace → step (1 Hz) → ride/tactics/body/
               physics/plan/groups/peloton/commentary/events. Seed in, race out, same
               result every time.
src/render/    draw.js (canvas frame, roleOf status vocabulary, debug bubbles, name
               tags over every head but the player's; draw() RETURNS the riders'
               screen spots [{r,x,y}] — the UI's tap-a-rider hit-testing reads them)
src/ui/        TheBreakaway.jsx (React shell, controls, chyron, overlays; tapping a
               rider — canvas or build-screen row — opens the rider card: Portrait.jsx
               SVG head from the roster's look field, merits line, ratingsOf pips
               (builder.js — buildSpec's anchors inverted, one 1-10 scale for legends
               and builds alike); open pauses, close resumes), slider.js. merits/look
               are roster dressing like team/color — sim never reads them.
tools/         golden.mjs (the master check), bundle.mjs (artifact build), sweep/race/turns
```

## Iron rules (the user's standing instructions)

1. **One change at a time.** Implement, verify, ship, then the next thing.
2. **Measure first.** Before changing behavior, measure the current behavior headless;
   after, measure again. Claims need numbers, not impressions.
3. **Everything universal / attribute-based.** No rider-specific code, no hardcoded
   wattages. Behavior falls out of the roster's six numbers and the tuning constants.
   Real-cycling realism is the tiebreaker — when in doubt, ask "what does a real rider
   do?" and verify against real racing.
4. **After every shipped change:** commit + push, PR, merge to `main` AT ONCE, then
   rebuild the artifact from the merged content and republish it to the SAME URL
   (below). One change, one merge, one publish — never let a branch accumulate.
5. **Main is the truth — several chats work this repo in parallel** (sim/AI, UI,
   content), each on its own session branch. Before ANY work: `git fetch origin main
   && git merge origin/main` into the session branch. Sim changes re-record the golden
   fixture, so a branch that hasn't pulled main will see phantom golden diffs that are
   nobody's bug. Publish ONLY builds that contain main — a build from a stale branch
   overwrites other chats' shipped work on the artifact (it has happened; that rule is
   the fix).

## Verification pipeline

- `npm run golden` — 40 fixed seeds through the whole sim (finish times, work, wear).
  - **UI/render/commentary changes must leave golden IDENTICAL** (40/40). If it moved,
    you changed the sim by accident.
  - **Sim changes**: check balance first (below), then `npm run golden:write` and
    verify. Never re-record to make a red check green without understanding the delta.
- **Balance profile** (must hold after sim changes; measure over ~120 seeds
  `1000 + s*7919`, bucketed by `S.course.kind` — the legend pool is drawn, so
  measure by class, not by name): break survival 70–76 % in every archetype
  (measured after the paced attack kick + dosing reserve: sprint 74, rouleur 76,
  climb 73 over 120 seeds — the same seeds read 85/79/85 before the deadline
  deepened, because attackers who no longer wreck themselves make a faster
  break); attacks spread across the whole 15 km window and fire on low tanks
  (sf median 0.41 with the reserve banking matches); sprint days see real
  sprinter wins (13) though the gallop still leans breaker (KNOWN ISSUE, sim/AI
  work). KNOWN LEANS: climb-day wins run breaker 12 v climber 10 (watch it), and
  the headless relay-bot player wins a fair share (a perfectly paced legal
  escape is close to optimal play). A flat solo from the GUN must NOT win:
  `npm run solo` → 0 wire-to-wire (streak beginning before the window) and ≤8
  wins total (measured 0 — five men who never stop working reel everything).
  Knobs: PEL_LEAD master (−0.041) and PEL_LEAD_KIND trim
  ({sprint 0.006, rouleur −0.001, climb −0.015}).
- **Playwright smoke** at 430×860 AND 900×760 (chromium at `/opt/pw-browsers/chromium`,
  never `playwright install`): start race, poke the controls, screenshot, zero page
  errors (Google Fonts fetch errors are expected sandbox noise in dev; the bundle
  inlines fonts so the artifact has none).
- Headless scenario scripts: import `src/sim/index.js` from Node, drive `S.input` with
  `setInput`, step with `stepSim`. This is how every behavior claim gets its numbers.

## The test artifact (the user's playable build)

```
npm run build && npm run bundle        # writes dist/breakaway.html (self-contained)
```
Publish `dist/breakaway.html` to the EXISTING artifact — same URL every time:
`https://claude.ai/code/artifact/b6435f17-8ba5-4a83-89fc-11e8e2fca4d0`
(favicon 🚴; from a new conversation pass that URL as the Artifact tool's `url`
parameter, otherwise you create a new artifact instead of updating the user's).

## The builder (src/content/builder.js, the "build" UI phase)

Menu → ROLL OUT opens the builder: the day's finale type, profile strip (drawProfile
on a throwaway S), the four drawn opponents with team colors and class tags, then
WEIGHT in real kilograms (MASSES, ten 4 kg steps 50-86, costs no points) and four
attributes 1-10 under a BUILD_PTS=24 budget (all sixes = a balanced pro). Weight
prices itself through allometry (endurance power ∝ kg^0.75 — the pool's own hour
powers cluster at 16.6-18.9 on that scale): heavy buys absolute watts for the flat,
light buys W/kg for the wall, measured as a clean crossover (50 kg best on climb
days, 86 kg best on sprint days, no weight dominant everywhere). SPRINT stays linear
in mass (a sprint is muscle); monotonicity guards forbid impossible curves; ENGINE
is capped in W/kg AND absolute watts (6.9×kg / 480 / 512) so no build out-legends
the pool at either end of the scale. previewRace(seed) replays newSim's own opening calls on a fresh stream —
preview and race can never disagree. newSim(seed, playerSpec?) — no spec = PLAYER
row, which is what golden and every tool measures.

**The deadline's clock (refBody, newRace.js):** benchT/finaleP ride a FIXED reference
spec (the PLAYER row), NOT the built rider — keyed to the live player, a weak build
slowed the bunch and a strong one sped it up, cancelling the builder out. But the
reference borrows the day's drawn form/wear-noise from riders[0]: measured with the
day decoupled, a hot-form manual TT beat the fixed clock wire-to-wire and `npm run
solo` went red. Spec fixed, day shared. Headless note: specialist builds measure
poorly under the relay bot (it rotates dutifully — the worst strategy for a
sprinter); their case is human play (SIT ON, saved matches).

## The draw (newRace.drawOpponents)

Four of POOL's twenty-three, without replacement, each pick weighted by what the finale
pays his class (DRAW_W in tuning.js: sprint days lean sprinters, summit finishes lean
climbers). Drawn BETWEEN buildCourse and makeRiders on the same rng stream — so the
course is untouched by the draw (golden's total/wind fields prove placement) and the
draw can read course.kind. Player is always index 0 (PLAYER row until the builder
ships). `spec.color` is the jersey; the engine never reads team/color/class.

## The simulation in one page

- **Body (body.js):** power–duration curve p = a + b·ln(t) through 1/5/20-min points.
  Four stacked tanks: **FUEL** (glycogen; fat/carb split below threshold — a wheel
  costs cheaper watts, not just fewer), **SURGE** (W′, pays for watts above threshold,
  refills below), **JUMP** (alactic, pays for watts above the ceiling — any burstCeil
  effort: sprint, attack kick, cover jump; JUMP_TAU refill), **WEAR** (durability
  damage, never refills, divided by the roster's `dura`).
- **The hold formula** everywhere an effort is dosed: `min(T + surge/t, durPower(t), ceil)`.
- **Cooperation (ride.js/step.js):** one ledger, equal shares; front pulls just over
  threshold at the plan's price, swings off when paid up / spent / empty / clock —
  but never before COOP_PULL_MIN (20 s): a man who comes to the front commits to a
  real pull (measured: 1 of 1079 voluntary turn-ends under 20 s). Resting by TANK
  is GONE — sitting on is a CHOICE: loading a gun, or SULKING (`r.sulk`): a man
  who has paid more than fair share + margin while somebody able refuses to work
  (a loader, another sulker, or the PLAYER in SIT ON) stops working too. Shares
  sum to one, so sulks self-stabilize; in headless relay races sulk is ~0 s, but
  when the player freeloads it runs ~9 % of AI time (55 episodes / 8 races) —
  sit on too long and the break stops riding for you. An empty man still rotates:
  his pulls are soft and short, the body is the governor (PULL_MIN_SF now only
  gates the front-relief handover in step.js).
  `done` flag + `offline` (drifting down the outside) is the only lateral language —
  declared for AI, watts-derived for the manual player. A rester takes a drop-back as
  his wheel only when that man is the NEAREST ahead (wave-in); with anyone in between,
  the nearer wheel wins — a wheel choice never moves you backwards.
- **Attacks:** wantsAttack (sprint-loser or strongest-engine motives, window 15 km→1 km,
  bunch ≥ attCapital back — ATT_SAFE scaled by road left, 42 s at 8 km / ~79 s at
  15: an attack must outlive every kilometre it buys. The sprint-loser motive only
  exists where a GALLOP does — last km climbing voids it, or every outsprinted
  breaker attacked early on summit days and the field wrecked itself. "Let him
  die" scales the same way: giveUp = ATT_GIVEUP · road left / 8 km, and the two
  scales agree — a legal attack is beyond the leash the moment it fires),
  loading (skip turns to refill, visible gun — now RARE: ATT_SF 0.05 means a
  motive fires on whatever tank he has — the desperate flyer), kick =
  ATT_KICK_T seconds at `attKick` (ride.js): the man's own ~40 s curve power
  (ATT_KICK_HOLD), capped by burstCeil — a road attack is a half-minute effort
  out of a moving group, not a finish sprint (at raw burstCeil the median kick
  measured 1069 W = 16.6 W/kg; anchored, 566 W = 8.7 W/kg, the real 8–12 band;
  the jump still pays whatever tops the ordinary ceiling). Then dosing for
  ATT_COMMIT with a RESERVE: `T + (surge − ATT_RESERVE·usableSurge)/tc`, floored
  at T — the commitment spends most of the matches, never all (was 157/157
  attackers at sf < 0.05 within 2 min; now 36/171, sf after median 0.21 — the
  re-kick, the sprint and the ride-on live on what is kept back). The LAST move
  is the exception where it belongs: the solo-attacked branch doses on road
  left and still crosses the line empty. Covers open with the same attKick
  (an answer at raw burstCeil would out-kick the attacks it covers). Response =
  a CHOICE per rider, once, ATT_REACT after the jump: can I (sf), is it worth it
  (I beat him in a sprint), am I needed (≤ ATT_FOLLOW_N covers, rest free-ride).
  Non-followers refuse to be towed: `reacting()` wheels are nobody's to follow
  (queueWheel, usable, fallbacks, alone branch all look through them).
- **The player's attack is derived from physics** (step.js): over threshold, over
  1.5× the sit-in price, actually pulling away (ATT_JUMP_DV vs quickest companion),
  3 s sustained, never on a real descent → he gets the same att-state as an AI and the
  same machinery answers. Player cooldown is only a 20 s detector re-arm.
- **The hunt (huntTarget, tactics.js/ride.js/step.js):** a solo from the gun cannot
  win — the break brings back its own escapee, ALL the way in. The organisation
  takes HUNT_DELAY (50 s of standing clear, the clock `r.huntT` living on the
  escapee) before the alarm and the headline fire — looks exchanged, somebody
  shouts, the rotation lays itself over. Then a SMALLER knot of break riders ahead
  of a bigger one puts the front at FULL pace alarm (urgency 1 in pWant, still
  capped pullX·T); pre-window it never gives up, in-window the leash is ATT_GIVEUP
  made flesh (a dangler within 25 s is ridden back, through the finale like a
  lead-out; past 25 s "let him die" stands). Contact is NOT the catch: the clock
  holds at first touch and huntTarget's reel form targets the merged escapee at
  the group's own front, so the group rides THROUGH him (measured 9–15 s from
  contact to a wheel ahead of him); it resets only when he is swallowed or passed
  outright — a re-kick mid-catch is answered at once, no fresh grace, and a leader
  whose chasers splinter keeps his clock. A hunting front is `chasing`: coast()
  must not gut the alarm at 50+ km/h. A man ALONE and clear of a bigger group in
  the window is MARKED attacked (`attSoft`, no kick, news "rides clear") — but only
  on flattish road (CLIMB_GRAD > grad > DH_GRAD): on a climb the WALL does the
  selecting, and marking the strongest man edging away had every cooked pair behind
  burning 1200 W cover-jumps into the gradient, on repeat. And only WITH the
  attack's own capital (attCapital): the window opens the RIGHT to race, racing
  still costs the capital — an unmarked escapee is not racing, he is riding off,
  and huntTarget keeps owning him by the pre-window rules however deep into the
  window he slips (the leash band applies only to `reacting()` escapees). Without
  that split, a from-the-gun solo simply outlived the shortened hunt zone and
  npm run solo went red. Drifters get the cover
  choice re-asked every 60 s (once-only is about surprise — a dangler has none).
  Individual covers (the 2 s jump answer) are untouched by the delay. Events: "The
  break organises the chase behind you" (big) / brought back at ABSORPTION.
- **Steadiness (the jevnhet doctrine):** three rules keep the file calm. (1) Group
  membership has hysteresis (GRP_SPLIT 16 / GRP_JOIN 12, groups.js): you leave a
  group at 16 m and join at the 12 m draft line — one stateless line flipped
  hoverers every other second and everything reading sizes repeated the flutter
  (measured: 605→335 "drops"/45 races, transient <30 s 426→118). Do NOT tighten
  the join below the draft line: at 10 m scattered chasers could not reform into
  a hunting group and `npm run solo` went red. (2) chaseRide carries the summit-
  pacing lid: a man the climb shed rides HIS pace (holdTop, floored 0.9·T) back —
  no mid-climb sprint-and-shed cycles; the lid lifts inside the last minute of
  the climb and in the finale, so "back over the crest" still happens. (3) The
  drift-marking gradient gate above.
- **Statuses (roleOf, draw.js):** SPRINTING > ATTACKING > COVERING > CHASING >
  DROPPED/GOING SOLO > RIDING OWN PACE > PULLING > LOADING > SITTING ON > TURN DONE >
  RELAYING. "What he DOES beats what he wanted."
- **Commentary (commentary.js):** observation only, never touches watts. Urgent
  register (attack answered/ignored, gun loading, sprint opening, digs, a wheel above
  the player's climbing limit) fires the second it happens, once per INSTANCE — never
  muted by pacing. Colour register (form, fuel, wear, bunch trend) waits ≥ GAP_MIN and
  has per-rider AND per-topic cooldowns. Feed is `S.comm`; the news wire `S.events` is
  mirrored in.
- **The wheel warning (commentary.js):** fires on the FACT of a wheel going, caught
  early — past WHEEL_WARN_M (3 m) AND opening ≥ WHEEL_WARN_DV over the last 2 s,
  within WARN_GRACE of real contact (the file breathes elastic; DRAFT is the funeral).
  Leads the real split by a median 11 s. Choices don't count (offline/reacting/
  sprinting, either side), nor descents (DH_GRAD) or the finale; LOSS_COOL between
  calls per man. The player's own loss speaks only with sf ≥ WHEEL_WARN_SF (a call to
  action — he has the matches) and carries a subdued `big` headline, no numbers.
  Another man cracking within WHEEL_NEAR of the player: ahead = headline (a gap
  opening in front of the file), behind = feed line only.
- **Events/alerts (events.js):** `pushEvent(S, txt, big)` — `big` events force the UI
  to 1× and show the over-screen headline. Player's own actions are never `big`. Both
  step.js and commentary.js write the wire, which is why it is its own module: a leaf
  importing back up into step.js would be the engine's first import cycle. An event
  pushed from inside `stepComm` is never mirrored into `S.comm` — the mirror has
  already run for that second — so the wire and the feed carry their own wording.

## Controls (current semantics — changed 2026-08, don't regress)

- The slider moves ONLY the **instruction bubble** (setpoint, `S.input.watts`) — it
  never switches mode. The flat dark **indicator bubble** shows live watts.
- Buttons: MANUAL (legs ride the setpoint), RELAY (autopilot rotation, but the
  player's own pulls — front AND roll-through — ride the instruction watts,
  `min(setpoint, ceil)` and nothing else: no plan price, no dig lift, and no
  `coast()` taper either — an explicit order is not tempo, so RELAY delivers the
  same number MANUAL always did. Only the ceiling caps it), END TURN (in a break the
  man on the front says when he has had enough, not a ledger: in RELAY the turn lasts
  until this is pressed. `S.input.turn` decides who ends it — the UI sets `"manual"`
  at the gun, and `newRace`'s default `"auto"` keeps the rotation's own rules for
  headless runs, which is why golden and the balance profile still mean something.
  `endTurn` is a one-shot consumed every second, like `sul`. Refusing to end it while
  soft-pedalling — under the sit-in price − DROP_W — publishes `offline` and the line
  rolls past, the same watts-derived signal MANUAL has always sent), SIT ON (rester:
  never pays the ledger, swings off the front), HTFU! (2× per race W′ unlock), SPRINT
  (hold = burstCeil; release → MANUAL at threshold). Tempo column: pause (remembers
  interrupted speed) + 1/5/10/100×. Default/reset setpoint is 1.04·T — a normal pull,
  so headless races (golden/balance) rotate at the doctrine's price.
- **Behind a wheel, the player's autopilot is GLUE** (`playerGlue`, ride.js): in SIT ON
  and RELAY he holds the wheel unconditionally, body permitting — full wheelAutopilot
  authority (no rester soft cap), no summit-pacing cap, no speed-validity veto. What
  still lets go: the ceiling, a `reacting()` wheel (never towed into attacks), and the
  player's own hands. Gated on `S.input.turn === "manual"` — a human at the controls —
  so headless keeps the AI's judgement (unGated, the glue pushed tailwind survival to
  ~83 % and no PEL_LEAD value could restore the wind split). The wheel warning
  (commentary) is the glue's voice: it tells you when holding is about to cost the tank.
- **SIT ON holds the SLOT too** (`sitGlue`, ride.js): the sitting player's wheel is
  literally the NEAREST man ahead still in the line — a dying wheel included (no
  deadWheel veto, no queueWheel see-through; only offline drop-backs and `reacting()`
  wheels are looked through), and he keeps his position until a rider comes up on his
  wheel from behind, on the wheel AND closing (> +0.15 m/s inside DOOR_NEAR; a queue
  follower merely sitting there never trips it). Then he yields exactly one slot: the
  drop-back blend eases him aside at price − DROP_W and lands him on the passer's
  wheel. Swinging off the front he sinks through the passing train and re-enters where
  his speed matches (ahead of any non-closing tail). Wave-in only applies to him when
  he is LAST — mid-line a drop-back passes on the outside, and following it down would
  tow him out of his slot. RELAY keeps the queueWheel see-through unchanged.
- **The player NEVER enters chase autopilot.** In RELAY and SIT ON, with no usable
  wheel to hold (dropped, lost the wheel, alone/clear), the legs ride the instruction
  — `min(setpoint, ceil)` + coast. Getting back on is the slider's job. The AI's
  chaseRide has a near-zone instead (CHASE_NEAR/CHASE_NEAR_W): inside 30 m a regain
  costs the wheel's price + ≤150 W, not the minimum-time "empty the tank in 15 s"
  dose that used to bang-bang 690 W at the 12 m group boundary.
- Finale (< 1000 m): RELAY/SIT ON disabled, forced MANUAL, flamme rouge event.
- Player strip under his rider on canvas: role + watts + km/h. Debug bubbles via DBG.

## Gotchas

- `spend()` drains JUMP for ANY P > ceil (all burstCeil branches) — don't gate on
  sprinting.
- `attChase` is a RIDER REFERENCE (player is index 0 — an index sentinel can't work).
- Mid-tick queue geometry reads the `d0` snapshot (`dist0()`), not `dist`.
- `Math.random()` is banned in sim (mulberry32 from the seed; hashes for variants).
- sed-style bulk renames have broken this repo before — edit deliberately.
- Scratchpad measurement scripts die with the session; anything worth keeping goes in
  `tools/`.
