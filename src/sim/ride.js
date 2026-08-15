import { ATT_COMMIT, ATT_COOL, ATT_FOLLOW_EDGE, ATT_FOLLOW_N, ATT_FOLLOW_SF, ATT_FROM, ATT_GIVEUP, ATT_KICK_T, ATT_REACT, ATT_REARM, ATT_SAFE, ATT_SF, CHASE_NEAR, CHASE_NEAR_W, CLIMB_MIN_T, COOP_BLEND, DOOR_NEAR, DROP_W, PACE_GAIN, PACE_WINDOW, PULL_MIN_SF, SPRINT_FINALE_M, SPRINT_M, SWING_W, TERRAIN_EDGE, TERRAIN_WHEEL } from "../content/tuning.js";
import { burstCeil, durPower } from "./body.js";
import { BIKE, DRAFT, SHEL_MAX, coast, powerFor, powerRaw, rhoAt, speedFor } from "./physics.js";
import { planSpeedAt, planTimeAt } from "./plan.js";
import { clamp } from "./rng.js";
import { attackerAhead, chaseTarget, deadWheel, dist0, launchAt, queueWheel, reacting, terrainEdge, validWheel, wantPos, wantsAttack, wheelGap0, working } from "./tactics.js";

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
  // ...and the launch is all-out for everyone: the burst ceiling, not the ordinary
  // one — the jump opens near fresh p5s and fades as it drains, which is what a real
  // sprint looks like and why the man who saved his kick beats the man who is merely
  // least empty.
  if (togo < r.launch) { r.sprinting = 1; return { P: burstCeil(r, b), brake: 0 }; }
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
      // ...or the commitment ends with clear road behind him: the attack WORKED, and
      // that is the other headline — the moment the chase either organises or loses
      else r.attNews = 3;
    }
    // the opening seconds ARE a sprint — the burst ceiling, the jump paying for it.
    // A steady dosing from second one never left the wheels: measured, the median
    // gap after ten seconds was five metres. The kick is what an attack IS; the
    // dosing below is what SURVIVING one's own attack is.
    if (ATT_COMMIT - r.attT <= ATT_KICK_T) return { P: burstCeil(r, b), brake: 0 };
    const tc = Math.max(r.attT, 15);
    return { P: Math.min(b.T + r.surge / tc, durPower(r, tc, b.T), b.ceil), brake: 0 };
  }
  // ...and brought back for good: the moment a gone attacker is swallowed by a group
  // again, the attack is over and the ledger's ordinary life resumes. The player's
  // cooldown is only the detector's re-arm — the AI's long one is its own discipline
  if (r.attacked && (r.groupSize ?? 1) > 1) { r.attacked = 0; r.attCool = r.isPlayer ? ATT_REARM : ATT_COOL; r.attNews = 2; }
  // Covering the move: the man who CHOSE to go with an attack is racing, not rotating,
  // wherever the road has put him — still buried in the group, alone in between, or on
  // the attacker's wheel. It ends when the attack ends, when the gap says he lost the
  // wager, or when his own body does; the finale ends every private errand anyway.
  if (r.attChase) {
    const att = r.attChase;
    const gapS = (dist0(att) - dist0(r)) / Math.max(r.speed, 6);
    const on = !att.caught && att.finished == null
      && ((att.attT ?? 0) > 0 || att.attacked)
      && gapS < ATT_GIVEUP && b.sf >= 0.10 && togo >= SPRINT_FINALE_M;
    if (!on) { r.attChase = null; r.attChaseT = 0; }
    else {
      r.attChaseT = (r.attChaseT || 0) + 1;
      r.hold = false; r.digging = 0;
      const away = dist0(att) - BIKE - dist0(r);
      // on the wheel: covering costs the price of holding him from your shelter —
      // sitting on the attacker is the whole point of marking, not pulling him
      if (away < DRAFT) return { P: Math.min(Math.max(powerFor(att.speed, r.mass, r.cda, grad, rho, hw, shel), 0), b.ceil), brake: 0 };
      // still reaching for it: the answer to a jump is a jump — the burst ceiling,
      // his own matches burnt to hold the move. After that, the chase's arithmetic.
      if (r.attChaseT <= ATT_KICK_T) return { P: burstCeil(r, b), brake: 0 };
      return { P: chaseRide(S, r, b, att, grad, rho, hw), brake: 0 };
    }
  }
  if (grp && grp.length > 1) {
    const inFront = r.groupPos === 1;
    // inside the finale the ledger stops deciding: nobody owes anybody a turn any more,
    // everyone sits on a wheel and waits for his own moment. The man who ends up in
    // front still rides the plan, so the break does not stall and get swallowed.
    const finale = togo < SPRINT_FINALE_M;
    const sitting = r.isPlayer && S.input.mode === "sit";  // the player as a rester: never pays, sinks to the back
    const playerRelay = r.isPlayer && S.input.mode === "relay";  // his pulls ride the instruction bubble, not the plan's price
    // The attack decision, once a second: does the cooperation still serve me? If yes
    // but the tank is short, he LOADS — skips his turns and sits in to fill it, the
    // gun everyone can see being loaded — and fires the moment the matches are there.
    if (!finale && !r.isPlayer) {
      const fire = () => {
        r.attLoad = 0; r.attLoadT = 0; r.attT = ATT_COMMIT; r.attAt = S.t; r.attNews = 1;
        r.hold = false; r.digging = 0;
        // launched sprinting, not settling: the very first second is already the kick
        return { P: burstCeil(r, b), brake: 0 };
      };
      if (r.attLoad) {
        // loading is a COMMITMENT, not a per-tick opinion: judged afresh every second
        // it flickered off whenever the bunch gap wobbled around the safety line (48
        // of 53 spells dropped without firing) and the gun never finished loading.
        // Once loading, he stays loading until it fires, the window genuinely closes
        // (finale, past the attack zone, the bunch decisively near), or patience runs
        // out — nobody skips turns forever for an attack that never comes.
        r.attLoadT = (r.attLoadT || 0) + 1;
        const open = togo >= SPRINT_FINALE_M && togo <= ATT_FROM
          && (S.pel.gapS ?? 0) > ATT_SAFE - 8
          && !grp.some((o) => o !== r && (o.attT ?? 0) > 0);
        if (!open || r.attLoadT > 150) {
          // ...and a dropped load takes a breath before reloading: the bunch gap
          // wobbles around the safety line, and without this the gun was picked up
          // and put down every few seconds
          r.attLoad = 0; r.attLoadT = 0; r.attCool = Math.max(r.attCool, 30);
        }
        else if (b.sf >= ATT_SF) return fire();
      } else if (wantsAttack(S, grp, r)) {
        if (b.sf >= ATT_SF) return fire();
        r.attLoad = 1; r.attLoadT = 0;
      }
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
    // A committed dig is NOT ended by the rotation's resting threshold: the dig's
    // whole plan is to spend the last third the rotation would protect, and cresting
    // empty is the design. Nor by fading below plan pace while he leads — he is
    // still first; relief comes through the ledger when his body truly empties. The
    // slower-than-plan guard applies only from POSITION TWO, where a claimant who
    // cannot pass wedges the whole line (the bug it was built for).
    if (r.digTo != null && (r.dist >= r.digTo || finale || overpaid
      || (holdTop < pPlan && r.groupPos !== 1))) r.digTo = null;
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
    // The response to an attack is a CHOICE, made once, two seconds after the jump —
    // a rykk is answered at once or not at all. Each man asks: can I (a real tank,
    // not loading, not drifting), and is it worth it (I would beat or match him in a
    // sprint — being towed to the line by a man who beats me is pointless)? Then he
    // looks around: if enough stronger sprinters are placed to cover it, he free-rides
    // on their legs — which is why at most ATT_FOLLOW_N go, and why a move nobody can
    // afford to answer simply rides away. The player is never in this: following an
    // attack is HIS choice, made with the slider, not the autopilot's reflex.
    if (!finale && !r.isPlayer && !r.attChase) {
      const up = attackerAhead(S, r);
      if (up && up.attAt != null && S.t - up.attAt >= ATT_REACT && r.attSeen !== up.attAt) {
        r.attSeen = up.attAt;
        const can = !resting && !r.attLoad && b.sf >= ATT_FOLLOW_SF
          && r.sprintX >= up.sprintX - ATT_FOLLOW_EDGE;
        if (can) {
          let stronger = 0;
          for (const o of grp) {
            if (o === r || o === up || o.isPlayer) continue;
            if ((o.sf ?? 1) >= ATT_FOLLOW_SF && !o.attLoad && !o.offline
              && o.sprintX >= up.sprintX - ATT_FOLLOW_EDGE && o.sprintX > r.sprintX) stronger++;
          }
          if (stronger < ATT_FOLLOW_N) {
            r.attChase = up; r.attChaseT = 1;
            r.hold = false; r.digging = 0;
            // his answer opens the same way the attack did: with the jump
            return { P: burstCeil(r, b), brake: 0 };
          }
        }
      }
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
        if (playerRelay) {
          // the player's pull is HIS: the instruction bubble is the order, absolute —
          // no plan price, no dig lift. The ledger still times the turn, so a soft
          // pull just takes longer to pay off, and the break eats the lost seconds.
          // Returned straight out, so coast() below never touches it either: that
          // taper describes a TEMPO buying nothing at speed, the way the sprint and
          // the chase are already exempt from it. An explicit order is not tempo —
          // and MANUAL has always delivered it whole, so relay must too.
          return { P: Math.min(S.input.watts, b.ceil), brake: 0 };
        } else {
          const behind = S.t - planTimeAt(S.plan, r.dist);
          const urgency = clamp(behind / PACE_WINDOW, 0, 1);
          const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
            * (1 + PACE_GAIN * urgency);
          P = Math.min(pWant, r.pullX * b.T, b.ceil);
          // ...and where the road is his, the plan's tempo is a wasted chance. pullX is
          // the price of a long turn in the wind and has no say in a dig; the body does
          if (mine) { r.digging = 1; P = Math.max(P, digP); }
        }
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
        let dropper = null, nearest = null;
        for (const o of grp) {
          if (o === r) continue;
          const behind = dist0(o) - dist0(r);
          if (behind <= 0) continue;
          // ...and who is simply the next man up the road, drifting back or not
          if (!nearest || behind < dist0(nearest) - dist0(r)) nearest = o;
          if (!o.offline || deadWheel(o, r)) continue;
          if (behind < DOOR_NEAR && (!dropper || behind < dist0(dropper) - dist0(r))) dropper = o;
        }
        // ...but only the man IMMEDIATELY in front slots into your space. A drop-back
        // with someone still between you and him is not coming into your wheel at
        // all — he is passing that rider, and taking him means going backwards past
        // a wheel that is still going forward. Measured, that was 12 % of a sitting
        // rider's seconds, 2.3 km/h slower, with a forward wheel right there in
        // four cases out of five. Nearest man ahead wins; the wave-in stands when
        // the drop-back IS that man, because then he is genuinely in the way.
        if (dropper && dropper === nearest) tgt = dropper;
      }
      // a rester may go slower with a man rotating back — that is the whole point of
      // the wave-in — but not with one who is coming off for good. A wheel that is
      // racing an attack — the attacker's own, or a man covering it — is no wheel
      // either: going with the move is a decision each rider makes for himself, and
      // this rider (the player included) did not make it.
      const usable = tgt && !deadWheel(tgt, r) && !reacting(tgt)
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
        if (o.offline || reacting(o) || o.attLoad || o.digging || (o.isPlayer && S.input.mode === "sit")) continue;
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
        if (playerRelay) {
          // rolling through is already the pull: the instruction takes over here, not
          // at the front line, so the handover doesn't jump between two prices — and
          // it is delivered whole, coast included, exactly as at the front
          return { P: Math.min(S.input.watts, b.ceil), brake: 0 };
        } else {
          const behind = S.t - planTimeAt(S.plan, r.dist);
          const urgency = clamp(behind / PACE_WINDOW, 0, 1);
          const pWant = powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, 0)
            * (1 + PACE_GAIN * urgency);
          P = coast(Math.min(pWant, r.pullX * b.T, b.ceil), r.speed);
        }
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
        // SITTING ON holds the wheel exactly the way an AI rester does: the
        // autopilot's own soft cap governs (the `soft` flag above keeps it from
        // digging). A player-only trim to price+60 lived here once — it stripped
        // the closing authority, so every reshuffle at the foot of a climb sent
        // him uphill already metres down, and the climbing cap finished the job.
      } else {
        // No wheel to sit on: he has lost it, or the one ahead is dying and there is
        // nothing behind it to take. This was a flat 340 W — the one hardcoded wattage
        // in the whole ladder, and it knew nothing about his mass, his threshold, the
        // gradient, the wind, or how far up the road the wheel had gone. What a rider
        // does here is not a number: he rides what closes the gap. It is the question
        // the man alone off the back already asks, so it gets the same answer.
        r.hold = false;
        // ...unless he is the PLAYER: the autopilot never chases for him. With no
        // wheel to hold, the legs ride the instruction bubble — getting back on is
        // the slider's job, at the number the thumb has already chosen.
        if (sitting || playerRelay) return { P: Math.min(S.input.watts, b.ceil), brake: 0 };
        let lead = tgt || chaseTarget(S, r);
        // ...but a wheel that is racing an attack is not "his" wheel to close to: paying
        // the price of holding an accelerating mover's speed was exactly how the whole
        // group — the player in his wheels included — got towed across to every move.
        // He looks THROUGH the racers to the nearest man still riding the group's race,
        // and if the entire road ahead of him IS the move, he lets it go: the plan's
        // price, and the group reforms behind it at its own tempo.
        let refused = false;
        if (lead && reacting(lead)) {
          refused = true;
          lead = null;
          for (const o of S.riders) {
            if (o === r || o.caught || o.finished != null || reacting(o)) continue;
            if (dist0(o) > dist0(r) && (!lead || dist0(o) < dist0(lead))) lead = o;
          }
        }
        const away = lead ? dist0(lead) - BIKE - dist0(r) : Infinity;
        if (!lead) {
          P = refused
            ? Math.min(powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, shel), b.ceil)
            : Math.min(0.92 * b.T, b.ceil);
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
        // ...and a sitting player who lost the wheel chases it back like any AI
        // rester would — the empty-the-tank dosing. A threshold cap lived here
        // once, and it turned every transient loss on a climb into a permanent
        // one: the climbing cap sheds you near the top, the cap forbade the ride
        // back over it, and "come back over the summit" never happened.
        if (!r.chasing) P = coast(P, r.speed);
      }
    }
  } else {
    r.digTo = null;   // whatever climb he claimed, he is his own group now — clean slate
    // The PLAYER alone: the autopilot never chases for him, and it never doses a solo
    // ride for him either — dropped or clear, the legs ride the instruction bubble
    // and the slider is how he races. (Same rule as losing the wheel inside a group.)
    if (r.isPlayer && S.input.mode !== "manual") return { P: Math.min(S.input.watts, b.ceil), brake: 0 };
    // Alone. Off the front there is nothing to read and nothing to chase, so the old
    // steady tempo stands. Off the back there is a wheel up the road, and the whole
    // question a dropped rider asks is whether he can reach it before the line.
    let lead = chaseTarget(S, r);
    // ...unless that wheel IS the move: a man left alone because the attack went from
    // right next to him does not reflex-chase it — he did not choose to follow, and
    // "let him die out there" is the group's whole answer to a move it cannot afford.
    // He looks through the racers to the nearest wheel still riding the ordinary race,
    // and with nothing but the move on the road ahead he rides his own tempo.
    if (lead && reacting(lead)) {
      lead = null;
      for (const o of S.riders) {
        if (o === r || o.caught || o.finished != null || reacting(o)) continue;
        if (dist0(o) > dist0(r) && (!lead || dist0(o) < dist0(lead))) lead = o;
      }
    }
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
    // (The sitting player, alone, chases like any AI rester — the threshold cap that
    // lived here made a temporary loss on a climb a permanent one.)
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
  // a regain, not a chase: inside CHASE_NEAR the minimum-time solve below prices a
  // 15 m gap as a 15-second sprint — measured, ~690 W on a fresh body, snapping on
  // and off at the 12 m group boundary. What a rider does for fifteen metres is ride
  // the wheel's price (no shelter out here) plus a bounded surplus that grows with
  // the gap, meeting the real chase seamlessly at the zone's edge.
  if (gap < CHASE_NEAR) {
    r.chasing = 1;
    const price = powerFor(r.chaseU, r.mass, r.cda, grad, rho, hw, 0);
    return Math.min(price + CHASE_NEAR_W * (gap / CHASE_NEAR), b.ceil);
  }
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
