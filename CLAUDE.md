# The Breakaway — Legends 0.3

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
  `1000 + s*7919`): break survival ≈ 77 % headwind / ≈ 78 % tailwind (34/44, 28/36);
  ~2.0/3.6 of 5 riders home by wind; sprinters (VAN AERT, V.D.POEL) win most. The
  attAt-based attack count now includes drift-marked danglers (~54/40 races, ~3/4
  clear) — kicked attacks alone are the old ~25/40. A flat solo from the gun must
  NOT win as a solo: `npm run solo` (12 seeds × {0.98…1.14}×T manual) → ≤2 wins
  total and NO wire-to-wire escape (longest clear-alone streak ≤ 600 s; the
  pre-hunt exploit measured 1078 s — surviving wins go through being caught and
  are sprints/late moves). Knobs live in tuning.js (PEL_LEAD is the master lever,
  −0.040).
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
  the window is MARKED attacked (`attSoft`, no kick, news "rides clear"); drifters
  get the cover choice re-asked every 60 s (once-only is about surprise — a
  dangler has none). Individual covers (the 2 s jump answer) are untouched by the
  delay. Events: "The break organises the chase behind you" (big) / brought back
  at ABSORPTION. PEL_LEAD -0.040 (hunting lifted survival ~8 pts in both winds).
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
