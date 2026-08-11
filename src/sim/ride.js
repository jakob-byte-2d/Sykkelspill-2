import { CLIMB_MIN_T, COOP_BLEND, DOOR_NEAR, DROP_W, PACE_GAIN, PACE_WINDOW, PULL_MIN_SF, SPRINT_FINALE_M, SPRINT_M, SWING_W, TERRAIN_EDGE, TERRAIN_WHEEL } from "../content/tuning.js";
import { durPower } from "./body.js";
import { BIKE, SHEL_MAX, coast, powerFor, powerRaw, rhoAt, speedFor } from "./physics.js";
import { planSpeedAt, planTimeAt } from "./plan.js";
import { clamp } from "./rng.js";
import { chaseTarget, deadWheel, dist0, launchAt, queueWheel, terrainEdge, validWheel, wantPos, wheelGap0, working } from "./tactics.js";

/* The decision, once per rider per second: how many watts, and why. */

/* The cooperative ride, shared by every AI in the break: one ledger, equal shares.
   In front you pull just over threshold and swing off once overpaid; in deficit you
   move up to pay — if you can actually ride the pace; otherwise you hold a wheel. */
export function coopRide(S, r, b, ahead, bestGap, shel, grad, rho, hw) {
  r.offline = 0;   // out of the line? set below in the two branches where you are
  r.digging = 0;   // ...and riding your own climb rather than the plan's tempo: only in front
  r.chasing = 0;   // ...and chasing a wheel up the road: only when alone and not leading
  let P, brake = 0;
  const grp = r.groupNo != null ? S.groups[r.groupNo - 1] : null;
  const togo = S.course.total - r.dist;
  // ...and the last thing anyone does is empty the tank. It goes before every other
  // branch, and before coast(), which would otherwise wipe the watts out above 58 km/h
  // — coast describes tempo buying nothing at speed, not a sprint being impossible.
  r.launch = grp && grp.length > 1 ? launchAt(grp, r) : SPRINT_M;
  if (togo < r.launch) { r.sprinting = 1; return { P: b.ceil, brake: 0 }; }
  r.sprinting = 0;
  if (grp && grp.length > 1) {
    const inFront = r.groupPos === 1;
    // inside the finale the ledger stops deciding: nobody owes anybody a turn any more,
    // everyone sits on a wheel and waits for his own moment. The man who ends up in
    // front still rides the plan, so the break does not stall and get swallowed.
    const finale = togo < SPRINT_FINALE_M;
    const sitting = r.isPlayer && S.input.mode === "sit";  // the player as a rester: never pays, sinks to the back
    // ...and the same idea for anyone: whoever is not working holds the back of the line
    const resting = sitting || (!r.isPlayer && (r.sf ?? 1) < PULL_MIN_SF);
    // the turn was called over in stepSim — by the ledger or by his body, whichever
    // came first. It is a flag and not a sum, so it holds all the way down the
    // drop-back: recomputed, it would flick off the moment his tank started refilling
    // and he would latch back onto the front halfway home.
    // ...and in the finale nobody swings off and nobody rolls through: the rotation is
    // over, and a man who eased now would simply hand the race to the wheel behind him
    const overpaid = !finale && !!r.done;
    // The terrain read, made once and used twice: it decides both how hard he rides
    // when the road is his, and whether he comes to the front to ride it at all. A
    // climber who waited his turn in the rotation would attack about once a race.
    const here = Math.max(r.dist, 0);
    const top = S.course.climbTopAt(r.dist);
    const tTop = Math.max(planTimeAt(S.plan, top) - planTimeAt(S.plan, r.dist), 0);
    // ...read as a whole hill, not as the metre he is standing on. At the foot of a
    // three-kilometre climb the road under his wheels still reads one per cent and a
    // wheel is worth a third — judged there, every climb says "flat, sit in", and by
    // the time the gradient under him agrees he is most of the way up it. A rider
    // does not do that: he looks at the profile, sees four minutes at three and a
    // half, and knows at the bottom whether the hill is his. So the price is taken
    // at the climb's average gradient, at the average speed the plan holds over it.
    const len = Math.max(top - here, 1);
    const gAvg = (S.course.eleAt(top) - S.course.eleAt(here)) / len;
    const rhoAvg = rhoAt((S.course.eleAt(top) + S.course.eleAt(here)) / 2);
    // ...and once he has said the hill is his, it stays his to the top. Asked afresh
    // every second the answer flips the moment his own effort makes him the second
    // cheapest man in the group — so he would hand the front back halfway up, which is
    // the one thing a rider committed to a climb never does. His body can still end it:
    // an empty tank ends a dig in stepSim, the same as any other turn.
    if (r.digTo != null && (r.dist >= r.digTo || finale || overpaid || resting)) r.digTo = null;
    const onward = r.digTo != null;
    // ...and there is nothing to read where there is no climb: the duration is the
    // whole point of the reading, so with no summit ahead the question is not asked
    const e = onward || finale || overpaid || resting || tTop < CLIMB_MIN_T
      ? null : terrainEdge(grp, r, len / Math.max(tTop, 1), gAvg, rhoAvg, hw, tTop);
    const mine = onward || (!!e && e.cheapest && e.spread >= TERRAIN_EDGE && e.wheel <= TERRAIN_WHEEL);
    if (mine && r.digTo == null) r.digTo = top;
    // ...and the level he settles on is what he can hold to the top — which in a body
    // with a finite battery means the battery divided by the seconds still to climb.
    // He crests the summit empty, because that is what riding all the way to the top
    // costs. Never above his own curve for an effort that long either: the curve is the
    // other half of the same statement. There is no free constant left in it, and
    // nothing here knows which rider it is — the curve, the tank, the mass and the
    // frontal area say everything, so a new profile needs no new code.
    // The horizon never drops under CLIMB_MIN_T: inside the last minute the tank over
    // the seconds left is a sprint, and pacing is over — he holds what he has been
    // holding and crests on it, rather than emptying himself into the descent.
    const tPace = Math.max(tTop, CLIMB_MIN_T);
    const digP = mine ? Math.min(b.T + r.surge / tPace, durPower(r, tPace, b.T), b.ceil) : 0;
    const front = grp[0];
    // "the front is done" is public: his own flag, or the player without the pull
    // button lit — position 2 rolls through on the SAME tick the front eases
    const frontDone = !finale && !inFront && (front.isPlayer && S.input.mode !== "relay" ? true : !!front.done);
    if (r.hold && (shel === 0 || !ahead || (!sitting && !validWheel(ahead, r, S.course.gradAt(Math.max(dist0(ahead), 0)))))) r.hold = false;
    if (inFront) {
      r.hold = false;
      // done paying (or sitting): ease off rather than parachute — hold-your-own-speed
      // watts minus SWING_W, so the line comes past at a gentle, landable differential
      if (overpaid || sitting) r.offline = 1;   // pulled out — the line looks through you now
      if (overpaid || sitting) {
        P = Math.min(Math.max(0.10 * b.T, powerFor(r.speed, r.mass, r.cda, grad, rho, hw, 0) - SWING_W), b.ceil);
      } else {
        // the plan sets the pace, the body caps it: the front rides what the plan's
        // speed costs HIS body right here — softer than a dig while the break is on
        // schedule, and terrain and wind flow into the pull through powerFor. When
        // the deadline is threatened, urgency lifts him toward the dig. Banked time
        // is still insurance: ahead of schedule never slows the plan itself
        const behind = S.t - planTimeAt(S.plan, r.dist);
        const urgency = clamp(behind / PACE_WINDOW, 0, 1);
        const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
          * (1 + PACE_GAIN * urgency);
        P = Math.min(pWant, r.pullX * b.T, b.ceil);
        // ...and where the road is his, the plan's tempo is a wasted chance. pullX is
        // the price of a long turn in the wind and has no say in a dig; the body does
        if (mine) { r.digging = 1; P = Math.max(P, digP); }
      }
      P = coast(P, r.speed);
    } else if ((overpaid || sitting) && r.groupPos < grp.length) {
      r.offline = 1;   // drifting back down the outside — not a wheel anyone should take
      // his pull is done: 10 % of threshold on the way back — blending smoothly up to
      // the wheel price over the last metres, so he lands on the last wheel at its speed
      r.hold = false;
      // wave-in rule: cooked riders sit on the back — the drop-back
      // slots in ahead of them, on the last wheel still working
      let back = grp[grp.length - 1];
      for (let k = grp.length - 1; k >= 1; k--) {
        const o = grp[k];
        if (o === r) continue;
        // a rester must not qualify as a wheel to land on just because resting
        // refilled him, and nor must anyone drifting back down the outside
        if (working(S, o)) { back = o; break; }
      }
      const dback = dist0(r) - (dist0(back) - BIKE);   // land ON his wheel, not on top of him
      let k = clamp(1 - dback / COOP_BLEND, 0, 1);
      k = k * k * (3 - 2 * k);
      const price = powerFor(back.speed, r.mass, r.cda, grad, rho, hw, shel);
      const low = Math.max(0.10 * b.T, price - DROP_W);
      P = Math.min(low + (Math.max(price, low) - low) * k, b.ceil);
      P = coast(P, r.speed);
    } else {
      // a rester keeps the wheel right in front of him: the man dropping back into
      // that space IS his new wheel, not someone to look through. And he is happy to
      // go slower with him — the speed test is the working line's business, not his
      let tgt = ahead ? (sitting ? ahead : queueWheel(S, r, ahead)) : null;
      // in the finale he rides to his slot instead of just holding whatever wheel he
      // has. Sitting too far back, he takes the wheel of the man he wants to be behind
      // and comes up the outside to it — with the autopilot's full authority, because
      // this is the one move in the race that must not be left half-done.
      let movingUp = false;
      if (finale && !sitting) {
        const want = wantPos(grp, r);
        if (r.groupPos > want) { tgt = grp[want - 2] || grp[0]; movingUp = tgt !== r; }
      }
      // ...and once that man is close enough to be slotting in, he IS the wheel: follow
      // him down at his speed and the space opens by itself, for nothing. Holding the
      // line's wheel through the manoeuvre instead means braking to make room and then
      // digging to close what the brake cost — which is no way for a rester to ride.
      if (resting) {
        let dropper = null;
        for (const o of grp) {
          if (o === r || !o.offline || deadWheel(o, r)) continue;
          const behind = dist0(o) - dist0(r);
          if (behind > 0 && behind < DOOR_NEAR && (!dropper || behind < dist0(dropper) - dist0(r))) dropper = o;
        }
        if (dropper) tgt = dropper;
      }
      // a rester may go slower with a man rotating back — that is the whole point of
      // the wave-in — but not with one who is coming off for good
      const usable = tgt && !deadWheel(tgt, r)
        && (sitting || validWheel(tgt, r, S.course.gradAt(Math.max(dist0(tgt), 0))));
      // the line hands over to the first man still in it — not literally position 2,
      // or a rester there would leave the break with no engine at all. A rider on an
      // empty tank is no engine either, so he is passed over too; but if nobody has
      // anything left, the fullest tank takes it anyway. Somebody still has to ride.
      let nextUp = null, fullest = null;
      for (let k = 1; k < grp.length; k++) {
        const o = grp[k];
        if (o.offline || (o.isPlayer && S.input.mode === "sit")) continue;
        if (!fullest || (o.sf ?? 1) > (fullest.sf ?? 1)) fullest = o;
        if (nextUp == null && (o.sf ?? 1) >= PULL_MIN_SF) nextUp = o;
      }
      nextUp = nextUp || fullest;
      if (mine) {
        // the road is his, so he does not wait for the rotation to offer him the front:
        // he comes past the man riding tempo and rides his own climb. It is the one
        // place in the race where a man goes forward without being owed a turn — and
        // without it a climber would attack about once a race, whenever the rotation
        // happened to hand him the hill.
        r.hold = false;
        r.digging = 1;
        P = digP;
      } else if (r === nextUp && !sitting && (frontDone || !usable)) {
        // the front is done, or the wheel ahead is dying — ride through at the plan's
        // price plus the swing differential: enough to pass the man easing off at
        // −SWING_W, without burning a dig's worth of tank on every handover
        r.hold = false;
        const behind = S.t - planTimeAt(S.plan, r.dist);
        const urgency = clamp(behind / PACE_WINDOW, 0, 1);
        const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
          * (1 + PACE_GAIN * urgency);
        P = Math.min(pWant + SWING_W, r.pullX * b.T, b.ceil);
      } else if (usable && (movingUp || r.hold || ((bestGap >= 0 || sitting) && shel > 0))) {
        const tgap = tgt === ahead ? bestGap : wheelGap0(tgt, r);
        const need = powerFor(tgt.speed, r.mass, r.cda, grad, rho, hw, shel);
        if (!r.hold) { r.hold = true; r.rampFrom = Math.max(r.power, isFinite(need) ? need : 0); r.rampT = 3; }
        // in the finale you match the jump or you lose the wheel — the soft cap that
        // keeps a rester from digging is exactly wrong once the sprint is on
        const out = wheelAutopilot(S, r, b, tgt, tgap, shel, need, grad, rho, hw, !movingUp && !finale);
        P = out.P; brake = out.brake;
      } else {
        r.hold = false;
        P = Math.min(340, b.ceil);
      }
    }
  } else {
    // Alone. Off the front there is nothing to read and nothing to chase, so the old
    // steady tempo stands. Off the back there is a wheel up the road, and the whole
    // question a dropped rider asks is whether he can reach it before the line.
    const lead = chaseTarget(S, r);
    if (!lead) {
      P = Math.min(0.92 * b.T, b.ceil);
    } else {
      const gap = Math.max(dist0(lead) - BIKE - dist0(r), 1);
      // his pace, smoothed. A rotation swings half a metre a second either way, and raw
      // that noise would land straight in the chaser's watts
      if (r.chaseOf !== lead.i) { r.chaseOf = lead.i; r.chaseU = lead.speed; }
      else r.chaseU += (lead.speed - r.chaseU) / 8;
      // ...and the same sentence as a dig up a climb, with a different target: what he
      // can hold all the way to it. Two things cap that and they swap over by themselves
      // — for a short chase it is his curve read at those few seconds, for a long one it
      // is the tank divided by them.
      const hold = (t) => Math.min(b.T + r.surge / t, durPower(r, t, b.T), b.ceil);
      // speed follows from power and the time from speed, so it is solved by going round
      // three times: speed goes roughly as the cube root of watts, so it settles fast
      let t = clamp(gap, 15, 600);
      for (let k = 0; k < 3; k++) {
        const v = speedFor(hold(t), r.mass, r.cda, grad, rho, hw, 0, r.speed);
        t = v > r.chaseU + 0.05 ? clamp(gap / (v - r.chaseU), 10, 1200) : Infinity;
        if (!isFinite(t)) break;
      }
      // He chases if he would get there before the finish, and rides for the line if he
      // would not. No constant decides that, the road does — and because the power is
      // continuous in the time, the two answers meet at the boundary and he cannot
      // flicker between them.
      const toLine = Math.max((S.course.total - r.dist) / Math.max(r.speed, 6), 1);
      r.chasing = isFinite(t) && t < toLine ? 1 : 0;
      P = hold(r.chasing ? t : toLine);
    }
    // ...and a chase is not tempo. coast() describes a pace-setting effort buying nothing
    // at speed, which is why the sprint is exempt from it too — a man closing a gap into
    // a tailwind at fifty-six an hour is doing neither of those things, he is racing.
    if (!r.chasing) P = coast(P, r.speed);
  }
  return { P, brake };
}

