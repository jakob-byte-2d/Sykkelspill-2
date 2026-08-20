/* One rider, drawn at true scale. The silhouette and its bounds are unchanged from
   the stick-figure original (name tags, the arrow and hit-testing all assume them);
   what grew is the detail inside it: a shadow on the tarmac, wheels with rims and
   spokes that actually turn, a saddle, drop bars and a chainring, two-tone legs
   (bib, skin, sock, shoe) with the far leg dimmed for depth, and the rider's own
   skin tone carried in from the roster's look. */

export function drawCyclist(ctx, x, y, k, color, ped, mode, lean, skin = "#e8c9a0") {
  ctx.save();
  ctx.translate(x, y);
  // the shadow stays flat on the road whatever the lean does
  ctx.fillStyle = "rgba(18,28,40,0.16)";
  ctx.beginPath(); ctx.ellipse(0, 4.6 * k, 7.4 * k, 1.0 * k, 0, 0, 6.284); ctx.fill();
  ctx.rotate(lean);
  const wr = 4.4 * k;
  ctx.lineCap = "round";
  // wheels: tire, a light rim, three spokes turning with the road — front and rear
  // de-phased so they never spin in lockstep
  const wang = ped * 2.3;
  for (const wx of [-5.2, 5.2]) {
    ctx.strokeStyle = "#23262b"; ctx.lineWidth = 1.5 * k;
    ctx.beginPath(); ctx.arc(wx * k, 0, wr, 0, 6.284); ctx.stroke();
    ctx.strokeStyle = "rgba(210,216,226,0.85)"; ctx.lineWidth = 0.38 * k;
    ctx.beginPath(); ctx.arc(wx * k, 0, wr * 0.7, 0, 6.284); ctx.stroke();
    ctx.lineWidth = 0.32 * k;
    for (let sp = 0; sp < 3; sp++) {
      const a = wang + sp * 2.094 + wx;
      ctx.beginPath();
      ctx.moveTo(wx * k - Math.cos(a) * wr * 0.78, -Math.sin(a) * wr * 0.78);
      ctx.lineTo(wx * k + Math.cos(a) * wr * 0.78, Math.sin(a) * wr * 0.78);
      ctx.stroke();
    }
  }
  // frame
  ctx.strokeStyle = "#3a3f46";
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath();
  ctx.moveTo(-5.2 * k, 0); ctx.lineTo(-0.6 * k, -3.4 * k); ctx.lineTo(0.4 * k, -0.4 * k);
  ctx.lineTo(5.2 * k, 0); ctx.lineTo(3.9 * k, -4.2 * k); ctx.lineTo(-0.6 * k, -3.4 * k);
  ctx.stroke();
  // saddle, drop bars, chainring
  ctx.strokeStyle = "#1c1f24"; ctx.lineWidth = 0.9 * k;
  ctx.beginPath(); ctx.moveTo(-1.8 * k, -3.8 * k); ctx.lineTo(-0.1 * k, -3.8 * k); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3.8 * k, -4.5 * k);
  ctx.quadraticCurveTo(5.4 * k, -4.6 * k, 5.2 * k, -3.4 * k);
  ctx.stroke();
  ctx.fillStyle = "#23262b";
  ctx.beginPath(); ctx.arc(0.4 * k, -0.4 * k, 0.9 * k, 0, 6.284); ctx.fill();
  let hip, sho, head;
  if (mode === "stand") { hip = [-0.6, -8.6]; sho = [3.0, -11.6]; head = [4.1, -13.2]; }
  else { hip = [-2.0, -6.6]; sho = [3.3, -9.0]; head = [4.5, -10.6]; }
  const bb = [0.4, -0.4];
  const pr = 1.9 * k;
  // far leg first and dimmed, near leg on top — bib shorts down to the knee,
  // skin below, a white sock and a dark shoe at the pedal
  for (const [ph, dim] of [[ped + Math.PI, 0.62], [ped, 1]]) {
    const px = bb[0] * k + Math.cos(ph) * pr, py = bb[1] * k + Math.sin(ph) * pr;
    const kx = (hip[0] * k + px) / 2 + 1.6 * k, ky = (hip[1] * k + py) / 2;
    ctx.globalAlpha = dim;
    ctx.strokeStyle = "#1c1f24";
    ctx.lineWidth = 1.7 * k;
    ctx.beginPath(); ctx.moveTo(hip[0] * k, hip[1] * k); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 1.3 * k;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(px, py); ctx.stroke();
    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 1.35 * k;
    ctx.beginPath();
    ctx.moveTo(kx + (px - kx) * 0.72, ky + (py - ky) * 0.72);
    ctx.lineTo(kx + (px - kx) * 0.9, ky + (py - ky) * 0.9);
    ctx.stroke();
    ctx.strokeStyle = "#15181c";
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath(); ctx.moveTo(px - 0.7 * k, py); ctx.lineTo(px + 0.8 * k, py); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // torso in the kit, the arm in the rider's own skin
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.3 * k;
  ctx.beginPath(); ctx.moveTo(hip[0] * k, hip[1] * k); ctx.lineTo(sho[0] * k, sho[1] * k); ctx.stroke();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath(); ctx.moveTo(sho[0] * k, sho[1] * k); ctx.lineTo(5.0 * k, -4.6 * k); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(head[0] * k, head[1] * k, 1.5 * k, 0, 6.284); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(head[0] * k, head[1] * k + 0.1, 1.5 * k, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.restore();
}
