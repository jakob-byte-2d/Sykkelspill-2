import { PULL_MIN_SF } from "../content/tuning.js";
import { bodyNow } from "../sim/body.js";
import { BIKE } from "../sim/physics.js";
import { lerp } from "../sim/rng.js";
import { drawCyclist } from "./cyclist.js";
import { drawProfile } from "./profile.js";
import { drawScenery, drawWindsock, hash1 } from "./scenery.js";

/* One frame: the road, the riders, the bubbles over their heads, the chyron. Reads
   the simulation and writes pixels; it never changes anything. */

export const VIEW_M = 40;               // metres of road across the screen

export const RIDER_M = 1.58;            // head height of a rider in the saddle, drawn at true scale

export const riderK = (pxm) => (RIDER_M / 17.6) * pxm;

/* Telemetry, off unless asked for: ?debug=1 in the address, or the D key. A player
   should never trip over it, so the bubble stays compact until it is switched on. */
export let DEBUG = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("debug") === "1";

// the canvas reads DEBUG afresh every frame, so flipping it here is all the bubbles
// need. The sim fixture goes up and down with it, so an automated check can always
// read the truth behind whatever the bubbles are claiming.
export function setDebug(on, S) {
  DEBUG = on;
  if (typeof window === "undefined") return;
  if (on) { if (S) window.__S = S; } else delete window.__S;
}

// a tank reads at a glance by its colour — you should see who is empty without
// having to read the number, which is what makes five bubbles at once survivable
export const tankHue = (f) => (f > 0.55 ? "#5fe07a" : f > 0.28 ? "#ffd23f" : "#ff6b5d");

// a rounded chip on a stalk, in the rider's own colour — the same object the race
// map already uses for its group flags, borrowed here for the heads
export function drawBubble(ctx, x, top, w, h, color, tipX, tipY) {
  // the stalk leans back to the man it belongs to — once the bubbles are nudged
  // apart, it is the only thing that says whose is whose
  ctx.strokeStyle = "rgba(19,58,107,0.65)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, top + h); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.fillStyle = "rgba(12,26,44,0.82)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, top, w, h, 5); else ctx.rect(x - w / 2, top, w, h);
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
}

// what he is doing right now, in one word the bubble has room for
// one vocabulary for everyone, the player's own words: what a rider IS DOING, read
// off the same state for AI and human alike. The order is the order of drama.
export function roleOf(S, r) {
  if (r.sprinting) return "SPRINTING";
  if ((r.attT ?? 0) > 0 || (r.attacked && r.groupSize <= 1)) return "ATTACKING";
  if (r.attChase) return "COVERING";   // he chose to go with the move — marking it, not towing it
  if (r.chasing) return "CHASING";
  if ((r.groupSize ?? 1) <= 1) {
    const anyAhead = S.riders.some((o) => o !== r && !o.caught && o.finished == null && o.dist > r.dist);
    return anyAhead ? "DROPPED" : "GOING SOLO";
  }
  if (r.digging) return "RIDING OWN PACE";
  // WHAT HE DOES beats what he wanted: a rester or a loader stuck on the front is
  // pulling — the front branch has no rest exemption, and neither does the label.
  if (r.groupPos === 1 && !r.offline) return "PULLING";
  if (r.attLoad) return "LOADING";
  if (r.isPlayer && S.input.mode === "sit") return "SITTING ON";
  if (r.offline) return "TURN DONE";
  if (!r.isPlayer && (r.sf ?? 1) < PULL_MIN_SF) return "SITTING ON";
  return "RELAYING";
}

// ...and the debug bubble's column has room for five characters, so the same states
// wear their race-radio call signs there
const ROLE_SHORT = {
  SPRINTING: "SPR", ATTACKING: "ATK!", LOADING: "load", COVERING: "cvr", CHASING: "chse",
  DROPPED: "drop", "GOING SOLO": "SOLO", "SITTING ON": "sit", "TURN DONE": "done",
  "RIDING OWN PACE": "own", PULLING: "PULL", RELAYING: "relay",
};
export const roleShort = (S, r) => ROLE_SHORT[roleOf(S, r)] || "?";