/* The wheel autopilot, shared by the player and any AI that holds a wheel.
   Returns {P, brake}. `need` is the price of matching tgt at your shelter. */
export function wheelAutopilot(S, r, b, tgt, tgap, shel, need, grad, rho, hw, soft) {
  const damp = (tgt.speed - r.speed) * 160;   // bleed the raw speed difference — keeps the wheel-holding cycle shallow
  let want;
  if (tgap < 0) {
    // overlapping his wheel: steer on speed here too — aim slightly slower than him
    // so you drop back into the wake, and brake as hard as that requires
    const tv = tgt.speed + Math.max(tgap * 0.5, -1.5);
    const aDes = (tv - r.speed) * 0.6;
    const hold = powerRaw(r.speed, r.mass, r.cda, grad, rho, hw, shel);
    want = hold + ((r.mass + 1.5) * aDes * r.speed) / 0.975 + damp;
    // never chase while alongside him — at most the cost of the wheel itself
    want = Math.min(want, Math.max(powerRaw(tgt.speed, r.mass, r.cda, grad, rho, hw, SHEL_MAX), 0));
  } else {
    // steer on speed, not on his equilibrium wattage: over a summit his power demand
    // collapses while his speed climbs, and a watt-based reference reads that backwards
    const tv = tgt.speed + clamp(tgap * 0.35, -1.5, 1.5);
    const aDes = (tv - r.speed) * 0.5;
    const hold = powerRaw(r.speed, r.mass, r.cda, grad, rho, hw, shel);
    // the further you have slipped, the more it is allowed to spend hauling you back —
    // and once a real gap is open the cap anchors to your body, not to a need that
    // collapses downhill while he pulls away
    let cap = need + Math.min(50 + tgap * 25, 300);
    // matching a faster wheel needs real authority for a moment — granted in proportion
    // to the speed deficit, and gone the instant the speeds meet, so it can never surge
    cap += clamp((tgt.speed - r.speed) * 130, 0, 260);
    if (tgap > 2 && !soft) cap = Math.max(cap, b.T * 1.4);
    want = Math.min(hold + ((r.mass + 1.5) * aDes * r.speed) / 0.975 + damp, cap);
  }
  if (r.rampT > 0) {
    r.rampT -= 1;
    want = clamp(want, r.rampFrom - 40 * (4 - r.rampT), r.rampFrom + 40 * (4 - r.rampT));
  }
  if (want < 0) {
    // two fingers on the levers — going downhill, freewheeling alone is not enough
    return { P: 0, brake: clamp((-want * 0.975) / Math.max(r.speed, 2), 0, 250) };
  }
  return { P: Math.min(want, b.ceil), brake: 0 };
}
