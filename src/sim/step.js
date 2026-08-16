import { ATT_FROM, ATT_JUMP_DV, ATT_JUMP_T, ATT_JUMP_X, ATT_REARM, DH_GRAD, COOP_MARGIN, COOP_PULL_MAX, COOP_PULL_MAX_UP, COOP_PULL_MIN, COOP_PULL_SPEND, COOP_REF, DROP_W, PULL_MIN_SF, SPRINT_FINALE_M } from "../content/tuning.js";
import { bodyNow, burstCeil, shutUpLegs, spend, usableSurge } from "./body.js";
import { tagGroups } from "./groups.js";
import { stepPel } from "./peloton.js";
import { BIKE, G, LY_FLOOR, SHEL_MAX, powerFor, rhoAt, shelterAt, shelterStack } from "./physics.js";
import { planSpeedAt } from "./plan.js";
import { working } from "./tactics.js";
import { coopRide } from "./ride.js";
import { stepComm } from "./commentary.js";
import { pushEvent } from "./events.js";
import { clamp } from "./rng.js";

/* One second of racing. */

/* ---------------- One second of racing, one rider ---------------- */
export function stepRider(S, r, dt) {
  const C = S.course;
  r.prevDist = r.dist;
  const d = Math.max(r.dist, 0);
  const grad = C.gradAt(d), rho = rhoAt(C.eleAt(d)), hw = C.windAt(d);
  const b = bodyNow(r);
  r.sf = b.sf;   // published for the drop-back scan; readers see last turn's value

  // shelter: full behind the wheel, then fading — and it bleeds away over one bike
  // length while you move up alongside and past him. The wheel he follows is the one
  // that shelters him best, which is not always the nearest; the wind he is actually
  // out of is the whole file's, so every body ahead goes into the stack.
  let best = 0, ahead = null, bestGap = 1e9;
  const each = [];
  for (const o of S.riders) {
    if (o === r || o.caught || o.finished != null) continue;
    const gap = ((o.d0 != null ? o.d0 : o.dist) - BIKE) - (r.d0 != null ? r.d0 : r.dist);
    const s = shelterAt(gap);
    if (s > 0) each.push(s);
    if (s > best) { best = s; ahead = o; bestGap = gap; }
    else if (gap > 0 && gap < bestGap && best === 0) { bestGap = gap; ahead = o; }
  }
  const shel = shelterStack(each);
  r.shel = shel;
  // ...and what that is actually worth to him, which is not the same number. Shelter takes
  // a share of the AIR; the air is only a share of the work. On the flat a wheel saves a
  // third of his watts, at five per cent barely a tenth — the whole reason an attack up a
  // climb sheds people and the same attack on the flat tows them home. The denominator has
  // a floor because rolling downhill off the pedals a wheel saves nearly all of almost
  // nothing, and a meter reading 100 % there would be true and useless.
  const open = powerFor(r.speed, r.mass, r.cda, grad, rho, hw, 0);
  const lee = powerFor(r.speed, r.mass, r.cda, grad, rho, hw, shel);
  r.ly = clamp((open - lee) / Math.max(open, LY_FLOOR * b.T), 0, 1);
  r.overlap = !!ahead && bestGap < 0 && shel > 0;

  // the motivation button: pressed once, consumed once — the physiology answers in
  // body.js, and an AI could call the same function one day. Applied before the power
  // decision, and the body re-read, so this very tick's ceiling already has the
  // governor silenced.
  if (r.isPlayer && S.input.sul) {
    S.input.sul = false;
    if (shutUpLegs(r)) Object.assign(b, bodyNow(r));
  }

  // the price of sitting in — the plan's pace at HIS shelter. The manual offline flag
  // reads it downward (soft-pedalling out of the line) and the attack detection below
  // reads it upward (jumping out of it), so it is taken once, for the player only.
  const sitP = r.isPlayer ? powerFor(planSpeedAt(S.plan, r.dist), r.mass, r.cda, grad, rho, hw, shel) : 0;

  // what he asks his legs for
  let P;
  let brake = 0;
  if (r.isPlayer && S.input.sprint) {
    // the sprint button: a binary commitment, exactly what the AI does from its own
    // launch — everything the body has, for as long as the finger dares. It overrides
    // every mode, which also makes it the attack button: a jump out of the wheel
    // mid-race is the same gesture as a sprint for the line. And all-out is the key
    // that unlocks the third motor: the burst ceiling opens near fresh p5s while the
    // jump lasts, and falls back to the ordinary ceiling as it drains — spend() bills
    // the jump for every watt above that ceiling, so asking and paying are one act.
    P = burstCeil(r, b);
    r.sprinting = 1; r.offline = 0; r.digging = 0; r.chasing = 0;
  } else if (r.isPlayer && S.input.mode === "manual") {
    P = Math.min(S.input.watts, b.ceil);   // manual: your watts, your problem
    r.sprinting = 0;   // the button was released — coopRide clears this for the AI modes
    r.digging = 0; r.chasing = 0;   // ...and whatever errand the autopilot was on ended with the handover
    // ...but swinging off is a thing you have to be able to SAY. The AI says it with
    // r.offline and the whole line listens — queueWheel looks through him, the resters
    // open the door. In manual that flag never got set, so however low the slider went
    // the wheel behind believed it and followed the player down for half a minute
    // before the 2 km/h test rescued it. The signal is the watts: riding below even the
    // drop-back's own level — the sit-in price at the plan's pace, minus DROP_W — is
    // not an effort that intends to stay in the line. Read against the plan's speed,
    // not his own: his own falls with him and the threshold would chase it down. But at
    // HIS shelter, not the best seat's — holding the pace costs the man on the front
    // twice what it costs the man buried in the line, and the same 150 W that says
    // "swinging off" in the wind simply holds the wheel from fourth position.
    // Downhill the price is nothing and the flag cannot arm, which is right too —
    // nobody swings off a descent by soft-pedalling, everyone rolls the same.
    r.offline = (r.groupSize ?? 1) > 1 && P <= sitP - DROP_W ? 1 : 0;
  } else {
    // handing the controls to the autopilot ends any manual jump mid-gesture — but a
    // break he has already ridden clear stays his: the solo branch races it home
    if (r.isPlayer && (r.attT ?? 0) > 0) {
      r.attT = 0; r.attArmT = 0;
      if ((r.groupSize ?? 1) > 1) { r.attacked = 0; r.attCool = ATT_REARM; }
    }
    // one rule for the whole break — the player in relay or sitting on rides it too
    const out = coopRide(S, r, b, ahead, bestGap, shel, grad, rho, hw);
    P = out.P; brake = out.brake;
  }
  // The player's attack, read off the physics — the offline derivation's twin, in the
  // other direction. The AI declares its attacks; the player's hands say nothing, but
  // the GESTURE is public: watts above threshold and far above the price of sitting
  // in, held long enough to mean it. Once registered, the response machinery answers
  // his jump exactly as it answers an AI's — the look around, the covers, the group
  // refusing to be towed — and the same grammar tells the rest of his story: easing
  // off alone is riding clear, easing off in the wheels is being brought back.
  if (r.isPlayer && (S.input.sprint || S.input.mode === "manual")) {
    const togo = C.total - r.dist;
    const inGrp = (r.groupSize ?? 1) > 1;
    // ...and the part that separates an attack from a hard pull: he is pulling AWAY —
    // faster than the quickest of his companions, not just working harder than them
    let vBest = 0;
    const g = r.groupNo != null ? S.groups[r.groupNo - 1] : null;
    if (g) for (const o of g) if (o !== r && o.speed > vBest) vBest = o.speed;
    // ...and never on a real descent, where a speed edge is terrain, not a jump —
    // the same line validWheel draws, because it is the same physics
    const jump = inGrp && togo >= SPRINT_FINALE_M && grad > DH_GRAD
      && P > b.T && P > sitP * ATT_JUMP_X && r.speed > vBest + ATT_JUMP_DV;
    if ((r.attT ?? 0) > 0) {
      if (jump) r.attT = 2;   // the gesture lives while he keeps riding it
      else {
        r.attT = 0; r.attArmT = 0;
        if (inGrp) { r.attacked = 0; r.attCool = ATT_REARM; r.attNews = 2; }
        else r.attNews = 3;
      }
    } else if (r.attacked) {
      // clear from an earlier jump: being swallowed again ends it, same as for the AI
      if (inGrp) { r.attacked = 0; r.attCool = ATT_REARM; r.attNews = 2; r.attArmT = 0; }
    } else if (jump && (r.attCool ?? 0) <= 0) {
      r.attArmT = (r.attArmT || 0) + 1;
      if (r.attArmT >= ATT_JUMP_T) { r.attT = 2; r.attacked = 1; r.attAt = S.t; r.attNews = 1; }
    } else r.attArmT = 0;
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

  // attack bookkeeping: cooldowns tick down, and the news gets told — set as flags in
  // ride.js because the event feed lives up here, and an attack is exactly the kind of
  // thing the commentary exists for
  for (const r of S.riders) {
    if (r.attCool > 0) r.attCool -= 1;
    // ...told in the second person for the player, and never as a headline: the big
    // flag slams the replay to 1× for news you must REACT to, and your own hands are
    // not news to you
    if (r.attNews === 1) pushEvent(S, r.isPlayer ? "You attack!" : r.name + " attacks!", r.isPlayer ? 0 : 1);
    else if (r.attNews === 2) pushEvent(S, r.isPlayer ? "You are brought back" : r.name + " is brought back");
    else if (r.attNews === 3) pushEvent(S, r.isPlayer ? "You ride clear!" : r.name + " rides clear!", r.isPlayer ? 0 : 1);
    r.attNews = 0;
  }

  tagGroups(S);
  // The hunt's news wire, read from the escapee's side (the mirror of huntTarget,
  // so the flag lives on the man it is about): a bigger group behind him, still
  // outside the attack window, is riding him back at full alarm. Announced on the
  // rising edge; the falling edge with company is the regain — unless the attack
  // machinery just said "brought back" itself (fresh attCool), in which case the
  // wire already carries the news and this stays quiet.
  for (const r of S.riders) {
    if (r.caught || r.finished != null) { r.hunted = 0; continue; }
    let hunted = 0;
    for (const o of S.riders) {
      if (o === r || o.caught || o.finished != null) continue;
      if (o.dist >= r.dist || (o.groupSize ?? 1) <= (r.groupSize ?? 1)) continue;
      if (C.total - o.dist <= ATT_FROM) continue;
      hunted = 1; break;
    }
    if (hunted && !r.hunted) {
      pushEvent(S, r.isPlayer ? "The break organises the chase behind you"
        : "The break organises to bring back " + r.name, r.isPlayer ? 1 : 0);
    } else if (!hunted && r.hunted && (r.groupSize ?? 1) > 1 && !((r.attCool ?? 0) > 0)) {
      pushEvent(S, r.isPlayer ? "You are brought back — the break rides together again"
        : r.name + " is brought back by the break");
    }
    r.hunted = hunted;
    // ...and inside the window, a man ALONE and clear of a bigger group behind IS
    // attacking, however smoothly he rode away — what he does beats what he wanted.
    // Without this, a gradual drift off the front (no jump for the detector to see)
    // sailed into the endgame with nobody entitled to answer it: marked, the whole
    // response machinery takes him on — the once-only cover choice, the free-riders,
    // ATT_GIVEUP, and the bunch's arithmetic. A rider already racing a move, or on
    // cooldown from one, is not re-marked.
    const togo = C.total - r.dist;
    if ((r.groupSize ?? 1) === 1 && togo <= ATT_FROM && togo >= SPRINT_FINALE_M
      && !((r.attT ?? 0) > 0) && !r.attChase) {
      let biggerBehind = false;
      for (const o of S.riders) {
        if (o === r || o.caught || o.finished != null) continue;
        if (o.dist < r.dist && (o.groupSize ?? 1) > 1) { biggerBehind = true; break; }
      }
      if (biggerBehind && !r.attacked && (r.attCool ?? 0) <= 0) {
        // a drifter, not a jump: marked so the machinery owns him, flagged soft
        r.attacked = 1; r.attSoft = 1; r.attAt = S.t; r.attNews = 3;
      } else if (biggerBehind && r.attacked && r.attSoft && S.t - r.attAt >= 60) {
        // ...and a drifter still dangling gets LOOKED AT AGAIN: a jump is answered
        // at once or not at all because surprise is its weapon, but this man has
        // none — as tanks refill behind him, the cover choice is re-asked. Real
        // kicked attacks keep the once-only doctrine untouched.
        r.attAt = S.t;
      }
    }
    if (!r.attacked) r.attSoft = 0;
  }
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
    // an empty tank ends the turn if someone fresher can take it on. While anyone in
    // the group is still working, a rester refilling at the back is no relief and does
    // not count — the five-man truth, and judged without it the healthy rotation's
    // turns halved. But when NOBODY works, the fresher rester is all the relief there
    // is, and he counts: judged only on "working", a cooked pair left the emptier man
    // towing for minutes while his fresher companion refilled in the wheel — and two
    // dead men in a real break swap short soft turns precisely because even a dying
    // wheel is relief. Excused always: a man drifting off the line, and the player
    // who has SAID he is sitting on.
    const avail = (o) => !o.offline && !(o.isPlayer && S.input.mode === "sit");
    const anyWork = g.some((o) => o !== r && working(S, o));
    const empty = b.sf < PULL_MIN_SF && g.some((o) => o !== r
      && (working(S, o) || (!anyWork && avail(o))) && (o.sf ?? 1) > b.sf);
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
    // ...and for a digger, "empty" means EMPTY: his plan is to spend the last third
    // the rotation would protect and crest with nothing, so the 30 % resting bar that
    // ends an ordinary turn would amputate every dig (measured: 266 of 277 died early,
    // median 40 % still in the tank). Only a truly bare tank hands his climb away.
    // ...and none of the four decides the PLAYER's turn when he has taken that
    // decision himself. In a break it is the man on the front who says when he has
    // had enough, not a ledger — so in relay with manual turn control the turn ends
    // on his word and nothing else. Headless runs (golden, sweep, scenario scripts)
    // have no finger on the button and keep the automatic rules; the UI switches
    // this on at the gun. The ledger still credits his gift either way, so a long
    // turn is still paid back in a long rest.
    const mineToEnd = r.isPlayer && S.input.mode === "relay" && S.input.turn === "manual";
    const over = r.digging ? (empty && b.sf < 0.10)
      : mineToEnd ? !!S.input.endTurn
      : (paidUp || spent || empty || r.pullT >= maxPull);
    // the minimum-turn floor is the rotation's own manners and has no say over a man
    // who has just announced he is done: pressed at second three, he swings off then
    if (over && (mineToEnd || r.pullT >= COOP_PULL_MIN)) r.done = true;
  }
  // the button is a gesture, not a state: consumed every second whether or not he was
  // on the front, so a press made in the wheels never ends a turn he takes later
  S.input.endTurn = false;
  // the turn's bookkeeping: it opens when he reaches the front and closes for good
  // once he has drifted to the back — tagGroups ran above, so the positions are this
  // second's. Anyone not on the front is between turns and carries no mark.
  for (const r of S.riders) {
    if (r.groupPos !== 1) { r.pullMark = null; r.pullT = 0; }
    // the turn stays over while a working man sits behind him — or, in a group where
    // NOBODY works, while anyone available does: ride.js hands the front to the
    // fullest man then, and the flag must survive long enough for that handover to
    // happen. Judged on "working" alone it died the same tick in a cooked pair and
    // the empty front towed on. NOT "last in the group" either: the player sitting on
    // parks at the very rear for good, and he is excused — a flag waiting on him
    // would stick all race, leaving every AI permanently offline and the rotation
    // with no engine at all.
    if (r.done && r.groupNo != null) {
      const g = S.groups[r.groupNo - 1];
      const anyWork = g && g.some((o) => o !== r && working(S, o));
      if (!g || g.length < 2 || !g.some((o) => o !== r && o.groupPos > r.groupPos
        && (working(S, o) || (!anyWork && !o.offline && !(o.isPlayer && S.input.mode === "sit"))))) r.done = false;
    }
  }

  // ...and the commentator, last of all: pure observation over this second's finished
  // state, so nothing he says can move a single watt
  stepComm(S);
}

export function finalize(S) {
  let guard = 0;
  while (guard++ < 600 && S.riders.some((r) => r.finished == null && !r.caught)) stepSim(S);
  S.ended = true;
  const p = S.riders[0];
  const before = S.riders.filter((r) => !r.isPlayer && r.finished != null && r.finished < p.finished).length;
  S.result = { caught: false, place: before + 1 };
}
