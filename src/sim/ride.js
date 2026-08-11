import { CLIMB_MIN_T, COOP_BLEND, DOOR_NEAR, DROP_W, PACE_GAIN, PACE_WINDOW, PULL_MIN_SF, SPRINT_FINALE_M, SPRINT_M, SWING_W, TERRAIN_EDGE, TERRAIN_WHEEL } from "../content/tuning.js";
import { durPower } from "./body.js";
import { BIKE, SHEL_MAX, coast, powerFor, powerRaw } from "./physics.js";
import { planSpeedAt, planTimeAt } from "./plan.js";
import { clamp } from "./rng.js";
import { deadWheel, dist0, launchAt, queueWheel, terrainEdge, validWheel, wantPos, wheelGap0, working } from "./tactics.js";

/* The decision, once per rider per second: how many watts, and why. */

/* The cooperative ride, shared by every AI in the break: one ledger, equal shares.
   In front you pull just over threshold and swing off once overpaid; in deficit you
   move up to pay — if you can actually ride the pace; otherwise you hold a wheel. */
export function coopRide(S, r, b, ahead, bestGap, shel, grad, rho, hw) {
  r.offline = 0;   // out of the line? set below in the two branches where you are
  r.digging = 0;   // ...and riding your own climb rather than the plan's tempo: only in front
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
    const sitting = r.isPlayer && S.sitting;  // the player as a rester: never pays, sinks to the back
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
    const tTop = Math.max(planTimeAt(S.plan, S.course.climbTopAt(r.dist)) - planTimeAt(S.plan, r.dist), 0);
    // ...and there is nothing to read where there is no climb: the duration is the
    // whole point of the reading, so with no summit ahead the question is not asked
    const e = finale || overpaid || resting || tTop < CLIMB_MIN_T
      ? null : terrainEdge(S, grp, r, grad, rho, hw, tTop);
    const mine = !!e && e.cheapest && e.spread >= TERRAIN_EDGE && e.wheel <= TERRAIN_WHEEL;
    // ...and the level he settles on is what he can hold to the top — which in a body
    // with a finite battery means the battery divided by the seconds still to climb.
    // He crests the summit empty, because that is what riding all the way to the top
    // costs. Never above his own curve for an effort that long either: the curve is the
    // other half of the same statement. There is no free constant left in it, and
    // nothing here knows which rider it is — the curve, the tank, the mass and the
    // frontal area say everything, so a new profile needs no new code.
    const digP = mine ? Math.min(b.T + r.surge / tTop, durPower(r, tTop, b.T), b.ceil) : 0;
    const front = grp[0];
    // "the front is done" is public: his own flag, or the player without the pull
    // button lit — position 2 rolls through on the SAME tick the front eases
    const frontDone = !finale && !inFront && (front.isPlayer && !S.pulling ? true : !!front.done);
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
        if (o.offline || (o.isPlayer && S.sitting)) continue;
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
    P = Math.min(0.92 * b.T, b.ceil);
    P = coast(P, r.speed);
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
