import { CLIMB_MIN_T, DH_GRAD, SPRINT_FINALE_M, WHEEL_NEAR, WHEEL_WARN_SF } from "../content/tuning.js";
import { bodyNow } from "./body.js";
import { pushEvent } from "./events.js";
import { BIKE, DRAFT, rhoAt } from "./physics.js";
import { planTimeAt } from "./plan.js";
import { reacting, terrainEdge } from "./tactics.js";

/* The commentary box. One voice, reading the same state the AI reads — tanks, wear,
   intentions, the bunch — and telling it as a race. Everything here is observation:
   no rider's watts are touched, so the golden master cannot move.

   Two registers, on the user's instruction: things the player must REACT to — a jump
   answered or ignored, a man riding clear, a gun being loaded, the sprint opening —
   are said the moment they happen, never muted by pacing; each fires once per
   INSTANCE, which is deduplication, not a cooldown. Colour — form, fuel, the day's
   toll, the bunch's mood — waits its turn and repeats itself rarely. */

const GAP_MIN = 18;      // quiet seconds between colour remarks — a commentator breathes
const LINE_KEEP = 6;     // lines the feed holds; the UI shows fewer
const LOSS_COOL = 45;    // seconds between lost-wheel calls about the same man — the twelve-
                         // metre line can be regained and lost again in a handful of seconds,
                         // and a stutter at the boundary is one piece of news, not three

const say = (S, st, txt) => {
  S.comm.unshift({ t: S.t, txt });
  if (S.comm.length > LINE_KEEP) S.comm.pop();
  st.last = S.t;
};
// colour: waits for quiet and repeats itself rarely — per subject, and per TOPIC:
// with five men in the red at once, a per-rider cooldown alone had the same two
// sentences rotating through the box all the way home
const colour = (S, st, key, cd, txt, gKey, gCd) => {
  if (S.t - st.last < GAP_MIN) return;
  if (st.cool[key] != null && S.t - st.cool[key] < cd) return;
  if (gKey && st.cool[gKey] != null && S.t - st.cool[gKey] < gCd) return;
  st.cool[key] = S.t;
  if (gKey) st.cool[gKey] = S.t;
  say(S, st, txt);
};
// urgent: said the moment it happens, once per instance
const urgent = (S, st, key, txt) => {
  if (st.said[key]) return;
  st.said[key] = 1;
  say(S, st, txt);
};

const him = (r) => (r.isPlayer ? "you" : r.name);
const His = (r, player, other) => (r.isPlayer ? player : other);