export function draw(S, canvas, alpha) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const C = S.course;
  const p = S.riders[0];
  let focus = p;
  if (p.finished != null || p.caught) {
    focus = S.riders.find((r) => r.finished == null && !r.caught) || p;
  }
  const cx = lerp(focus.prevDist, focus.dist, alpha);
  const pxm = w / VIEW_M;          // pixels per metre
  const sv = pxm;                  // height at true 1:1 — a 6 % ramp looks like 6 %
  const eleC = C.eleAt(cx);
  const baseY = h * 0.56;
  const floorY = h - 46 - 16;      // the road never disappears under the road book
  const yOf = (d) => Math.min(baseY - (C.eleAt(d) - eleC) * sv, floorY);
  const xOf = (d) => (d - cx) * pxm + w * 0.42;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#5f9fd6"); sky.addColorStop(0.55, "#a9cfec"); sky.addColorStop(1, "#ddeef8");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,250,220,0.85)";
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 26, 0, 6.284); ctx.fill();

  // far hills (parallax from the course itself)
  ctx.fillStyle = "#8fb3d4";
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 12) {
    const d = cx * 0.35 + x / pxm * 3 + 4000;
    ctx.lineTo(x, baseY - 40 - (C.eleAt(Math.abs(d) % C.total) - 300) * 0.35);
  }
  ctx.lineTo(w, h); ctx.fill();

  // ground + road
  ctx.beginPath(); ctx.moveTo(0, h);
  const pts = [];
  for (let x = -8; x <= w + 8; x += 6) {
    const d = cx + (x - w * 0.42) / pxm;
    const y = yOf(d);
    pts.push([x, y]);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 8, h);
  ctx.fillStyle = "#77b24e"; ctx.fill();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = "#9aa0a8"; ctx.lineWidth = Math.max(4, 0.9 * pxm); ctx.stroke();
  ctx.setLineDash([9, 10]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1, 0.12 * pxm); ctx.stroke();
  ctx.setLineDash([]);

  drawScenery(S, ctx, w, xOf, yOf, cx, pxm);

  // roadside furniture: km banners, flamme rouge, finish arch
  const marks = [];
  for (let km = 5; km < C.total / 1000; km += 5) marks.push([C.total - km * 1000, km + " KM"]);
  for (const [d, label] of marks) {
    const x = xOf(d);
    if (x < -40 || x > w + 40) continue;
    const y = yOf(d);
    ctx.fillStyle = "#20242a";
    const M = pxm;
    ctx.fillRect(x - 0.06 * M, y - 3 * M, 0.12 * M, 2.6 * M);
    ctx.fillStyle = "#f7f4ea";
    ctx.fillRect(x - 1.1 * M, y - 4 * M, 2.2 * M, 1 * M);
    ctx.fillStyle = "#20242a";
    ctx.font = "700 " + Math.max(7, Math.round(0.62 * M)) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - 3.25 * M);
  }
  // the last kilometre, dressed the way a real finale is: the flamme rouge is a
  // PORTAL over the road with the red pennant hanging from the beam, the crowd
  // thickens from there to the line behind barriers on the finishing straight, and
  // the red boards count down 500/400/300/200/150/100/50 — between the portal and
  // 500 there is nothing, exactly as at a real finish.
  const fr = xOf(C.total - 1000);
  if (fr > -60 && fr < w + 60) {
    const y = yOf(C.total - 1000);
    const M = pxm;
    ctx.fillStyle = "#20242a";
    ctx.fillRect(fr - 2.6 * M, y - 5.2 * M, 0.28 * M, 5.0 * M);
    ctx.fillRect(fr + 2.32 * M, y - 5.2 * M, 0.28 * M, 5.0 * M);
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(fr - 2.6 * M, y - 5.2 * M, 5.2 * M, 1.1 * M);
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.max(7, Math.round(0.62 * M)) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("1 KM", fr, y - 4.4 * M);
    // the pennant, hanging from the beam over the middle of the road
    ctx.fillStyle = "#c8102e";
    ctx.beginPath();
    ctx.moveTo(fr - 0.5 * M, y - 4.1 * M); ctx.lineTo(fr + 0.5 * M, y - 4.1 * M);
    ctx.lineTo(fr, y - 2.9 * M); ctx.fill();
  }

  // the countdown boards of the finishing straight
  for (const bm of [500, 400, 300, 200, 150, 100, 50]) {
    const bx = xOf(C.total - bm);
    if (bx < -30 || bx > w + 30) continue;
    const y = yOf(C.total - bm);
    const M = pxm;
    ctx.fillStyle = "#20242a";
    ctx.fillRect(bx - 0.06 * M, y - 2.6 * M, 0.12 * M, 2.4 * M);
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(bx - 0.95 * M, y - 3.7 * M, 1.9 * M, 1.15 * M);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, 0.06 * M);
    ctx.strokeRect(bx - 0.95 * M, y - 3.7 * M, 1.9 * M, 1.15 * M);
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.max(8, Math.round(0.68 * M)) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(bm), bx, y - 2.82 * M);
  }

  // the crowd: from the flamme rouge it thickens toward the line — one figure per
  // ~8 m at the portal, one per ~2 m at the barriers. Deterministic per spot (the
  // same hash the trees use), so nobody teleports between frames.
  {
    const M = pxm;
    const from = Math.max(C.total - 1000, cx - 60), to = Math.min(C.total, cx + 200 / 1);
    for (let d = Math.ceil(from / 2) * 2; d < to; d += 2) {
      const into = 1 - (C.total - d) / 1000;            // 0 at the portal, 1 at the line
      const density = 0.25 + 0.65 * into;               // chance this 2 m spot holds a fan
      if (hash1(d * 0.731) > density) continue;
      const x = xOf(d + hash1(d * 0.377) * 1.6);
      if (x < -10 || x > w + 10) continue;
      const y = yOf(d) - 3;
      const r1 = hash1(d * 1.13), r2 = hash1(d * 2.71);
      const CROWD = ["#e8443a", "#ffd23f", "#2ec4b6", "#4d96ff", "#f2f6fa", "#b78bfa", "#ff9f43"];
      const hgt = (1.55 + r2 * 0.25) * M;          // people at people size, like the riders
      ctx.fillStyle = CROWD[Math.floor(r1 * CROWD.length)];
      ctx.fillRect(x - 0.26 * M, y - hgt * 0.66, 0.52 * M, hgt * 0.66);   // jacket
      ctx.fillStyle = r2 > 0.5 ? "#e8b98f" : "#8a5f3c";
      ctx.beginPath(); ctx.arc(x, y - hgt * 0.79, 0.17 * M, 0, 6.284); ctx.fill();
      // a few arms in the air near the line
      if (into > 0.6 && r1 > 0.55) {
        ctx.strokeStyle = CROWD[Math.floor(r1 * CROWD.length)]; ctx.lineWidth = Math.max(1.5, 0.09 * M);
        ctx.beginPath(); ctx.moveTo(x - 0.18 * M, y - hgt * 0.62); ctx.lineTo(x - 0.38 * M, y - hgt * 1.02); ctx.stroke();
      }
    }
    // barriers on the last 300 m, in front of the crowd
    const bFrom = Math.max(C.total - 300, cx - 60), bTo = Math.min(C.total, cx + 200);
    if (bTo > bFrom) {
      ctx.strokeStyle = "#c9d4de"; ctx.lineWidth = Math.max(1.5, 0.09 * M);
      ctx.beginPath();
      for (let d = bFrom; d <= bTo; d += 6) {
        const x = xOf(d), y = yOf(d) - 0.85 * M;
        d === bFrom ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.05 * M);
      for (let d = Math.ceil(bFrom / 6) * 6; d < bTo; d += 6) {
        const x = xOf(d);
        if (x < -10 || x > w + 10) continue;
        ctx.beginPath(); ctx.moveTo(x, yOf(d) - 0.85 * M); ctx.lineTo(x, yOf(d)); ctx.stroke();
      }
    }
  }
  const fx = xOf(C.total);
  if (fx > -60 && fx < w + 60) {
    const y = yOf(C.total);
    const M = pxm;
    ctx.fillStyle = "#20242a";
    ctx.fillRect(fx - 2.6 * M, y - 5.5 * M, 0.35 * M, 5.2 * M);
    ctx.fillRect(fx + 2.25 * M, y - 5.5 * M, 0.35 * M, 5.2 * M);
    ctx.fillStyle = "#e8443a";
    ctx.fillRect(fx - 2.6 * M, y - 5.5 * M, 5.2 * M, 1.3 * M);
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.max(8, Math.round(0.8 * M)) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("FINISH", fx, y - 4.55 * M);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 6; i++) ctx.fillRect(fx - 2.4 * M + i * 0.8 * M, y - 0.4 * M + (i % 2) * 0.4 * M, 0.8 * M, 0.4 * M);
  }

  // the peloton — a dark organism
  const pd = lerp(S.pel.prevDist, S.pel.dist, alpha);
  if (xOf(pd) > -160) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const d = pd - row * 3 - col * 2.6 - (row % 2) * 1.2;
        const x = xOf(d);
        if (x < -20 || x > w + 20) continue;
        drawCyclist(ctx, x, yOf(d) - 3, riderK(pxm), row === 0 && col === 0 ? "#ffcf3f" : "#2f3a4a", (S.t + row * 2 + col) * 0.9, "ride", -Math.atan(C.gradAt(d) * 1.6));
      }
    }
  }

  // the riders — each carries his share of the pulling over his head
  const shareGrps = S.groups;
  const shareOf = (r) => {
    const grp = shareGrps.find((g) => g.includes(r));
    if (!grp || grp.length < 2) return null;
    const tot = grp.reduce((s, o) => s + o.paid, 0);
    return tot > 0 ? Math.round((100 * r.paid) / tot) : null;
  };
  const sorted = [...S.riders].sort((a, b) => a.dist - b.dist);
  const bubbles = [];
  for (const r of sorted) {
    if (r.caught) continue;
    const d = lerp(r.prevDist, r.dist, alpha);
    const x = xOf(d);
    if (x < -30 || x > w + 30) continue;
    const y = yOf(d) - 3;
    const g = C.gradAt(d);
    const b = bodyNow(r);
    const mode = r.power > 1.22 * b.T && g > 0.015 ? "stand" : "ride";
    r.ped = (r.ped || 0) + r.speed * 0.045;
    drawCyclist(ctx, x, y, riderK(pxm), r.color, r.ped, mode, -Math.atan(g * 1.6));
    // the arrow sits between his head and his bubble — still "this one is you"
    if (r.isPlayer) {
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 4, y - 27); ctx.lineTo(x + 4, y - 27); ctx.fill();
    }
    // the wheel he is on, for the gap readout — nearest man up the road. Only the
    // debug bubble wants any of this: the ordinary view keeps the road clean and
    // lets the commentary tell the race instead.
    if (DEBUG) {
      let gap = null;
      for (const o of S.riders) {
        if (o === r || o.caught || o.finished != null || o.dist <= r.dist) continue;
        const wg = (o.dist - BIKE) - r.dist;
        if (gap == null || wg < gap) gap = wg;
      }
      bubbles.push({ r, b, x, tipY: y - 29, gap, share: shareOf(r), row: (r.groupPos || 1) % 2 });
    }
  }

  // ...and the bubbles last, so no rider is ever drawn over one. Two staggered rows,
  // then a nudge pass per row — the same chips-on-stalks trick the race map uses,
  // because five riders wheel to wheel are closer together than their labels are wide
  {
    const BW = 59, BH = 72, GAPX = 3;
    for (const row of [0, 1]) {
      const mine = bubbles.filter((m) => m.row === row).sort((a, m) => m.x - a.x);
      mine.forEach((m) => { m.bx = m.x; });
      for (let i = 1; i < mine.length; i++) {
        if (mine[i - 1].bx - mine[i].bx < BW + GAPX) mine[i].bx = mine[i - 1].bx - (BW + GAPX);
      }
    }
    ctx.textAlign = "center";
    for (const m of bubbles) {
      const top = m.tipY - 8 - BH - (m.row ? BH + 4 : 0);
      drawBubble(ctx, m.bx, top, BW, BH, m.r.color, m.x, m.tipY);
      const { r, b } = m;
      // his name, in his own colour — the same signal as the bubble's border and the
      // stalk, so a glance ties the numbers to the man without following the line down
      ctx.font = "800 8px ui-monospace, monospace";
      ctx.fillStyle = r.color;
      ctx.fillText(r.name.split(".").pop().slice(0, 8), m.bx, top + 10);
      {
        ctx.font = "800 9px ui-monospace, monospace";
        const L = m.bx - BW / 2 + 16, R = m.bx + BW / 2 - 15;
        ctx.fillStyle = "#f2f6fa";
        ctx.fillText(Math.round(r.power) + "W", L, top + 23);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(Math.round(b.T) + "T", L, top + 34);
        ctx.fillStyle = "#ffd23f";
        ctx.fillText(roleShort(S, r), L, top + 45);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        // wheels overlap by centimetres in a tight line, and "-0.0" is just noise
        ctx.fillText(m.gap == null ? "—" : (Math.abs(m.gap) < 0.05 ? 0 : m.gap).toFixed(1), L, top + 56);
        ctx.fillStyle = tankHue(b.sf);
        ctx.fillText("S" + Math.round(b.sf * 100), R, top + 23);
        ctx.fillStyle = tankHue(b.ff);
        ctx.fillText("F" + Math.round(b.ff * 100), R, top + 34);
        // durability reads as what is LEFT, the same way the instrument panel shows it —
        // so the number agrees with its own colour, and with the bar below. Prefix D;
        // the draft-share row below is DR so the two cannot be confused
        ctx.fillStyle = tankHue(1 - r.wear);
        ctx.fillText("D" + Math.round((1 - r.wear) * 100), R, top + 45);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        // the share he is taking in the wind — the complement of the wheel's saving.
        // Two characters like S/F/L above it: the bubble is 59 px and this column
        // shares its row with the wheel gap on the left
        ctx.fillText("WI" + Math.round((1 - r.ly) * 100), R, top + 56);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(m.share == null ? "—" : "DR" + m.share + "%", m.bx, top + 67);
      }
    }
  }

  // wind sock — pinned in the window's top right corner, tucked under the chyron
  const hw = C.windAt(cx);
  const wtxt = (hw > 0.4 ? "HEAD" : hw < -0.4 ? "TAIL" : "CROSS") + " " + Math.abs(C.wv).toFixed(1);
  ctx.font = "800 10px ui-monospace, monospace";
  const cw = ctx.measureText(wtxt).width + 62, chh = 20;
  const cxr = w - cw - 8, cyr = 62;
  const grad = ctx.createLinearGradient(0, cyr, 0, cyr + chh);
  grad.addColorStop(0, "#f4f8fc"); grad.addColorStop(0.55, "#ccd9e6"); grad.addColorStop(1, "#b3c6d8");
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(cxr, cyr, cw, chh, 10); } else { ctx.rect(cxr, cyr, cw, chh); }
  ctx.fill();
  ctx.strokeStyle = "#6f8cab"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#0d3568";
  ctx.textAlign = "left";
  ctx.fillText("WIND", cxr + 9, cyr + 14);
  drawWindsock(ctx, cxr + 44, cyr + 16, hw, C.wv, S.t);
  ctx.textAlign = "right";
  ctx.fillStyle = hw > 0.4 ? "#c22a1e" : hw < -0.4 ? "#1d7a34" : "#123a6b";
  ctx.font = "800 10px ui-monospace, monospace";
  ctx.fillText(wtxt, cxr + cw - 9, cyr + 14);

  drawProfile(S, ctx, w, h, cx);
}
