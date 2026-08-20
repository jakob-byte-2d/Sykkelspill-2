import { clamp } from "../sim/rng.js";

/* Roadside: trees, sunflowers, farmhouses, and the windsock. */

/* ---------------- Roadside: trees, sunflowers, farmhouses ---------------- */
export const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* Every prop below is sized in REAL METRES times s (= pixels per metre), against
   riders drawn at true 1.58 m — a farmhouse is ~5 m to the eaves, a sunflower
   chest-high, a fence hip-high. The old factors made houses tower 10 m over the
   riders, which is what "the scenery looks oversized" was. */
export function drawScenery(S, ctx, w, xOf, yOf, cx, pxm) {
  const SP = 34;                                   // metres between candidate spots
  const i0 = Math.floor((cx - 120) / SP), i1 = Math.ceil((cx + 200) / SP);
  for (let i = i0; i <= i1; i++) {
    const r1 = hash1(i), r2 = hash1(i + 0.37), r3 = hash1(i + 0.91);
    if (r1 > 0.62) continue;                       // most spots stay empty
    const d = i * SP + r2 * 22;
    if (d > S.course.total - 1000) continue;       // the last km belongs to the crowd
    const x = xOf(d);
    if (x < -70 || x > w + 70) continue;
    const y = yOf(d) - 5;                          // just behind the tarmac
    const j = 0.85 + r3 * 0.3;
    // on a real climb the roadside fills with people — the steeper, the truer
    if (S.course.gradAt(d) > 0.05 && r1 < 0.4) { drawFans(ctx, x, y + 3, pxm, i); continue; }
    if (r1 < 0.20) drawTree(ctx, x, y, pxm * j, r3);
    else if (r1 < 0.33) drawSunflowers(ctx, x, y, pxm * j, i);
    else if (r1 < 0.44) drawFence(ctx, x, y, pxm, i);
    else if (r1 < 0.52) drawBale(ctx, x, y, pxm * j, r2);
    else drawHouse(ctx, x, y, pxm * (0.9 + r3 * 0.25), r2, r3);
  }
}

export function drawTree(ctx, x, y, s, r) {
  if (r < 0.3) {                                   // slim poplar, ~8 m
    ctx.fillStyle = "#6b4a2d";
    ctx.fillRect(x - 0.18 * s, y - 1.6 * s, 0.36 * s, 1.6 * s);
    ctx.fillStyle = "#3f7a34";
    ctx.beginPath();
    ctx.moveTo(x, y - 8 * s);
    ctx.lineTo(x + 1.25 * s, y - 1.3 * s);
    ctx.lineTo(x - 1.25 * s, y - 1.3 * s);
    ctx.closePath(); ctx.fill();
  } else if (r < 0.65) {                           // broad plane tree, ~5 m
    ctx.fillStyle = "#6b4a2d";
    ctx.fillRect(x - 0.2 * s, y - 2.0 * s, 0.4 * s, 2.0 * s);
    ctx.fillStyle = "#417f37";
    ctx.beginPath(); ctx.arc(x, y - 3.4 * s, 1.6 * s, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 1.2 * s, y - 2.8 * s, 1.15 * s, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 1.2 * s, y - 2.9 * s, 1.25 * s, 0, 6.284); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath(); ctx.arc(x + 0.55 * s, y - 3.9 * s, 0.9 * s, 0, 6.284); ctx.fill();
  } else {                                         // pine, ~7 m, three dark tiers
    ctx.fillStyle = "#5d4026";
    ctx.fillRect(x - 0.16 * s, y - 1.2 * s, 0.32 * s, 1.2 * s);
    ctx.fillStyle = "#2e5f33";
    for (let t = 0; t < 3; t++) {
      const base = y - (1.0 + t * 1.7) * s, half = (1.9 - t * 0.45) * s;
      ctx.beginPath();
      ctx.moveTo(x, base - 2.6 * s);
      ctx.lineTo(x + half, base);
      ctx.lineTo(x - half, base);
      ctx.closePath(); ctx.fill();
    }
  }
}

export function drawSunflowers(ctx, x, y, s, seed) {
  // a strip of them, chest-high — heads at 1.4-1.8 m
  const wdt = 6 * s, hgt = 0.9 * s;
  ctx.fillStyle = "#5f9c3a";
  ctx.fillRect(x - wdt / 2, y - hgt, wdt, hgt);
  for (let j = 0; j < 12; j++) {
    const q = hash1(seed * 7.3 + j);
    const fx = x - wdt / 2 + 0.4 * s + q * (wdt - 0.8 * s);
    const fy = y - hgt - (0.5 + hash1(seed + j * 2.1) * 0.4) * s;
    ctx.strokeStyle = "#4a7d2e"; ctx.lineWidth = Math.max(0.8, 0.07 * s);
    ctx.beginPath(); ctx.moveTo(fx, y - hgt * 0.2); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = "#f5c518";
    ctx.beginPath(); ctx.arc(fx, fy, 0.18 * s, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#7a4a12";
    ctx.beginPath(); ctx.arc(fx, fy, 0.08 * s, 0, 6.284); ctx.fill();
  }
}

export function drawFence(ctx, x, y, s, seed) {
  // weathered post-and-rail, hip-high, ~8 m of it
  const half = 4 * s, ph = 1.1 * s;
  ctx.strokeStyle = "#8a6b4a"; ctx.lineWidth = Math.max(1, 0.09 * s);
  for (const ry of [0.55, 0.95]) {
    ctx.beginPath(); ctx.moveTo(x - half, y - ry * s); ctx.lineTo(x + half, y - ry * s); ctx.stroke();
  }
  ctx.fillStyle = "#79593c";
  const n = 6;
  for (let p = 0; p <= n; p++) {
    const px = x - half + (p / n) * half * 2 + (hash1(seed * 3.1 + p) - 0.5) * 0.15 * s;
    ctx.fillRect(px - 0.07 * s, y - ph, 0.14 * s, ph);
  }
}

export function drawBale(ctx, x, y, s, r) {
  // a round bale on its side, ~1.5 m across
  const R = 0.75 * s;
  ctx.fillStyle = "#d9b45c";
  ctx.beginPath(); ctx.arc(x, y - R, R, 0, 6.284); ctx.fill();
  ctx.strokeStyle = "#c29a3f"; ctx.lineWidth = Math.max(1, 0.08 * s);
  ctx.beginPath(); ctx.arc(x, y - R, R * 0.62, 0, 6.284); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y - R, R * 0.3, 0, 6.284); ctx.stroke();
  if (r > 0.6) {                                   // sometimes a second, leaning pair
    ctx.fillStyle = "#d0ab50";
    ctx.beginPath(); ctx.arc(x + 1.7 * s, y - R * 0.9, R * 0.9, 0, 6.284); ctx.fill();
  }
}

