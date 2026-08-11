/* The golden master: fixed seeds in, finish times out, run against the engine directly.
   No browser, no canvas, no React — which is the whole point of src/sim/ being its own
   thing. `node tools/golden.mjs` checks; `node tools/golden.mjs --write` records. */
import { readFileSync, writeFileSync } from "node:fs";
import { newSim, stepSim } from "../src/sim/index.js";

const race = (seed) => {
  const S = newSim(seed);
  let guard = 0;
  while (!S.riders.every((r) => r.finished != null || r.caught) && guard++ < 6000) stepSim(S);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    seed,
    bench: r3(S.benchT), pelT: r3(S.pel.soloT), base: r3(S.pel.base), finaleP: r3(S.pel.finaleP),
    total: Math.round(S.course.total), wind: r3(S.course.windAt(0)),
    riders: S.riders.map((r) => ({
      name: r.name,
      fin: r.finished == null ? null : r3(r.finished),
      caught: !!r.caught,
      work: Math.round(r.st.work),
      legs: Math.round(r.legs * 1e6) / 1e6,
    })),
  };
};

const want = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8"));
const t0 = Date.now();
const got = want.map((r) => race(r.seed));
const ms = Date.now() - t0;

if (process.argv.includes("--write")) {
  writeFileSync(new URL("./golden.json", import.meta.url), JSON.stringify(got, null, 1) + "\n");
  console.log(`fasit skrevet: ${got.length} løp på ${ms} ms`);
  process.exit(0);
}

let bad = 0;
for (let i = 0; i < want.length; i++) {
  const a = JSON.stringify(want[i]), b = JSON.stringify(got[i]);
  if (a !== b) {
    if (++bad <= 3) {
      console.log("AVVIK seed", want[i].seed);
      console.log("  fasit:", a.slice(0, 200));
      console.log("  nå:   ", b.slice(0, 200));
    }
  }
}
console.log(bad ? `${bad}/${want.length} løp avviker (${ms} ms)`
                : `identisk: ${want.length}/${want.length} løp på ${ms} ms`);
process.exit(bad ? 1 : 0);
