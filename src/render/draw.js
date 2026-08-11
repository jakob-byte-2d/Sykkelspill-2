import { bodyNow } from "../sim/body.js";
import { BIKE, SHEL_MAX } from "../sim/physics.js";
import { lerp } from "../sim/rng.js";
import { drawCyclist } from "./cyclist.js";
import { drawProfile } from "./profile.js";
import { drawScenery, drawWindsock } from "./scenery.js";

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
export function roleOf(S, r) {
  if (r.groupSize <= 1) return "solo";
  if (r.isPlayer && S.input.mode === "sit") return "sit";
  if (r.groupPos === 1 && !r.offline) return "FRONT";
  if (r.offline) return "drop";
  return "wheel";
}

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
  const fr = xOf(C.total - 1000);
  if (fr > -30 && fr < w + 30) {
    const y = yOf(C.total - 1000);
    const M = pxm;
    ctx.fillStyle = "#c8102e";
    ctx.beginPath(); ctx.moveTo(fr, y - 4.2 * M); ctx.lineTo(fr + 1.8 * M, y - 3.6 * M); ctx.lineTo(fr, y - 3.1 * M); ctx.fill();
    ctx.fillStyle = "#20242a"; ctx.fillRect(fr - 0.06 * M, y - 4.2 * M, 0.12 * M, 3.8 * M);
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
    // the wheel he is on, for the gap readout — nearest man up the road
    let gap = null;
    for (const o of S.riders) {
      if (o === r || o.caught || o.finished != null || o.dist <= r.dist) continue;
      const wg = (o.dist - BIKE) - r.dist;
      if (gap == null || wg < gap) gap = wg;
    }
    bubbles.push({ r, b, x, tipY: y - 29, gap, share: shareOf(r), row: (r.groupPos || 1) % 2 });
  }

  // ...and the bubbles last, so no rider is ever drawn over one. Two staggered rows,
  // then a nudge pass per row — the same chips-on-stalks trick the race map uses,
  // because five riders wheel to wheel are closer together than their labels are wide
  {
    const BW = DEBUG ? 59 : 48, BH = DEBUG ? 72 : 50, GAPX = 3;
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
      if (!DEBUG) {
        ctx.font = "800 10px ui-monospace, monospace";
        ctx.fillStyle = "#f2f6fa";
        ctx.fillText(Math.round(r.power) + " W", m.bx, top + 24);
        ctx.fillStyle = tankHue(b.sf);
        ctx.fillText("S" + Math.round(b.sf * 100) + "%", m.bx, top + 36);
        ctx.font = "800 9px ui-monospace, monospace";
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(m.share == null ? "—" : "D" + m.share + "%", m.bx, top + 47);
      } else {
        ctx.font = "800 9px ui-monospace, monospace";
        const L = m.bx - BW / 2 + 16, R = m.bx + BW / 2 - 15;
        ctx.fillStyle = "#f2f6fa";
        ctx.fillText(Math.round(r.power) + "W", L, top + 23);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(Math.round(b.T) + "T", L, top + 34);
        ctx.fillStyle = "#ffd23f";
        ctx.fillText(roleOf(S, r), L, top + 45);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        // wheels overlap by centimetres in a tight line, and "-0.0" is just noise
        ctx.fillText(m.gap == null ? "—" : (Math.abs(m.gap) < 0.05 ? 0 : m.gap).toFixed(1), L, top + 56);
        ctx.fillStyle = tankHue(b.sf);
        ctx.fillText("S" + Math.round(b.sf * 100), R, top + 23);
        ctx.fillStyle = tankHue(b.ff);
        ctx.fillText("F" + Math.round(b.ff * 100), R, top + 34);
        // legs reads as what is LEFT, the same way the instrument panel shows it —
        // so the number agrees with its own colour, and with the bar below
        ctx.fillStyle = tankHue(1 - r.legs);
        ctx.fillText("L" + Math.round((1 - r.legs) * 100), R, top + 45);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText("LY" + Math.round((r.shel / SHEL_MAX) * 100), R, top + 56);
        ctx.fillStyle = "rgba(190,210,230,0.9)";
        ctx.fillText(m.share == null ? "—" : "D" + m.share + "%", m.bx, top + 67);
      }
    }
  }

  // wind sock — top right corner, clear of the chyron
  const hw = C.windAt(cx);
  const wtxt = (hw > 0.4 ? "HEAD" : hw < -0.4 ? "TAIL" : "CROSS") + " " + Math.abs(C.wv).toFixed(1);
  ctx.font = "800 10px ui-monospace, monospace";
  const cw = ctx.measureText(wtxt).width + 62, chh = 20;
  const cxr = w - 88 - cw, cyr = 88;
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
