import { ATT_ENGINE_EDGE, ATT_FROM, ATT_GIVEUP, ATT_SAFE, ATT_SAFE_M, ATT_SPRINT_EDGE, CLIMB_GRAD, DH_GRAD, HUNT_DELAY, PEL_FINALE_M, PULL_MIN_SF, SPRINT_FINALE_M, SPRINT_LONG, SPRINT_M, WHEEL_COOKED_SF, WHEEL_DEAD_EDGE } from "../content/tuning.js";
import { bodyNow, durPower } from "./body.js";
import { BIKE, SHEL_MAX, powerFor, rhoAt } from "./physics.js";
import { planTimeAt } from "./plan.js";

/* Reading the race: whose wheel is worth taking, whose is about to go backwards,
   who the road suits, and when each man has to open his sprint. */

// r.dist is the front of a rider's front wheel
export const wheelGap = (ahead, r) => (ahead.dist - BIKE) - r.dist;

// the tick steps riders one after another, so mid-tick some have moved and some have
// not — all queue geometry therefore reads the d0 snapshot taken at the top of the tick
export const dist0 = (r) => (r.d0 != null ? r.d0 : r.dist);

export const wheelGap0 = (ahead, r) => (dist0(ahead) - BIKE) - dist0(r);

// pure geometry: if anyone at all sits between you and your target, you take the
// wheel of the rearmost of them — the one nearest you — and the line forms by itself
// a wheel counts only if it holds your pace: more than 2 km/h slower than you and it
// is no wheel at all — except on a descent, where the deficit costs nothing and a
// freewheeling wheel is free to sit on
export const validWheel = (o, r, grad) => o.speed > r.speed - 2 / 3.6 || grad < DH_GRAD;

// the speed test above only fires once the deficit is already there, and a man on an
// empty tank lets go gently — slowly enough to pass it for a long while, and take
// whoever is on his wheel out the back with him. So read the tank, not just the pace:
// look through a wheel that is about to die — but only if you hold CLEARLY more than
// him, because looking through a wheel means having the legs to ride past it and away.
// Judged on a hair's difference, a break where everyone was empty dissolved: each man
// refused the next man's wheel and rode beside it. Equally dead men keep the line —
// shelter is still free watts, and a cooked break grinds on in a slow file.
export const deadWheel = (o, r) => (o.sf ?? 1) < WHEEL_COOKED_SF && (r.sf ?? 1) > (o.sf ?? 1) + WHEEL_DEAD_EDGE;

// whoever is actually taking his turn: role decides it for the player, CHOICE for
// everyone else (loading a gun or sulking at freeloaders is the only sitting-on
// there is — the tank no longer rests anybody) — and nobody drifting back down
// the outside counts as a turn-taker
export const working = (S, o) => !o.offline && (o.isPlayer ? S.input.mode !== "sit" : !(o.attLoad || o.sulk));

// whoever is racing an attack rather than riding the group's race: the attacker mid-
// commitment or clear, and any man who chose to cover the move. One word, because the
// same rule hangs on it everywhere — his wheel is nobody's to follow by reflex.
export const reacting = (o) => (o.attT ?? 0) > 0 || !!o.attacked || !!o.attChase;

// where he opens up, read off his sprint against the rest of his group. The fastest man
// can afford to wait on a wheel; the slowest has to go long and try to blunt him, which
// is the only card a man without a sprint has left to play.
export function launchAt(grp, r) {
  let lo = Infinity, hi = -Infinity;
  for (const o of grp) { if (o.sprintX < lo) lo = o.sprintX; if (o.sprintX > hi) hi = o.sprintX; }
  const t = hi > lo ? (r.sprintX - lo) / (hi - lo) : 1;
  return SPRINT_M + (SPRINT_LONG - SPRINT_M) * (1 - t);
}

// ...and where he wants to be sitting when it starts. The men who have to go long line
// up in front, in the order they will open — but the fastest man takes second wheel
// rather than last. Buried at the back he is displaced by every gap ahead of him when
// the line jumps, and no sprint on earth brings that back in two hundred metres.
export function wantPos(grp, r) {
  const order = [...grp].sort((a, o) => launchAt(grp, o) - launchAt(grp, a));
  const fastest = order[order.length - 1];
  if (r === fastest) return Math.min(2, grp.length);
  const k = order.indexOf(r);
  return k + 1 + (k + 1 >= 2 ? 1 : 0);
}

