/* Worker for the sweep: race N seeds against whatever tuning.js currently says, and
   print one JSON line. A fresh process per value is the only honest way to re-read a
   module constant — patching a live binding would mean making the engine mutable for
   the benefit of a script. */
import { newSim, stepSim } from "../src/sim/index.js";

const seeds = Number(process.argv[2]);
const out = [];
for (let i = 0; i < seeds; i++) {
  const S = newSim(1000 + i * 7919);
  let guard = 0;
  while (!S.riders.every((r) => r.finished != null || r.caught) && guard++ < 6000) stepSim(S);
  const fin = S.riders.filter((r) => r.finished != null).map((r) => r.finished);
  out.push({
    head: S.course.windAt(0) > 0,
    margin: fin.length ? S.pel.soloT + 1 - Math.min(...fin) : null,
    home: fin.length,
  });
}
process.stdout.write(JSON.stringify(out));
