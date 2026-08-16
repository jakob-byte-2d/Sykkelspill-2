# The Breakaway — Legends 0.2

A one-thumb road-cycling simulation: you are in a five-man breakaway ~23 km from the
line, the peloton pacing to catch the best of you by a single second. Vite 5 + React
18, canvas rendering. The user speaks Norwegian; the game's text is English.

## Architecture (dependency order — never import upward)

```
src/content/   tuning.js (ALL constants), riders.js (roster: mass, h, curve, dura)
src/sim/       DOM-free, Node-importable. newRace → step (1 Hz) → ride/tactics/body/
               physics/plan/groups/peloton/commentary/events. Seed in, race out, same
               result every time.
src/render/    draw.js (canvas frame, roleOf status vocabulary, debug bubbles)
src/ui/        TheBreakaway.jsx (React shell, controls, chyron, overlays), slider.js
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
- **Balance profile** (must hold after sim changes; measure over 40–80 seeds
  `1000 + s*7919`): break survival ≈ 80 % headwind / ≈ 67 % tailwind; ~2.4–2.8 of 5
  riders home; sprinters (VAN AERT, V.D.POEL) win most; attack rate ~25/40 races with
  ~2/3 ridden clear. Knobs live in tuning.js (PEL_LEAD is the master lever, −0.044).
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

## The simulation in one page

- **Body (body.js):** power–duration curve p = a + b·ln(t) through 1/5/20-min points.
  Four stacked tanks: **FUEL** (glycogen; fat/carb split below threshold — a wheel
  costs cheaper watts, not just fewer), **SURGE** (W′, pays for watts above threshold,
  refills below), **JUMP** (alactic, pays for watts above the ceiling — any burstCeil
  effort: sprint, attack kick, cover jump; JUMP_TAU refill), **WEAR** (durability
  damage, never refills, divided by the roster's `dura`).
- **The hold formula** everywhere an effort is dosed: `min(T + surge/t, durPower(t), ceil)`.
- **Cooperation (ride.js/step.js):** one ledger, equal shares; front pulls just over
  threshold at the plan's price, swings off when paid up / spent / empty / clock.
  `done` flag + `offline` (drifting down the outside) is the only lateral language —
  declared for AI, watts-derived for the manual player. A rester takes a drop-back as
  his wheel only when that man is the NEAREST ahead (wave-in); with anyone in between,
  the nearer wheel wins — a wheel choice never moves you backwards.
- **Attacks:** wantsAttack (sprint-loser or strongest-engine motives, window 8 km→1 km,
  bunch ≥ ATT_SAFE back), loading (skip turns to refill, visible gun), kick =
  ATT_KICK_T seconds at burstCeil then dosing for ATT_COMMIT. Response = a CHOICE per
  rider, once, ATT_REACT after the jump: can I (sf), is it worth it (I beat him in a
  sprint), am I needed (≤ ATT_FOLLOW_N covers, rest free-ride). Non-followers refuse
  to be towed: `reacting()` wheels are nobody's to follow (queueWheel, usable,
  fallbacks, alone branch all look through them).
- **The player's attack is derived from physics** (step.js): over threshold, over
  1.5× the sit-in price, actually pulling away (ATT_JUMP_DV vs quickest companion),
  3 s sustained, never on a real descent → he gets the same att-state as an AI and the
  same machinery answers. Player cooldown is only a 20 s detector re-arm.
- **Statuses (roleOf, draw.js):** SPRINTING > ATTACKING > COVERING > CHASING >
  DROPPED/GOING SOLO > RIDING OWN PACE > PULLING > LOADING > SITTING ON > TURN DONE >
  RELAYING. "What he DOES beats what he wanted."
- **Commentary (commentary.js):** observation only, never touches watts. Urgent
  register (attack answered/ignored, gun loading, sprint opening, digs, a wheel above
  the player's climbing limit) fires the second it happens, once per INSTANCE — never
  muted by pacing. Colour register (form, fuel, wear, bunch trend) waits ≥ GAP_MIN and
  has per-rider AND per-topic cooldowns. Feed is `S.comm`; the news wire `S.events` is
  mirrored in.
- **The wheel warning (commentary.js):** on a climb (tTop ≥ CLIMB_MIN_T), the man
  immediately ahead priced at the player's own shelter against the hold formula to the
  summit — the same line ride.js caps an AI follower at. WHEEL_WARN_T seconds over it
  and the commentator says so, once per summit, feed line + `big` headline. Manual has
  no such governor, which is exactly who the warning is for.
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
  rolls past, the same watts-derived signal MANUAL has always sent), SIT ON (full
  autopilot rester on the AI rester's rules — wheelAutopilot's own soft cap holds the
  wheel; never pays the ledger), HTFU! (2× per race W′ unlock), SPRINT (hold =
  burstCeil; release → MANUAL at threshold). Tempo column: pause (remembers
  interrupted speed) + 1/5/10/100×. Default/reset setpoint is 1.04·T — a normal pull,
  so headless races (golden/balance) rotate at the doctrine's price.
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