// Whose road is this? The price of the group's pace as a share of what each man could
// hold all the way to the top — frontal area on the flat, kilograms uphill, and a
// tiring man grows heavy either way. The spread between the cheapest and the dearest
// IS the terrain's verdict, and no rider has to be labelled a climber for it to come
// out right. Reported with what a wheel is worth here, which decides whether a lift
// sheds anybody at all or merely tows the group to the line.
// The speed, gradient and density are handed in rather than read at the wheel, because
// the question is asked about a whole climb and not about the metre he is standing on.
export function terrainEdge(grp, r, v, grad, rho, hw, tTop) {
  let mine = 1, best = Infinity, worst = 0;
  for (const o of grp) {
    if (o.caught || o.finished != null) continue;
    const c = powerFor(v, o.mass, o.cda, grad, rho, hw, 0) / Math.max(durPower(o, tTop, bodyNow(o).T), 1);
    if (o === r) mine = c;
    best = Math.min(best, c); worst = Math.max(worst, c);
  }
  const open = powerFor(v, r.mass, r.cda, grad, rho, hw, 0);
  const wheel = open > 1 ? 1 - powerFor(v, r.mass, r.cda, grad, rho, hw, SHEL_MAX) / open : 1;
  return { cheapest: mine <= best + 1e-9, spread: worst - best, wheel };
}

// Whose race is the REST of it? terrainEdge's question asked about everything left:
// the price of the plan's pace to the line as a share of what each man could hold
// that long. The man this comes out cheapest for, by a real margin, is the strongest
// rider for what remains — and every watt he gives the rotation tows his rivals home.
export function lineEdge(S, grp, r) {
  const total = S.course.total;
  const here = Math.max(r.dist, 0);
  const tLine = Math.max(planTimeAt(S.plan, total) - planTimeAt(S.plan, r.dist), 30);
  const len = Math.max(total - here, 1);
  const gAvg = (S.course.eleAt(total) - S.course.eleAt(here)) / len;
  const rho = rhoAt((S.course.eleAt(total) + S.course.eleAt(here)) / 2);
  const v = len / tLine, hw = S.course.windAt(here);
  let mine = 1, best = Infinity, second = Infinity, cheapest = null;
  for (const o of grp) {
    if (o.caught || o.finished != null) continue;
    const c = powerFor(v, o.mass, o.cda, gAvg, rho, hw, 0) / Math.max(durPower(o, tLine, bodyNow(o).T), 1);
    if (o === r) mine = c;
    if (c < best) { second = best; best = c; cheapest = o; } else if (c < second) second = c;
  }
  return { mine, second, cheapest: cheapest === r };
}

// What an attack COSTS from here: the capital rule, priced per kilometre of
// exposure. ATT_SAFE seconds buys the ATT_SAFE_M ride home; going earlier
// must outlive more road, so the requirement scales up with what is left —
// and inside ATT_SAFE_M the flat rule stands unchanged.
export const attCapital = (S, r) => ATT_SAFE * Math.max(1, (S.course.total - r.dist) / ATT_SAFE_M);

// ...and what the GROUP still bothers to chase, priced the same way: "let him die
// at 25 s" was set for 8 km of road — with more road left, dying takes longer and
// the leash reaches further (47 s at 15 km). The two scales agree by construction:
// a legal attack needs attCapital (42/25 higher), so the moment it fires it is
// already beyond the leash — while a drifter who never had the capital is still
// within reach and gets ridden back, however early he slipped away.
export const giveUp = (S, r) => ATT_GIVEUP * Math.max(1, (S.course.total - r.dist) / ATT_SAFE_M);

// The attack question, asked by every AI rider once a second: does the cooperation
// still serve ME? Two motives end it, both read off attributes. You lose the group's
// sprint by a real margin — the man who loses the gallop must go early. Or the rest
// of the course is clearly cheapest for you — the strongest man drops his passengers
// rather than tow them to a finish they will contest. Either way the attack only
// spends capital the group actually has: the window opens at ATT_FROM, and never
// while the bunch is close enough that he still needs these wheels to survive.
export function wantsAttack(S, grp, r) {
  if (r.isPlayer || (r.attCool ?? 0) > 0 || grp.length < 2) return false;
  const togo = S.course.total - r.dist;
  if (togo < SPRINT_FINALE_M || togo > ATT_FROM) return false;
  // never on a real descent — the same line the player's attack detector and
  // validWheel draw, because it is the same physics: downhill speed is terrain,
  // not a jump, and the W′ bill for a kick nobody can't follow is still full.
  // An attack OVER the crest (fired on the climb before the drop) stands.
  if (S.course.gradAt(Math.max(r.dist, 0)) <= DH_GRAD) return false;
  if ((S.pel.gapS ?? 0) < attCapital(S, r)) return false;
  if (grp.some((o) => o !== r && ((o.attT ?? 0) > 0 || o.attLoad))) return false;
  // motive one, the sprint-loser, only exists where a GALLOP does: on a summit
  // finish the wall decides, not the flat kick, and "I lose the sprint" is no
  // reason to burn the break 15 km out. The same last-kilometre read that
  // cancels the bunch's lead-out — without it, every breaker outsprinted on
  // paper attacked early on climb days, the field wrecked itself on the wall,
  // and a steady solo (any steady solo) waltzed home past the wreckage.
  const total = S.course.total;
  const gallop = (S.course.eleAt(total) - S.course.eleAt(total - PEL_FINALE_M)) / PEL_FINALE_M < CLIMB_GRAD;
  if (gallop) {
    let bestX = 0;
    for (const o of grp) bestX = Math.max(bestX, o.sprintX);
    if ((bestX - r.sprintX) / bestX >= ATT_SPRINT_EDGE) return true;
  }
  const e = lineEdge(S, grp, r);
  return e.cheapest && (e.second - e.mine) >= ATT_ENGINE_EDGE;
}

