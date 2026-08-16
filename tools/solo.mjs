/* The solo check: a flat time-trial from the gun, at a band of intensities, must
   not win the race. This is the standing proof behind the hunt (huntTarget) — the
   break brings back its own escapee, and the bunch eats what the break lets go.
   Profile: ≤1 win across the whole band over 12 seeds, and any survivor's win is a
   late in-window move or a group sprint, never a ridden-clear solo.

   Usage: node tools/solo.mjs [seeds=12]                             */
import { bodyNow, newSim, setInput, stepSim } from "../src/sim/index.js";

const N = Number(process.argv[2] ?? 12);
let total = 0;
for (const x of [0.98, 1.02, 1.06, 1.1, 1.14]) {
  let wins = 0, caught = 0, beaten = 0;
  const winSeeds = [];
  for (let s = 0; s < N; s++) {
    const S = newSim(1000 + s * 7919);
    setInput(S, { mode: "manual", turn: "manual" });
    const p = S.riders[0];
    let guard = 0;
    while (guard++ < 6000 && !S.riders.every((r) => r.finished != null || r.caught)) {
      const b = bodyNow(p);
      const togo = S.course.total - p.dist;
      // the strategy under test: steady x·T all day, all-out from 400 m
      setInput(S, { watts: Math.round(togo < 400 ? b.ceil : b.T * x) });
      stepSim(S);
    }
    const fin = S.riders.filter((r) => r.finished != null).sort((a, o) => a.finished - o.finished);
    if (p.caught) caught++;
    else if (fin[0] === p) { wins++; winSeeds.push(1000 + s * 7919); }
    else beaten++;
  }
  total += wins;
  console.log(`x=${x}: ${wins} seiere${winSeeds.length ? ` (${winSeeds})` : ""}, ${caught} tatt av peloton, ${beaten} slått av AI (${N} seeds)`);
}
console.log(total <= 1 ? `OK: ${total} soloseier totalt — profilen holder` : `RØDT: ${total} soloseiere — jakten lekker`);
process.exit(total <= 1 ? 0 : 1);
