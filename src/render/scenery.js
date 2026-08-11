import { clamp } from "../sim/rng.js";

/* Roadside: trees, sunflowers, farmhouses, and the windsock. */

/* ---------------- Roadside: trees, sunflowers, farmhouses ---------------- */
export const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function drawScenery(S, ctx, w, xOf, yOf, cx, pxm) {
  const SP = 34;                                   // metres between candidate spots
  const i0 = Math.floor((cx - 120) / SP), i1 = Math.ceil((cx + 200) / SP);
  const k = pxm;                                   // everything below is sized in metres
  for (let i = i0; i <= i1; i++) {
    const r1 = hash1(i), r2 = hash1(i + 0.37), r3 = hash1(i + 0.91);
    if (r1 > 0.62) continue;                       // most spots stay empty
    const d = i * SP + r2 * 22;
    const x = xOf(d);
    if (x < -70 || x > w + 70) continue;
    const y = yOf(d) - 5;                          // just behind the tarmac
    const j = 0.85 + r3 * 0.45;
    if (r1 < 0.24) drawTree(ctx, x, y, k * 0.19 * j, r3);
    else if (r1 < 0.44) drawSunflowers(ctx, x, y, k * 0.26 * j, i);
    else drawHouse(ctx, x, y, k * 0.34 * j, r2, r3);
  }
}

export function drawTree(ctx, x, y, s, r) {
  const th = (16 + r * 12) * s;
  ctx.fillStyle = "#6b4a2d";
  ctx.fillRect(x - 1.1 * s, y - th * 0.45, 2.2 * s, th * 0.45);
  if (r < 0.35) {                                  // slim poplar
    ctx.fillStyle = "#3f7a34";
    ctx.beginPath();
    ctx.moveTo(x, y - th * 1.45);
    ctx.lineTo(x + 4.2 * s, y - th * 0.35);
    ctx.lineTo(x - 4.2 * s, y - th * 0.35);
    ctx.closePath(); ctx.fill();
  } else {                                         // broad plane tree
    ctx.fillStyle = "#417f37";
    ctx.beginPath(); ctx.arc(x, y - th * 0.95, 7.5 * s, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 5.5 * s, y - th * 0.72, 5.4 * s, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5.5 * s, y - th * 0.75, 5.8 * s, 0, 6.284); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath(); ctx.arc(x + 2.5 * s, y - th * 1.15, 4.2 * s, 0, 6.284); ctx.fill();
  }
}

export function drawSunflowers(ctx, x, y, s, seed) {
  const wdt = 46 * s, hgt = 11 * s;
  ctx.fillStyle = "#5f9c3a";
  ctx.fillRect(x - wdt / 2, y - hgt, wdt, hgt);
  for (let j = 0; j < 16; j++) {
    const q = hash1(seed * 7.3 + j);
    const fx = x - wdt / 2 + 3 * s + q * (wdt - 6 * s);
    const fy = y - hgt - (1.5 + hash1(seed + j * 2.1) * 4) * s;
    ctx.strokeStyle = "#4a7d2e"; ctx.lineWidth = 0.9 * s;
    ctx.beginPath(); ctx.moveTo(fx, y - hgt * 0.2); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = "#f5c518";
    ctx.beginPath(); ctx.arc(fx, fy, 2.1 * s, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#7a4a12";
    ctx.beginPath(); ctx.arc(fx, fy, 0.9 * s, 0, 6.284); ctx.fill();
  }
}

export function drawHouse(ctx, x, y, s, r2, r3) {
  const bw = (22 + r2 * 14) * s, bh = (16 + r3 * 10) * s;
  ctx.fillStyle = r3 < 0.5 ? "#e6d7b8" : "#d9c6a6";   // limewashed stone
  ctx.fillRect(x - bw / 2, y - bh, bw, bh);
  ctx.fillStyle = "#a8462f";                          // terracotta roof
  ctx.beginPath();
  ctx.moveTo(x - bw / 2 - 2.5 * s, y - bh);
  ctx.lineTo(x, y - bh - 8 * s);
  ctx.lineTo(x + bw / 2 + 2.5 * s, y - bh);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5c728a";                          // shutters and door
  const rows = bh > 20 * s ? 2 : 1;
  for (let rw = 0; rw < rows; rw++)
    for (let c = 0; c < 2; c++)
      ctx.fillRect(x - bw * 0.28 + c * bw * 0.34, y - bh + (4 + rw * 8) * s, 4.4 * s, 5 * s);
  ctx.fillStyle = "#6b4a2d";
  ctx.fillRect(x + bw * 0.24, y - 7 * s, 4.6 * s, 7 * s);
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
