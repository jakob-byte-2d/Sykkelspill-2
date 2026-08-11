import { COOP_MARGIN, COOP_PULL_MAX, COOP_PULL_MAX_UP, COOP_PULL_MIN, COOP_PULL_SPEND, COOP_REF, PULL_MIN_SF } from "../content/tuning.js";
import { bodyNow, spend, usableSurge } from "./body.js";
import { tagGroups } from "./groups.js";
import { stepPel } from "./peloton.js";
import { BIKE, G, SHEL_MAX, powerFor, rhoAt, shelterAt } from "./physics.js";
import { coopRide } from "./ride.js";
import { clamp } from "./rng.js";
import { working } from "./tactics.js";

/* One second of racing. */

export function pushEvent(S, txt) {
  S.events.unshift({ t: S.t, txt });
  if (S.events.length > 4) S.events.pop();
}

/* ---------------- One second of racing, one rider ---------------- */
export function stepRider(S, r, dt) {
  const C = S.course;
  r.prevDist = r.dist;
  const d = Math.max(r.dist, 0);
  const grad = C.gradAt(d), rho = rhoAt(C.eleAt(d)), hw = C.windAt(d);
  const b = bodyNow(r);
  r.sf = b.sf;   // published for the drop-back scan; readers see last turn's value

  // shelter: full behind the wheel, then fading — and it bleeds away over one bike
  // length while you move up alongside and past him
  let shel = 0, ahead = null, bestGap = 1e9;
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null) continue;
    const gap = ((o.d0 != null ? o.d0 : o.dist) - BIKE) - (r.d0 != null ? r.d0 : r.dist);
    const s = shelterAt(gap);
    if (s > shel) { shel = s; ahead = o; bestGap = gap; }
    else if (gap > 0 && gap < bestGap && shel === 0) { bestGap = gap; ahead = o; }
  }
  r.shel = shel;
  r.overlap = !!ahead && bestGap < 0 && shel > 0;

  // what he asks his legs for
  let P;
  let brake = 0;
  if (r.isPlayer && S.input.mode === "manual") {
    P = Math.min(S.input.watts, b.ceil);   // manual: your watts, your problem
  } else {
    // one rule for the whole break — the player in relay or sitting on rides it too
    const out = coopRide(S, r, b, ahead, bestGap, shel, grad, rho, hw);
    P = out.P; brake = out.brake;
  }
  // ...and whatever he ended up riding is published, in every mode. Left inside the
  // branch above it never updated while the player was steering, so the slider froze at
  // whatever the autopilot last did and the whole control looked dead.
  if (r.isPlayer) { S.playerW = Math.round(P); S.braking = brake; }

  // free body: propulsion against rolling, gravity and drag — speed now has inertia
  const v0 = Math.max(r.speed, 0.8);
  const va = v0 + hw;
  const Fdrive = (P * 0.975) / v0;
  const Froll = 0.004 * r.mass * G;
  const Fgrav = r.mass * G * grad;
  const Fdrag = 0.5 * rho * r.cda * (1 - shel) * Math.abs(va) * va;
  let v = v0 + ((Fdrive - Froll - Fgrav - Fdrag - brake) / (r.mass + 1.5)) * dt;
  v = clamp(v, 0.8, 33);

  r.speed = v;
  r.dist += v * dt;
  spend(r, P, dt, b, shel < 0.10);
}