export function drawHouse(ctx, x, y, s, r2, r3) {
  // a village farmhouse: ~5 m to the eaves, ~8 m wide — not the old three-storey wall
  const bw = (7 + r2 * 3.5) * s, bh = (4.2 + r3 * 1.6) * s;
  ctx.fillStyle = r3 < 0.5 ? "#e6d7b8" : "#d9c6a6";   // limewashed stone
  ctx.fillRect(x - bw / 2, y - bh, bw, bh);
  ctx.fillStyle = "#a8462f";                          // terracotta roof
  ctx.beginPath();
  ctx.moveTo(x - bw / 2 - 0.6 * s, y - bh);
  ctx.lineTo(x, y - bh - 2.2 * s);
  ctx.lineTo(x + bw / 2 + 0.6 * s, y - bh);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5c728a";                          // shutters
  const rows = bh > 5 * s ? 2 : 1;
  for (let rw = 0; rw < rows; rw++)
    for (let c = 0; c < 2; c++)
      ctx.fillRect(x - bw * 0.3 + c * bw * 0.38, y - bh + (0.9 + rw * 2.2) * s, 1.0 * s, 1.25 * s);
  ctx.fillStyle = "#6b4a2d";                          // the door, person-sized
  ctx.fillRect(x + bw * 0.22, y - 2.1 * s, 1.0 * s, 2.1 * s);
}

const FAN_KIT = ["#e0483c", "#3a76bd", "#f5c518", "#2f9e4f", "#8e6bd6", "#f4f4f4", "#e07f28"];
export function drawFans(ctx, x, y, s, seed) {
  // a knot of spectators, person-sized against person-sized riders
  const n = 3 + Math.floor(hash1(seed * 1.7) * 4);
  for (let p = 0; p < n; p++) {
    const q1 = hash1(seed * 5.3 + p), q2 = hash1(seed * 9.1 + p), q3 = hash1(seed * 2.9 + p);
    const fx = x + (q1 - 0.5) * 4.5 * s;
    const hgt = (1.55 + q2 * 0.3) * s;
    const shirt = FAN_KIT[Math.floor(q3 * FAN_KIT.length)];
    ctx.fillStyle = "#31455c";                     // legs
    ctx.fillRect(fx - 0.11 * s, y - hgt * 0.45, 0.22 * s, hgt * 0.45);
    ctx.fillStyle = shirt;                         // torso
    ctx.fillRect(fx - 0.16 * s, y - hgt * 0.82, 0.32 * s, hgt * 0.4);
    if (q2 > 0.55) {                               // an arm up, roaring the break on
      ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(1, 0.09 * s);
      ctx.beginPath(); ctx.moveTo(fx + 0.13 * s, y - hgt * 0.78); ctx.lineTo(fx + 0.3 * s, y - hgt * 1.06); ctx.stroke();
    }
    ctx.fillStyle = "#e8c9a0";                     // head
    ctx.beginPath(); ctx.arc(fx, y - hgt * 0.92, 0.14 * s, 0, 6.284); ctx.fill();
  }
}

/* a windsock on its pole — it streams the way the wind actually blows */
export function drawWindsock(ctx, px, py, hw, wv, t) {
  const H = 13;
  ctx.strokeStyle = "#3c5a7a"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - H); ctx.stroke();
  // riders travel left → right, so a headwind blows back down the road (to the left)
  const along = clamp(hw / Math.max(wv, 0.1), -1, 1);
  const dir = along > 0 ? -1 : 1;                 // headwind streams left, tailwind right
  const reach = (5 + 10 * Math.abs(along)) * dir; // pure crosswind barely reaches across
  const droop = 5 * (1 - Math.abs(along));        // and hangs more sideways instead
  const sway = Math.sin(t * 0.35) * 0.9;
  const ax = px, ay = py - H + 0.5;
  ctx.fillStyle = "#e0483c";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + reach, ay + droop + sway + 1.2);
  ctx.lineTo(ax, ay + 5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f4f8fc";
  ctx.beginPath();
  ctx.moveTo(ax, ay + 1.6);
  ctx.lineTo(ax + reach * 0.55, ay + (droop + sway) * 0.55 + 2.2);
  ctx.lineTo(ax, ay + 3.6);
  ctx.closePath(); ctx.fill();
}