export function stepComm(S) {
  const st = S.commSt || (S.commSt = { last: -999, cool: {}, said: {}, gapS0: null, gapT0: 0, lastTop: null, wheels: {}, lossAt: {} });
  const P = S.riders[0];
  const live = S.riders.filter((r) => !r.caught && r.finished == null);
  if (!live.length || S.ended) return;

  // the news wire feeds the track too: the attack, the flamme rouge, the catch are
  // already commentary — mirrored here so the story reads whole in one place
  for (let i = S.events.length - 1; i >= 0; i--) {
    const e = S.events[i];
    if (e.t === S.t && !st.said["ev:" + e.t + e.txt]) { st.said["ev:" + e.t + e.txt] = 1; say(S, st, e.txt); }
  }

  /* ---- urgent: the things a player reacts to ---- */

  for (const r of live) {
    // the answer to a jump, five seconds in: who went, or nobody
    if (r.attAt != null && S.t - r.attAt === 5 && ((r.attT ?? 0) > 0 || r.attacked)) {
      const covers = live.filter((o) => o.attChase === r);
      if (covers.length) urgent(S, st, "resp:" + r.i + ":" + r.attAt,
        him(covers[0]) + (covers[0].isPlayer ? " go" : " goes") + " with " + (r.isPlayer ? "you" : "him") + " at once!");
      else urgent(S, st, "resp:" + r.i + ":" + r.attAt,
        "nobody moves — " + (r.isPlayer ? "they are letting you go!" : "they are letting him go!"));
    }
    // the gun being loaded is a warning the player is owed the moment it is visible
    if (!r.isPlayer && r.attLoad && r.attLoadT === 10) {
      urgent(S, st, "load:" + r.i + ":" + (S.t - 10),
        "watch " + r.name + " — he has gone quiet at the back. The gun is being loaded.");
    }
    // the sprint opening is the race's last door closing
    if (r.sprinting && !r.isPlayer && (r.groupSize ?? 1) > 1 && S.course.total - r.dist < 1500) {
      urgent(S, st, "spr:" + r.i, r.name + " opens the sprint!");
    }
    // a man committing to a whole climb changes everyone's next ten minutes
    if (r.digging && r.digTo != null) {
      urgent(S, st, "dig:" + r.i + ":" + Math.round(r.digTo),
        him(r) + (r.isPlayer ? " drive" : " drives") + " it on the climb — riding them off the wheel!");
    }
  }

  // onto a real climb: name the man the road belongs to. Once per summit, and worth
  // interrupting for — the player's next move depends on it
  const C = S.course;
  const here = Math.max(P.dist, 0);
  const top = C.climbTopAt(P.dist);
  const tTop = Math.max(planTimeAt(S.plan, top) - planTimeAt(S.plan, here), 0);
  const grp = P.groupNo != null ? S.groups[P.groupNo - 1] : null;
  if (tTop >= CLIMB_MIN_T && st.lastTop !== Math.round(top) && grp && grp.length > 1) {
    st.lastTop = Math.round(top);
    const len = Math.max(top - here, 1);
    const gAvg = (C.eleAt(top) - C.eleAt(here)) / len;
    if (gAvg > 0.015) {
      const rhoAvg = rhoAt((C.eleAt(top) + C.eleAt(here)) / 2);
      let best = null;
      for (const o of grp) {
        if (terrainEdge(grp, o, len / Math.max(tTop, 1), gAvg, rhoAvg, C.windAt(here), tTop).cheapest) { best = o; break; }
      }
      say(S, st, "onto the climb — " + (best ? (best.isPlayer ? "this is your ground" : "this is " + best.name + "'s ground") : "the road starts to bite"));
    }
  }

  // The moment a wheel is LOST — the fact, not the forecast. A predictive version
  // lived here first, pricing the wheel against the hold formula to the summit; the
  // designer's verdict after riding with it was that the commentator should speak
  // when the thing actually happens. Contact is the group split line itself —
  // raceGroups joins on wheelGap ≤ DRAFT — so "he had this wheel last second and the
  // gap is past DRAFT now" is exactly the tick the file breaks. Nobody who chose to
  // go is a loser: drop-backs (offline), men racing an attack (reacting), the sprint
  // gesture — and a wheel that left by choice was not lost either, same words in the
  // mirror. Not on a real descent, where wheels don't die (validWheel's own line),
  // and not in the finale, where losing wheels is the game itself. Edge-triggered
  // with a per-man breather, so the twelve-metre boundary cannot stutter the news.
  //
  // Three voices, by whose wheel went. The PLAYER's own loss speaks only while he
  // holds real surge — the warning is a call to action, you HAVE the matches to
  // close it, and a man losing the wheel empty is not being told anything he can
  // use. A man cracking within WHEEL_NEAR ahead of the player is a gap opening in
  // front of the whole file — the one loss you must answer before it is yours too,
  // so it carries the headline. The same crack behind him asks nothing, so it is a
  // feed line and no more. (Events pushed here are never mirrored into the feed —
  // the mirror has already run this second — hence feed line and wire separately.)
  const pAlive = !P.caught && P.finished == null;
  for (const r of live) {
    const w = st.wheels[r.i] != null ? S.riders[st.wheels[r.i]] : null;
    if (!w || w.caught || w.finished != null) continue;
    if (w.dist - BIKE - r.dist <= DRAFT) continue;   // still on it — or come past it
    if (w.offline || reacting(w) || r.offline || reacting(r) || r.sprinting) continue;
    if (C.gradAt(Math.max(r.dist, 0)) <= DH_GRAD) continue;
    if (C.total - r.dist < SPRINT_FINALE_M) continue;
    if (st.lossAt[r.i] != null && S.t - st.lossAt[r.i] < LOSS_COOL) continue;
    if (r.isPlayer) {
      if (bodyNow(r).sf < WHEEL_WARN_SF) continue;
      st.lossAt[r.i] = S.t;
      say(S, st, "the wheel is going — you still have the matches to close it");
      pushEvent(S, "You are losing the wheel", 1);
    } else if (pAlive && Math.abs(r.dist - P.dist) <= WHEEL_NEAR) {
      st.lossAt[r.i] = S.t;
      if (r.dist > P.dist) {
        say(S, st, r.name + " is coming off the wheel ahead — don't get caught behind him");
        pushEvent(S, r.name + " cracks just ahead of you", 1);
      } else {
        say(S, st, r.name + " has lost the wheel behind you");
      }
    }
  }
  st.wheels = {};
  for (const r of live) if (r.groupPos > 1) st.wheels[r.i] = S.groups[r.groupNo - 1][r.groupPos - 2].i;

  /* ---- colour: form, fuel, the day, the bunch — paced and rare ---- */

  // the bunch's mood, read as a trend, not a number
  if (S.pel && S.pel.gapS != null) {
    if (st.gapS0 == null || S.t - st.gapT0 >= 30) {
      const d = st.gapS0 == null ? 0 : S.pel.gapS - st.gapS0;
      if (st.gapS0 != null && d <= -6) colour(S, st, "gap", 90,
        "the bunch means business — " + Math.round(S.pel.gapS) + " seconds, and closing fast");
      else if (st.gapS0 != null && d >= 6) colour(S, st, "gap", 90,
        "the gap goes out to " + Math.round(S.pel.gapS) + " seconds — the break is believing");
      st.gapS0 = S.pel.gapS; st.gapT0 = S.t;
    }
  }

  if (grp && grp.length > 1) {
    // the freshest man in the break, when he is clearly that
    let top1 = null, top2 = null;
    for (const o of grp) {
      const sf = o.sf ?? 1;
      if (!top1 || sf > (top1.sf ?? 1)) { top2 = top1; top1 = o; }
      else if (!top2 || sf > (top2.sf ?? 1)) top2 = o;
    }
    if (top1 && top2 && (top1.sf ?? 1) > 0.65 && (top1.sf ?? 1) - (top2.sf ?? 1) > 0.25) {
      colour(S, st, "fresh:" + top1.i, 300,
        him(top1) + (top1.isPlayer ? " look" : " looks") + " the freshest in this break — barely a turn taken in the wind");
    }
    // ...and the whole break burned out together
    if (grp.length >= 3 && grp.every((o) => (o.sf ?? 1) < 0.2)) {
      colour(S, st, "cooked:" + P.groupNo, 400,
        "they have burned every match between them — this is survival now");
    }
  }

  for (const r of live) {
    const b = bodyNow(r);
    if (b.sf < 0.12 && r.power > 0.7 * b.T) {
      colour(S, st, "rivet:" + r.i, 240, him(r) + (r.isPlayer ? " are" : " is") + " on the rivet — deep in the red", "rivet", 150);
    }
    if (b.ff < 0.15) {
      colour(S, st, "fumes:" + r.i, 360, him(r) + (r.isPlayer ? " are" : " is") + " running on empty now", "fumes", 180);
    }
    if (r.wear > 0.78) {
      colour(S, st, "worn:" + r.i, 600, "the day has taken its toll on " + (r.isPlayer ? "you" : r.name) + " — not the rider of this morning", "worn", 240);
    }
  }

  // one piece of colour about the player's own race, told once past halfway
  if (!st.said.wind && P.dist > C.total * 0.55 && grp && grp.length > 1) {
    const most = grp.every((o) => o === P || (P.st.wind > (o.st.wind || 0)));
    if (most && P.st.wind > 300) {
      st.said.wind = 1;
      if (S.t - st.last >= GAP_MIN) say(S, st, "you have done the most work in the wind today — and the others know it");
    }
  }
}
