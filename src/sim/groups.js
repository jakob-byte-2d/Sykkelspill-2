import { DRAFT, ORDER_EPS } from "./physics.js";
import { wheelGap } from "./tactics.js";

/* Who is riding with whom, and how far apart in seconds. */

/* ---------------- Time gaps, measured from you ---------------- */
export function raceGroups(S) {
  const live = S.riders.filter((r) => !r.caught && r.finished == null).sort((a, b) => b.dist - a.dist);
  // a compact line jitters on centimetre overlaps: an overtake must exceed
  // ORDER_EPS to register, otherwise last tick's order stands — so the rotation,
  // the ledger and the drawing all see one stable file
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = 0; i + 1 < live.length; i++) {
      const a = live[i], bb = live[i + 1];
      if (a.dist - bb.dist < ORDER_EPS && a.rank != null && bb.rank != null && bb.rank < a.rank) {
        live[i] = bb; live[i + 1] = a; swapped = true;
      }
    }
  }
  live.forEach((r, i) => { r.rank = i; });
  const out = [];
  for (const r of live) {
    const last = out[out.length - 1];
    if (last && wheelGap(last[last.length - 1], r) <= DRAFT) last.push(r);
    else out.push([r]);
  }
  return out;
}

// the one grouping pass per tick: S.groups is the cache everyone reads — the AI during
// the next tick (frozen, so it agrees with the d0 snapshot) and the UI between ticks
export function tagGroups(S) {
  S.groups = raceGroups(S);
  S.groups.forEach((grp, gi) => {
    grp.forEach((r, k) => {
      r.groupNo = gi + 1;      // 1 = the front group on the road
      r.groupPos = k + 1;      // 1 = the front of that group
      r.groupSize = grp.length;
    });
  });
  for (const r of S.riders) if (r.caught || r.finished != null) { r.groupNo = null; r.groupPos = null; r.groupSize = null; }
}

export function gapRows(S) {
  const me = S.riders[0];
  const rows = [];
  // one reference speed for every row: the bunch's smoothed pace — the same clock the
  // peloton strip below runs on, so board and strip can never disagree
  const vRef = Math.max(S.pel.vAvg || S.pel.speed, 8);
  const grps = S.groups;
  grps.forEach((grp, gi) => {
    const mine = grp.includes(me);
    const names = grp.map((r) => r.name.split(".").pop().slice(0, 8));
    let label = mine
      ? (grp.length > 1 ? "YOU +" + (grp.length - 1) : "YOU")
      : (grp.length > 2 ? names[0] + " +" + (grp.length - 1) : names.join(" "));
    if (grps.length > 1) label = "G" + (gi + 1) + " · " + label;
    rows.push({ key: "g" + grp[0].i, label, gapS: -(grp[0].dist - me.dist) / vRef, me: mine });
  });
  rows.push({ key: "pel", label: "PELOTON", gapS: S.pel.gapS });
  rows.sort((a, b) => a.gapS - b.gapS);
  return rows;
}
