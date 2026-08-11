import { clamp } from "../sim/rng.js";

/* The road book along the bottom: the whole stage, and everyone on it. */

/* ---------------- The road book: whole profile, bottom strip ---------------- */
export function drawProfile(S, ctx, w, h, cx) {
  const C = S.course;
  const PH = 46;                       // strip height
  const top = h - PH, pad = 8;
  const iw = w - pad * 2, ih = PH - 16;

  // chrome frame
  const fr = ctx.createLinearGradient(0, top, 0, h);
  fr.addColorStop(0, "#dbe6f2"); fr.addColorStop(1, "#a9bed3");
  ctx.fillStyle = fr; ctx.fillRect(0, top, w, PH);
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(0, top, w, 1);
  ctx.fillStyle = "#6f8cab"; ctx.fillRect(0, top - 2, w, 2);

  // elevation range across the whole course — the course never changes, so sample once
  const N = 140;
  if (!S.profile) {
    let lo = 1e9, hi = -1e9;
    const xs = [];
    for (let i = 0; i <= N; i++) {
      const e = C.eleAt((i / N) * C.total);
      xs.push(e); if (e < lo) lo = e; if (e > hi) hi = e;
    }
    S.profile = { xs, lo, hi };
  }
  const { xs, lo, hi } = S.profile;
  const span = Math.max(hi - lo, 30);
  const px = (i) => pad + (i / N) * iw;
  const py = (e) => top + 12 + ih - ((e - lo) / span) * ih;

  // the ridden part in flat grey, the rest in green
  const prog = clamp(cx / C.total, 0, 1);
  const cut = prog * N;
  const band = (from, to, fill) => {
    if (to <= from) return;
    ctx.beginPath();
    ctx.moveTo(px(from), top + 12 + ih);
    for (let i = Math.floor(from); i <= Math.ceil(to); i++) {
      const t = clamp(i, from, to);
      ctx.lineTo(px(t), py(xs[clamp(Math.round(t), 0, N)]));
    }
    ctx.lineTo(px(to), top + 12 + ih);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  };
  band(0, cut, "#9aa8b6");
  band(cut, N, "#6aa84f");

  // outline
  ctx.beginPath();
  for (let i = 0; i <= N; i++) (i ? ctx.lineTo(px(i), py(xs[i])) : ctx.moveTo(px(i), py(xs[i])));
  ctx.strokeStyle = "#2c4a2a"; ctx.lineWidth = 1; ctx.stroke();

  // 5-km ticks
  ctx.fillStyle = "rgba(20,45,75,0.45)";
  for (let km = 5; km < C.total / 1000; km += 5) {
    const x = pad + (km * 1000 / C.total) * iw;
    ctx.fillRect(x, top + 12, 1, ih);
  }

  // the race map: every group is flagged at all times — the bunch is chasing, after all —
  // chips on stalks, nudged apart so neighbours never overlap
  const grps = S.groups;
  {
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.textAlign = "center";
    const CW = 18, GAPX = 2;
    const marks = grps.map((grp, gi) => {
      const gd = clamp(grp[0].dist, 0, C.total);
      return { label: "G" + (gi + 1), mine: grp.includes(S.riders[0]), pel: false, lineX: pad + (gd / C.total) * iw, lineY: py(C.eleAt(gd)), x: 0 };
    });
    if (S.pel.dist > 0) {
      const pd = clamp(S.pel.dist, 0, C.total);
      marks.push({ label: "P", mine: false, pel: true, lineX: pad + (pd / C.total) * iw, lineY: py(C.eleAt(pd)), x: 0 });
    }
    marks.sort((a, b) => b.lineX - a.lineX);      // front to back
    marks.forEach((mk) => { mk.x = mk.lineX; });
    for (let i = 1; i < marks.length; i++) {
      const prev = marks[i - 1];
      if (prev.x - marks[i].x < CW + GAPX) marks[i].x = prev.x - (CW + GAPX);   // slide the rear one back
    }
    for (const mk of marks) {
      const top = mk.lineY - 22;
      ctx.strokeStyle = "rgba(19,58,107,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mk.x, top + 11); ctx.lineTo(mk.lineX, mk.lineY); ctx.stroke();
      ctx.fillStyle = mk.mine ? "rgba(255,210,63,0.95)" : mk.pel ? "rgba(16,28,44,0.94)" : "rgba(19,58,107,0.92)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(mk.x - CW / 2, top, CW, 11, 5); else ctx.rect(mk.x - CW / 2, top, CW, 11);
      ctx.fill();
      ctx.fillStyle = mk.mine ? "#14181d" : "#fff";
      ctx.fillText(mk.label, mk.x, top + 8.5);
    }
  }
  // labels
  ctx.font = "700 9px ui-monospace, monospace";
  ctx.fillStyle = "#0d3568"; ctx.textAlign = "left";
  ctx.fillText("START", pad, top + 9);
  ctx.textAlign = "right";
  ctx.fillText(Math.round(hi - lo) + " M", w - pad, top + 9);
}
