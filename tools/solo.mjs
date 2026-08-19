/* The solo check: a flat time-trial from the gun, at a band of intensities, must
   never win FROM THE GUN. This is the standing proof behind the hunt (huntTarget):
   the break brings back an escapee who never bought the right to race, and the
   bunch eats what the break lets go. With the window at ATT_FROM (15 km) a win
   via a LEGAL in-window escape — capital paid, ridden clear — is the game working,
   however long the winning streak reads. The forbidden thing is the wire-to-wire
   solo: a clear-ahead-alone streak that BEGINS before the window opens and holds
   unbroken to the line. Zero of those, and the dumb bot's total stays modest
   (≤8 of 60 — a perfectly-paced threshold TT that escapes legally with capital
   is close to the optimal strategy in a racing sport, and it measures ~7).

   Usage: node tools/solo.mjs [seeds=12]                             */
import { ATT_FROM } from "../src/content/tuning.js";
import { bodyNow, newSim, setInput, stepSim } from "../src/sim/index.js";

const N = Number(process.argv[2] ?? 12);
let total = 0, soloWins = 0;
for (const x of [0.98, 1.02, 1.06, 1.1, 1.14]) {
  let wins = 0, caught = 0, beaten = 0;
  const winSeeds = [];
  for (let s = 0; s < N; s++) {
    const S = newSim(1000 + s * 7919);
    setInput(S, { mode: "manual", turn: "manual" });
    const p = S.riders[0];
    let guard = 0, streak = 0, maxStreak = 0, streakFromGun = false, startTogo = 0;
    while (guard++ < 6000 && !S.riders.every((r) => r.finished != null || r.caught)) {
      const b = bodyNow(p);
      const togo = S.course.total - p.dist;
      // the strategy under test: steady x·T all day, all-out from 400 m
      setInput(S, { watts: Math.round(togo < 400 ? b.ceil : b.T * x) });
      stepSim(S);
      // clear ahead, alone: the wire-to-wire detector — a streak is FROM THE GUN
      // if it began before the racing window opened (pre-ATT_FROM road)
      const clear = p.finished == null && !p.caught && (p.groupSize ?? 1) <= 1
        && S.riders.every((o) => o.isPlayer || o.caught || o.finished != null || o.dist < p.dist);
      if (clear && streak === 0) startTogo = S.course.total - p.dist;
      streak = clear ? streak + 1 : 0;
      if (streak > maxStreak) maxStreak = streak;
      if (p.finished != null && streak > 0 && startTogo > ATT_FROM) streakFromGun = true;
    }
    const fin = S.riders.filter((r) => r.finished != null).sort((a, o) => a.finished - o.finished);
    if (p.caught) caught++;
    else if (fin[0] === p) {
      wins++; winSeeds.push(`${1000 + s * 7919}:${maxStreak}s${streakFromGun ? ":FRA-START" : ""}`);
      if (streakFromGun) soloWins++;
    } else beaten++;
  }
  total += wins;
  console.log(`x=${x}: ${wins} seiere${winSeeds.length ? ` (${winSeeds.join(", ")})` : ""}, ${caught} tatt av peloton, ${beaten} slått av AI (${N} seeds)`);
}
const ok = soloWins === 0 && total <= 8;
console.log(ok ? `OK: ${total} seiere totalt, ingen wire-to-wire solo — profilen holder`
  : `RØDT: ${soloWins} wire-to-wire soloseiere, ${total} seiere totalt — jakten lekker`);
process.exit(ok ? 0 : 1);
