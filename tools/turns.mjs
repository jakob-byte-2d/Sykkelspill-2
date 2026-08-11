/* How long a man actually holds the front, measured as consecutive seconds at the head
   of a group of two or more. The rotation is the thing you cannot see from a finish
   time, and it is where "this does not feel like a bike race" usually lives.
     npm run turns -- 40                  the distribution as tuning.js stands
     npm run sweep -- COOP_PULL_SPEND …   which constant moves it
   Prints JSON so it can be piped; real turns in a settled five-man break run 30-90 s. */
import { newSim, stepSim } from "../src/sim/index.js";

const seeds = Number(process.argv[2] || 40);
const flat = [], up = [];
let home = 0, races = 0;
for (let s = 0; s < seeds; s++) {
  const S = newSim(1000 + s * 7919);
  const run = new Map();
  let guard = 0;
  while (!S.riders.every((r) => r.finished != null || r.caught) && guard++ < 6000) {
    stepSim(S);
    for (const r of S.riders) {
      const on = r.groupPos === 1 && r.groupSize > 1 && !r.offline && !r.caught && r.finished == null;
      if (on) {
        const c = run.get(r) || { t: 0, g: 0 };
        c.t++; c.g += S.course.gradAt(Math.max(r.dist, 0));
        run.set(r, c);
      } else if (run.has(r)) {
        const c = run.get(r);
        if (c.t >= 3) (c.g / c.t >= 0.02 ? up : flat).push(c.t);
        run.delete(r);
      }
    }
  }
  races++;
  home += S.riders.filter((r) => r.finished != null).length;
}
const q = (a, p) => { const b = a.sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : null; };
process.stdout.write(JSON.stringify({
  flatMed: q(flat, 0.5), flatP90: q(flat, 0.9), flatN: flat.length,
  upMed: q(up, 0.5), upP90: q(up, 0.9),
  home: home / races,
}));
