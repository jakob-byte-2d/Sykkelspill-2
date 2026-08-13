import { ATT_COMMIT, ATT_COOL, ATT_GIVEUP, ATT_HESIT, ATT_SF, CLIMB_MIN_T, COOP_BLEND, DOOR_NEAR, DROP_W, PACE_GAIN, PACE_WINDOW, PULL_MIN_SF, SPRINT_FINALE_M, SPRINT_M, SWING_W, TERRAIN_EDGE, TERRAIN_WHEEL } from "../content/tuning.js";
import { durPower } from "./body.js";
import { BIKE, DRAFT, SHEL_MAX, coast, powerFor, powerRaw, rhoAt, speedFor } from "./physics.js";
import { planSpeedAt, planTimeAt } from "./plan.js";
import { clamp } from "./rng.js";
import { attackerAhead, chaseTarget, deadWheel, dist0, launchAt, queueWheel, terrainEdge, validWheel, wantPos, wantsAttack, wheelGap0, working } from "./tactics.js";

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
  // The attack, mid-commitment: everything else waits. He rides what empties the tank
  // exactly at the end of the commitment — the same sentence as the dig and the chase —
  // and when the clock runs out he is either clear (a group of one: the solo branch
  // takes him to the line) or he is not, and the group has him back, on cooldown.
  if ((r.attT ?? 0) > 0) {
    r.attT -= 1;
    r.attacked = 1;
    r.hold = false; r.digging = 0;
    if (r.attT <= 0) {
      if ((r.groupSize ?? 1) > 1) { r.attacked = 0; r.attCool = ATT_COOL; r.attNews = 2; }
    }
    const tc = Math.max(r.attT, 15);
    return { P: Math.min(b.T + r.surge / tc, durPower(r, tc, b.T), b.ceil), brake: 0 };
  }
  // ...and brought back for good: the moment a gone attacker is swallowed by a group
  // again, the attack is over and the ledger's ordinary life resumes
  if (r.attacked && (r.groupSize ?? 1) > 1) { r.attacked = 0; r.attCool = ATT_COOL; r.attNews = 2; }
  if (grp && grp.length > 1) {
    const inFront = r.groupPos === 1;
    // inside the finale the ledger stops deciding: nobody owes anybody a turn any more,
    // everyone sits on a wheel and waits for his own moment. The man who ends up in
    // front still rides the plan, so the break does not stall and get swallowed.
    const finale = togo < SPRINT_FINALE_M;
    const sitting = r.isPlayer && S.input.mode === "sit";  // the player as a rester: never pays, sinks to the back
    // The attack decision, once a second: does the cooperation still serve me? If yes
    // but the tank is short, he LOADS — skips his turns and sits in to fill it, the
    // gun everyone can see being loaded — and fires the moment the matches are there.
    if (!finale && !r.isPlayer) {
      if (wantsAttack(S, grp, r)) {
        if (b.sf >= ATT_SF) {
          // fire, this very second: out of the line, full commitment
          r.attLoad = 0; r.attT = ATT_COMMIT; r.attAt = S.t; r.attNews = 1;
          r.hold = false; r.digging = 0;
          return { P: Math.min(b.T + r.surge / ATT_COMMIT, durPower(r, ATT_COMMIT, b.T), b.ceil), brake: 0 };
        }
        r.attLoad = 1;
      } else r.attLoad = 0;
    }
    // ...and the same idea for anyone: whoever is not working holds the back of the
    // line — including the man loading an attack, whose rest is the point
    const resting = sitting || (!r.isPlayer && ((r.sf ?? 1) < PULL_MIN_SF || r.attLoad));
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
    // The horizon never drops under CLIMB_MIN_T: inside the last minute the tank over
    // the seconds left is a sprint, and pacing is over — he holds what he has been
    // holding and crests on it, rather than emptying himself into the descent.
    const tPace = Math.max(tTop, CLIMB_MIN_T);
    // What he can hold to the summit — the dig rides it, and the men behind may not
    // go above it whatever the wheel in front is doing. Computed for everyone, and
    // computed BEFORE the claim below, because it is also the claim's own test.
    const holdTop = Math.min(b.T + r.surge / tPace, durPower(r, tPace, b.T), b.ceil);
    // ...and the plan's price for HIM right here: riding your own pace only means
    // anything if that pace beats the group's. A tired man whose summit power has
    // sunk below the tempo is not claiming the hill, he is being dropped politely —
    // and a claimant slower than the front never passes it, which once wedged the
    // whole rotation behind a position-two digger nobody could hand over to.
    const pPlan = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0);
    // Once he has said the hill is his, it stays his to the top. Asked afresh every
    // second the answer flips the moment his own effort makes him the second cheapest
    // man in the group — so he would hand the front back halfway up, which is the one
    // thing a rider committed to a climb never does. His body can still end it: an
    // empty tank ends a dig in stepSim, and a summit power fallen below the plan's
    // tempo ends the claim here — the hill has stopped being his.
    if (r.digTo != null && (r.dist >= r.digTo || finale || overpaid || resting || holdTop < pPlan)) r.digTo = null;
    const onward = r.digTo != null;
    // ...and there is nothing to read where there is no climb: the duration is the
    // whole point of the reading, so with no summit ahead the question is not asked
    const e = onward || finale || overpaid || resting || tTop < CLIMB_MIN_T
      ? null : terrainEdge(grp, r, len / Math.max(tTop, 1), gAvg, rhoAvg, hw, tTop);
    const mine = onward || (!!e && e.cheapest && e.spread >= TERRAIN_EDGE && e.wheel <= TERRAIN_WHEEL
      && holdTop > pPlan);
    if (mine && r.digTo == null) r.digTo = top;
    const digP = mine ? holdTop : 0;
    const front = grp[0];
    // "the front is done" is public: his own flag, or the player without the pull
    // button lit — position 2 rolls through on the SAME tick the front eases
    const frontDone = !finale && !inFront && (front.isPlayer && S.input.mode !== "relay" ? true : !!front.done);
    // The response to an attack. The group first looks at each other (ATT_HESIT), and
    // then exactly one man owns the chase: the best sprinter still available — he has
    // the most to lose if it sticks. Everyone else keeps the rotation's pace and holds
    // his wheel; towing the chase is HIS bill, which is why breaks hesitate at all.
    // Past ATT_GIVEUP seconds of gap the group lets him die out there and rides for
    // the placings — and an attacker nobody can afford to chase simply rides away.
    let chaseDuty = false, attUp = null;
    if (!finale && !r.isPlayer && !resting && !r.attLoad) {
      attUp = attackerAhead(S, r);
      if (attUp && attUp.attAt != null && S.t - attUp.attAt > ATT_HESIT) {
        const attGapS = (dist0(attUp) - dist0(r)) / Math.max(r.speed, 6);
        if (attGapS < ATT_GIVEUP) {
          let bx = -1, who = null;
          for (const o of grp) {
            if (o.isPlayer || (o.attT ?? 0) > 0 || o.attLoad || o.offline || (o.sf ?? 1) < PULL_MIN_SF) continue;
            if (o.sprintX > bx) { bx = o.sprintX; who = o; }
          }
          chaseDuty = who === r;
        } else attUp = null;
      } else attUp = null;
    }
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
        // ...and the chase's bill lands here when the chaser holds the front: the
        // closing power over the plan's, and no coast — closing a gap is racing
        if (chaseDuty && attUp) P = Math.max(P, chaseRide(S, r, b, attUp, grad, rho, hw));
      }
      if (!r.chasing) P = coast(P, r.speed);
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
      // the wave-in — but not with one who is coming off for good. An attacking wheel
      // is no wheel either: following the jump is the chaser's decision, not a reflex.
      const usable = tgt && !deadWheel(tgt, r) && !((tgt.attT ?? 0) > 0)
        && (sitting || validWheel(tgt, r, S.course.gradAt(Math.max(dist0(tgt), 0))));
      // the line hands over to the first man still in it — not literally position 2,
      // or a rester there would leave the break with no engine at all. A rider on an
      // empty tank is no engine either, so he is passed over too; but if nobody has
      // anything left, the fullest tank takes it anyway. Somebody still has to ride.
      // An attacker, a man loading one, or a man riding his own pace up a hill is
      // not in the rotation at all — hand the front to one of them and nobody rolls
      // through, which is exactly how a position-two digger once wedged the line.
      let nextUp = null, fullest = null;
      for (let k = 1; k < grp.length; k++) {
        const o = grp[k];
        if (o.offline || (o.attT ?? 0) > 0 || o.attLoad || o.digging || (o.isPlayer && S.input.mode === "sit")) continue;
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
        P = coast(digP, r.speed);
      } else if (chaseDuty && attUp) {
        // the chaser comes through the line and closes with the chase's own
        // arithmetic — what he can hold for as long as the catch takes
        r.hold = false;
        P = chaseRide(S, r, b, attUp, grad, rho, hw);
      } else if (r === nextUp && !sitting && (frontDone || !usable)) {
        // the front is done, or the wheel ahead is dying — ride through at the plan's
        // price, no more. The differential that swaps the positions is the OTHER man's:
        // he eases off at −SWING_W and falls below the plan's speed while you hold it.
        // A surcharge here (+SWING_W, as this read for a long time) accelerated the
        // whole line instead — the followers hold the roller-through's wheel, so his
        // extra watts became everyone's: measured over 776 handovers the group gained
        // a median 0.76 km/h at every change. A real through-and-off happens at the
        // group's own speed.
        r.hold = false;
        const behind = S.t - planTimeAt(S.plan, r.dist);
        const urgency = clamp(behind / PACE_WINDOW, 0, 1);
        const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
          * (1 + PACE_GAIN * urgency);
        P = coast(Math.min(pWant, r.pullX * b.T, b.ceil), r.speed);
      } else if (usable && (movingUp || r.hold || ((bestGap >= 0 || sitting) && shel > 0))) {
        const tgap = tgt === ahead ? bestGap : wheelGap0(tgt, r);
        const need = powerFor(tgt.speed, r.mass, r.cda, grad, rho, hw, shel);
        if (!r.hold) { r.hold = true; r.rampFrom = Math.max(r.power, isFinite(need) ? need : 0); r.rampT = 3; }
        // in the finale you match the jump or you lose the wheel — the soft cap that
        // keeps a rester from digging is exactly wrong once the sprint is on
        const out = wheelAutopilot(S, r, b, tgt, tgap, shel, need, grad, rho, hw, !movingUp && !finale);
        P = out.P; brake = out.brake;
        // ...and up a climb there is a level above which following him is not following
        // at all, it is blowing up in his wake. A rider knows that: he lets the wheel go
        // and rides what he can hold to the top, and as often as not he comes back over
        // it. Measured before this, one climbing second in eight was spent over that
        // level, and the half-minute before a man lost his group swung 140 W — a rider
        // cracking, not one making a choice. Only uphill: on the flat a wheel is worth a
        // third of the work, so hanging on always beats sitting up and the same rule
        // there would be nonsense. Not in the finale either, where you match it or lose.
        if (!finale && !movingUp && tTop >= CLIMB_MIN_T && P > holdTop) { P = holdTop; brake = 0; }
      } else {
        // No wheel to sit on: he has lost it, or the one ahead is dying and there is
        // nothing behind it to take. This was a flat 340 W — the one hardcoded wattage
        // in the whole ladder, and it knew nothing about his mass, his threshold, the
        // gradient, the wind, or how far up the road the wheel had gone. What a rider
        // does here is not a number: he rides what closes the gap. It is the question
        // the man alone off the back already asks, so it gets the same answer.
        r.hold = false;
        const lead = tgt || chaseTarget(S, r);
        const away = lead ? dist0(lead) - BIKE - dist0(r) : Infinity;
        if (!lead) {
          P = Math.min(0.92 * b.T, b.ceil);
        } else if (away < DRAFT) {
          // still in his wake, or alongside him: this is not a chase and must not be
          // priced as one. A chase solved for a four-metre gap asks for the tank over
          // ten seconds — seven hundred watts to regain a wheel he has not really lost —
          // and paid two seconds at a time it empties him by the finale. What it costs
          // to hold his speed from where he is sitting is the whole answer.
          P = Math.max(powerFor(lead.speed, r.mass, r.cda, grad, rho, hw, shel), 0);
        } else {
          P = chaseRide(S, r, b, lead, grad, rho, hw);
        }
        if (!r.chasing) P = coast(P, r.speed);
      }
    }
  } else {
    // Alone. Off the front there is nothing to read and nothing to chase, so the old
    // steady tempo stands. Off the back there is a wheel up the road, and the whole
    // question a dropped rider asks is whether he can reach it before the line.
    const lead = chaseTarget(S, r);
    let racing = false;
    if (!lead) {
      if (r.attacked) {
        // clear, and committed to the line: not the old steady 0.92 T but what he can
        // actually hold for exactly the distance left — the attack's whole arithmetic,
        // continued. He crosses the line empty, because that is what going alone costs.
        const tl = Math.max((S.course.total - r.dist) / Math.max(r.speed, 6), 30);
        P = Math.min(b.T + r.surge / tl, durPower(r, tl, b.T), b.ceil);
        racing = true;
      } else P = Math.min(0.92 * b.T, b.ceil);
    } else P = chaseRide(S, r, b, lead, grad, rho, hw);
    // ...and a chase is not tempo. coast() describes a pace-setting effort buying nothing
    // at speed, which is why the sprint is exempt from it too — a man closing a gap into
    // a tailwind at fifty-six an hour is doing neither of those things, he is racing.
    if (!r.chasing && !racing) P = coast(P, r.speed);
  }
  return { P, brake };
}

/* What a man rides when the wheel he wants is up the road. Sets r.chasing and returns
   the watts. Asked by the rider alone off the back and by the rider inside a group who
   has lost the wheel — it is the same question, so it has one answer. */
export function chaseRide(S, r, b, lead, grad, rho, hw) {
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
  return hold(r.chasing ? t : toLine);
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
