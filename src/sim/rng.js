/* Seeded randomness and the two arithmetic helpers everything else leans on. */

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const lerp = (a, b, t) => a + (b - a) * t;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussOf(r) {
  let u = 0, v = 0;
  while (!u) u = r(); while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.28318 * v);
}