/* ---------------- The whole field, one second ---------------- */
export function stepSim(S) {
  S.t += 1;
  const C = S.course;
  const player = S.riders[0];

  for (const r of S.riders) r.d0 = r.dist;   // one consistent snapshot for this second
  for (const r of S.riders) {
    if (r.caught || r.finished != null) continue;
    stepRider(S, r, 1);
  }

  stepPel(S);

  // the bunch swallows whoever it reaches
  for (const r of S.riders) {
    if (r.finished == null && !r.caught && S.pel.dist >= r.dist - 2) {
      r.caught = true;
      pushEvent(S, (r.isPlayer ? "You are" : r.name + " is") + " caught by the peloton");
    }
  }

  // the line
  for (const r of S.riders) {
    if (r.finished == null && !r.caught && r.dist >= C.total) {
      r.finished = S.t - (r.dist - C.total) / Math.max(r.speed, 1);
    }
  }

  tagGroups(S);
  // pay the front for the gift, not the clock: what he spends over what the same
  // second would have cost him sitting in. No terrain rule — the physics decides,
  // and gravity is a co-payer: the gift is weighted by the legs' share of the
  // propulsion, so a descent pays only for what the legs actually drive
  for (const g of S.groups) {
    if (g.length < 2) continue;
    const r = g[0];
    const d = Math.max(r.dist, 0);
    const sit = powerFor(r.speed, r.mass, r.cda, S.course.gradAt(d), rhoAt(S.course.eleAt(d)), S.course.windAt(d), SHEL_MAX);
    const pGrav = Math.max(-r.mass * G * S.course.gradAt(d), 0) * r.speed;
    const legs = r.power / Math.max(r.power + pGrav, 1);
    r.paid += legs * Math.max(r.power - sit, 0) / COOP_REF;

    // ...and then ask whether the turn is over. Two reasons end it, and the first
    // one to arrive wins: the ledger says he has done his share, or his body says
    // enough. The second is the one a rider actually feels — a turn on the front
    // sits above threshold and drains the tank, and he swings off while he can
    // still get it back in the wheels. Decided once here, so every reader agrees.
    if (r.pullMark == null) { r.pullMark = r.surge; r.pullT = 0; }
    r.pullT += 1;
    const b = bodyNow(r);
    const tot = g.reduce((s, o) => s + o.paid, 0);
    const paidUp = tot > 0 && r.paid / tot > 1 / g.length + COOP_MARGIN;
    // a small slice, because the front only sits a few points over threshold: measured
    // in play the pull runs at a median 1.03 × T, so 2 % of the tank is about forty
    // seconds of tempo — and far fewer where the road tips up and the gap widens
    const spent = r.surge < r.pullMark - COOP_PULL_SPEND * usableSurge(r);
    // an empty tank only ends the turn if someone fresher can take it on — and a
    // rester refilling at the back is no relief at all. When the whole break is
    // equally cooked, somebody still has to ride
    const empty = b.sf < PULL_MIN_SF && g.some((o) => o !== r && working(S, o) && (o.sf ?? 1) > b.sf);
    // ...and a clock, because uphill none of the three above can fire. The gift shrinks
    // to a fifth, a man under his threshold drains no tank, and a full one is not empty
    // — so the strongest climber would simply stay there for the whole climb. The clock
    // is set by what a wheel is actually worth here, which is the gift's own share of
    // his power: a third on the flat, six per cent at five, nothing on a wall.
    const worth = clamp((r.power - sit) / Math.max(r.power, 1), 0, 1);
    const k = clamp((worth - 0.05) / 0.25, 0, 1);
    const maxPull = COOP_PULL_MAX_UP + (COOP_PULL_MAX - COOP_PULL_MAX_UP) * k;
    // ...and a man riding his own climb is not taking a turn at all. The ledger would
    // end it in twelve seconds — over threshold, two per cent of the tank goes in eight
    // — and there is no such thing as an eight-second attack. Nor does a clock apply:
    // his climb ends when the hill does, and the hill decides that, not the rotation.
    // The tank can still end it early, and over the top the ledger takes over again —
    // hopelessly overpaid by then, so he sits up at the summit like anyone would.
    const over = r.digging ? empty : (paidUp || spent || empty || r.pullT >= maxPull);
    if (r.pullT >= COOP_PULL_MIN && over) r.done = true;
  }
  // the turn's bookkeeping: it opens when he reaches the front and closes for good
  // once he has drifted to the back — tagGroups ran above, so the positions are this
  // second's. Anyone not on the front is between turns and carries no mark.
  for (const r of S.riders) {
    if (r.groupPos !== 1) { r.pullMark = null; r.pullT = 0; }
    // the turn is over once nobody still working sits behind him. NOT "last in the
    // group": a rider sitting on parks at the very rear for good, so that test would
    // never come true again for anyone else and the flag would stick all race —
    // leaving every AI permanently offline and the rotation with no engine at all
    if (r.done && r.groupNo != null) {
      const g = S.groups[r.groupNo - 1];
      if (!g || g.length < 2 || !g.some((o) => o !== r && o.groupPos > r.groupPos && working(S, o))) r.done = false;
    }
  }
}

export function finalize(S) {
  let guard = 0;
  while (guard++ < 600 && S.riders.some((r) => r.finished == null && !r.caught)) stepSim(S);
  S.ended = true;
  const p = S.riders[0];
  const before = S.riders.filter((r) => !r.isPlayer && r.finished != null && r.finished < p.finished).length;
  S.result = { caught: false, place: before + 1 };
}
