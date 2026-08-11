/* One rider, drawn at true scale. */

export function drawCyclist(ctx, x, y, k, color, ped, mode, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  const wr = 4.4 * k;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#23262b";
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath(); ctx.arc(-5.2 * k, 0, wr, 0, 6.284); ctx.stroke();
  ctx.beginPath(); ctx.arc(5.2 * k, 0, wr, 0, 6.284); ctx.stroke();
  // frame
  ctx.strokeStyle = "#3a3f46";
  ctx.beginPath();
  ctx.moveTo(-5.2 * k, 0); ctx.lineTo(-0.6 * k, -3.4 * k); ctx.lineTo(0.4 * k, -0.4 * k);
  ctx.lineTo(5.2 * k, 0); ctx.lineTo(3.9 * k, -4.2 * k); ctx.lineTo(-0.6 * k, -3.4 * k);
  ctx.stroke();
  let hip, sho, head;
  if (mode === "stand") { hip = [-0.6, -8.6]; sho = [3.0, -11.6]; head = [4.1, -13.2]; }
  else { hip = [-2.0, -6.6]; sho = [3.3, -9.0]; head = [4.5, -10.6]; }
  const bb = [0.4, -0.4];
  const pr = 1.9 * k;
  for (const ph of [ped, ped + Math.PI]) {
    const px = bb[0] * k + Math.cos(ph) * pr, py = bb[1] * k + Math.sin(ph) * pr;
    ctx.strokeStyle = "#1c1f24";
    ctx.lineWidth = 1.7 * k;
    ctx.beginPath();
    ctx.moveTo(hip[0] * k, hip[1] * k);
    const kx = (hip[0] * k + px) / 2 + 1.6 * k, ky = (hip[1] * k + py) / 2;
    ctx.lineTo(kx, ky); ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.3 * k;
  ctx.beginPath(); ctx.moveTo(hip[0] * k, hip[1] * k); ctx.lineTo(sho[0] * k, sho[1] * k); ctx.stroke();
  ctx.strokeStyle = "#e8c9a0";
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath(); ctx.moveTo(sho[0] * k, sho[1] * k); ctx.lineTo(5.0 * k, -4.6 * k); ctx.stroke();
  ctx.fillStyle = "#e8c9a0";
  ctx.beginPath(); ctx.arc(head[0] * k, head[1] * k, 1.5 * k, 0, 6.284); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(head[0] * k, head[1] * k + 0.1, 1.5 * k, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.restore();
}
