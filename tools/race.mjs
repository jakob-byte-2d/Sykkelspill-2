/* One race, with a line of telemetry per second. What used to mean a temporary hook in
   the game, a build, a browser and a click through the menu.
     node tools/race.mjs [seed] [--every=10] */
import { newSim, stepSim } from "../src/sim/index.js";

const seed = Number(process.argv[2] ?? 1000);
const every = Number((process.argv.find((a) => a.startsWith("--every=")) || "--every=10").slice(8));

const S = newSim(seed);
const names = S.riders.map((r) => r.name);
console.log(`seed ${seed}  ${(S.course.total / 1000).toFixed(1)} km  ` +
  `vind ${S.course.windAt(0) > 0 ? "MOT" : "MED"} ${Math.abs(S.course.windAt(0)).toFixed(1)} m/s  ` +
  `feltet i mål ${Math.round(S.pel.soloT + 1)} s`);
console.log("   t    km   grad     " + names.map((n) => n.padStart(9)).join("") + "   (watt, * = rykker)");

let guard = 0;
while (!S.riders.every((r) => r.finished != null || r.caught) && guard++ < 6000) {
  stepSim(S);
  if (S.t % every) continue;
  const lead = Math.max(...S.riders.map((r) => r.dist));
  console.log(
    String(S.t).padStart(5) + (lead / 1000).toFixed(1).padStart(6) +
    (S.course.gradAt(Math.max(lead, 0)) * 100).toFixed(1).padStart(6) + "%   " +
    S.riders.map((r) => (r.caught ? "     TATT" : r.finished != null ? "     MÅL"
      : (Math.round(r.power) + (r.digging ? "*" : "")).padStart(9))).join("")
  );
}
console.log("\nresultat:");
[...S.riders].sort((a, b) => (a.finished ?? 1e9) - (b.finished ?? 1e9)).forEach((r) => {
  console.log("  " + r.name.padEnd(10) + (r.finished != null ? Math.round(r.finished) + " s" : "tatt av feltet"));
});
