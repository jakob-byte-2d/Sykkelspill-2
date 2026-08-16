/* The solo check: a flat time-trial from the gun, at a band of intensities, must
   never win as a SOLO. This is the standing proof behind the hunt (huntTarget) —
   the break brings back its own escapee, and the bunch eats what the break lets
   go. The invariant is two-headed: no winning race may contain a wire-to-wire
   escape (longest continuous clear-ahead-alone streak above STREAK seconds — the
   pre-hunt exploit measured 1078 s), and across the whole band the dumb bot wins
   at most 2 of 60 — the wins that remain go THROUGH being caught (absorbed, even
   dropped) and are decided by legal in-window moves or a group sprint.

   Usage: node tools/solo.mjs [seeds=12]                             */
import { bodyNow, newSim, setInput, stepSim } from "../src/sim/index.js";

const N = Number(process.argv[2] ?? 12);
const STREAK = 600;
let total = 0, soloWins = 0;
for (const x of [0.98, 1.02, 1.06, 1.1, 1.14]) {
  let wins = 0, caught = 0, beaten = 0;
  const winSeeds = [];
  for (let s = 0; s < N; s++) {
    const S = newSim(1000 + s * 7919);
    setInput(S, { mode: "manual", turn: "manual" });
    const p = S.riders[0];
    let guard = 0, streak = 0, maxStreak = 0;
    while (guard++ < 6000 && !S.riders.every((r) => r.finished != null || r.caught)) {
      const b = bodyNow(p);
      const togo = S.course.total - p.dist;
      // the strategy under test: steady x·T all day, all-out from 400 m
      setInput(S, { watts: Math.round(togo < 400 ? b.ceil : b.T * x) });
      stepSim(S);
      // clear ahead, alone: the wire-to-wire detector
      const clear = p.finished == null && !p.caught && (p.groupSize ?? 1) <= 1
        && S.riders.every((o) => o.isPlayer || o.caught || o.finished != null || o.dist < p.dist);
      streak = clear ? streak + 1 : 0;
      if (streak > maxStreak) maxStreak = streak;
    }
    const fin = S.riders.filter((r) => r.finished != null).sort((a, o) => a.finished - o.finished);
    if (p.caught) caught++;
    else if (fin[0] === p) {
      wins++; winSeeds.push(`${1000 + s * 7919}:${maxStreak}s`);
      if (maxStreak > STREAK) soloWins++;
    } else beaten++;
  }
  total += wins;
  console.log(`x=${x}: ${wins} seiere${winSeeds.length ? ` (${winSeeds.join(", ")})` : ""}, ${caught} tatt av peloton, ${beaten} slått av AI (${N} seeds)`);
}
const ok = soloWins === 0 && total <= 2;
console.log(ok ? `OK: ${total} seiere totalt, ingen wire-to-wire solo — profilen holder`
  : `RØDT: ${soloWins} wire-to-wire soloseiere, ${total} seiere totalt — jakten lekker`);
process.exit(ok ? 0 : 1);
