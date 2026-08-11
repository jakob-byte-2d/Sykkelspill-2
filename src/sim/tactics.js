import { DH_GRAD, PULL_MIN_SF, SPRINT_LONG, SPRINT_M, WHEEL_COOKED_SF } from "../content/tuning.js";
import { bodyNow, durPower } from "./body.js";
import { BIKE, SHEL_MAX, powerFor } from "./physics.js";
import { planSpeedAt } from "./plan.js";

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
// look through a wheel that is about to die — unless you are no better off yourself,
// in which case there is nothing better to sit on and you may as well take it
export const deadWheel = (o, r) => (o.sf ?? 1) < WHEEL_COOKED_SF && (r.sf ?? 1) > (o.sf ?? 1);

// whoever is actually taking his turn: role decides it for the player, the tank for
// everyone else — and nobody drifting back down the outside counts as a turn-taker
export const working = (S, o) => !o.offline && (o.isPlayer ? S.input.mode !== "sit" : (o.sf ?? 1) >= PULL_MIN_SF);

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
export function terrainEdge(S, grp, r, grad, rho, hw, tTop) {
  const v = planSpeedAt(S.plan, r.dist);
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

export function queueWheel(S, r, ahead) {
  if (!ahead) return ahead;
  let best = null;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null || o.offline || deadWheel(o, r)
      || !validWheel(o, r, S.course.gradAt(Math.max(dist0(o), 0)))) continue;
    if (dist0(o) > dist0(r) && (best == null || dist0(o) < dist0(best))) best = o;
  }
  return best || ahead;
}