// the attacker up the road, committed or clear — the man the group has to answer
export function attackerAhead(S, r) {
  let best = null;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null) continue;
    if (!((o.attT ?? 0) > 0 || o.attacked)) continue;
    if (dist0(o) > dist0(r) && (!best || dist0(o) < dist0(best))) best = o;
  }
  return best;
}

// the nearest man up the road, whoever he is riding with — what a rider alone off the
// back is looking at. Same scan as queueWheel, without any of its filters: a wheel you
// cannot yet sit on is still the wheel you are chasing.
export function chaseTarget(S, r) {
  let best = null;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null) continue;
    if (dist0(o) > dist0(r) && (best == null || dist0(o) < dist0(best))) best = o;
  }
  return best;
}

/* The hunt: before the racing-each-other window opens, a smaller knot of break
   riders clear off the front of a bigger one is not a move to be covered — it is
   a defection the cooperation answers TOGETHER. The group behind rides it back at
   full pace alarm until the road is whole again, and it never gives up before the
   window: the lift is capped at the doctrine's pull price, so chasing hard is
   also just staying away from the bunch. Never the other way round — cracked
   riders chasing back on are the smaller group, and the race does not wait. */
export function huntTarget(S, grp, r) {
  if (grp.length < 2) return null;
  const togo = S.course.total - r.dist;
  // the reel: contact has been made — the man on the point of MY OWN group still
  // carries the hunt clock (step.js holds it until he is swallowed), and touching
  // him is not catching him. The group keeps the alarm and rides THROUGH him,
  // and only a wheel ahead of him in the line ends it.
  const front = grp[0];
  if (front !== r && (front.huntT || 0) >= HUNT_DELAY) return front;
  let best = null;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null) continue;
    if ((o.groupSize ?? 1) >= grp.length) continue;
    // ...and the group only ORGANISES after the defector has been clear a while:
    // the clock lives on him, ticks while a bigger group sits behind him, and
    // does not restart at contact — a re-kick mid-catch is answered at once
    if ((o.huntT || 0) < HUNT_DELAY) continue;
    if (dist0(o) > dist0(r) && (!best || dist0(o) < dist0(best))) best = o;
  }
  if (!best) return null;
  if (togo <= ATT_FROM && reacting(best)) {
    // inside the window, a RACING escapee (marked or kicked — he had the capital)
    // is chased on the leash: "let him die" only means something if under the
    // leash there IS a chase — the covers are one answer, the front's tempo the
    // other. Past it, the group rides for the placings. It reaches through the
    // finale too, like a lead-out. An UNMARKED escapee — clear without the
    // attack's capital — is not racing, he is riding off: the pre-window rules
    // keep owning him, however deep into the window he slips, and the hunt
    // never gives up on a man who never bought the right to be let go.
    const gapS = (dist0(best) - dist0(r)) / Math.max(r.speed, 6);
    if (gapS >= giveUp(S, r)) return null;
  }
  return best;
}

export function queueWheel(S, r, ahead) {
  if (!ahead) return ahead;
  let best = null;
  for (const o of S.riders) {
    // a rider racing an attack — his own, or one he chose to cover — is not a wheel:
    // the line looks through him and reforms behind the next man at its own pace.
    // Going with the move is each rider's decision, never the queue's reflex.
    if (o === r || o.caught || o.finished != null || o.offline || reacting(o) || deadWheel(o, r)
      || !validWheel(o, r, S.course.gradAt(Math.max(dist0(o), 0)))) continue;
    if (dist0(o) > dist0(r) && (best == null || dist0(o) < dist0(best))) best = o;
  }
  return best || ahead;
}

// The TRAIN, and its last wheel: the contiguous chain from the group's first rider,
// broken where the gap — his rear wheel to the next man's front wheel — opens beyond
// one bike length. The glued player's wheel is this tail, not whoever happens to be
// nearest: a straggler dangling behind the train is not the line, and sinking in
// behind him parks you in his hole. Offline drop-backs and men racing attacks are
// looked through (the same eyes every wheel-pick has) and carry no contiguity —
// they ride the outside; the line's own spacing is what the chain measures. The
// asker himself is skipped the same way, which bounds the chain at his own slot
// when he is IN it: the phantom gap his bike leaves breaks the walk, and the tail
// ahead of him is simply the man in front — tight files ride exactly as before.
export function chainTail(grp, r, aheadOnly) {
  let tail = null, prev = null;
  for (const o of grp) {
    if (aheadOnly && dist0(o) <= dist0(r)) break;   // a wheel choice never moves you backwards
    if (o === r || o.offline || reacting(o)) continue;
    if (prev && wheelGap0(prev, o) > BIKE) break;   // the chain is broken here
    prev = o;
    tail = o;
  }
  return tail;
}
