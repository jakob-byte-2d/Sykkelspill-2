/* A balance sweep: every course, every wind, every value of a tuning constant, and the
   distribution that comes out.
     npm run sweep -- PEL_LEAD -0.05 -0.06 -0.07 --seeds=40
   This is the thing that used to require a temporary rig bolted into the game and
   stripped out again afterwards. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as tuning from "../src/content/tuning.js";

const args = process.argv.slice(2);
const key = args[0];
const values = args.slice(1).filter((a) => !a.startsWith("--")).map(Number);
const seeds = Number((args.find((a) => a.startsWith("--seeds=")) || "--seeds=40").slice(8));

if (!key || !values.length || values.some(Number.isNaN)) {
  console.error("bruk: npm run sweep -- <KONSTANT> <verdi...> [--seeds=40]");
  console.error("\nkonstanter:\n  " + Object.keys(tuning).join("  "));
  process.exit(1);
}
if (!(key in tuning)) { console.error(`ukjent konstant: ${key}`); process.exit(1); }

const path = new URL("../src/content/tuning.js", import.meta.url);
const runner = new URL("./_runner.mjs", import.meta.url);
const original = readFileSync(path, "utf8");
const re = new RegExp(`^export const ${key} = [^;]+;`, "m");
if (!re.test(original)) { console.error(`fant ikke "${key} = ..." i tuning.js`); process.exit(1); }

const t0 = Date.now();
const rows = [];
try {
  for (const v of values) {
    writeFileSync(path, original.replace(re, `export const ${key} = ${v};`));
    rows.push({ v, runs: JSON.parse(execFileSync(process.execPath, [runner.pathname, String(seeds)])) });
  }
} finally {
  writeFileSync(path, original);   // the sweep never leaves the tuning changed
}

const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(`\n${key} — ${seeds} løyper per verdi, ${values.length * seeds} løp på ` +
  `${((Date.now() - t0) / 1000).toFixed(1)} s. Margin i sekunder; "i mål" er løp der bruddet holdt unna.\n`);
for (const head of [true, false]) {
  console.log(head ? "== MOTVIND ==" : "\n== MEDVIND ==");
  console.log("  verdi    i mål   median    10%     90%   snitt hjem");
  for (const { v, runs } of rows) {
    const rs = runs.filter((r) => r.head === head);
    const m = rs.map((r) => r.margin).filter((x) => x != null).sort((a, b) => a - b);
    const home = (rs.reduce((a, r) => a + r.home, 0) / Math.max(rs.length, 1)).toFixed(1);
    console.log(String(v).padStart(7) + `${m.length}/${rs.length}`.padStart(9)
      + (m.length ? Math.round(q(m, 0.5)) + "s" : "-").padStart(9)
      + (m.length ? Math.round(q(m, 0.1)) + "s" : "-").padStart(7)
      + (m.length ? Math.round(q(m, 0.9)) + "s" : "-").padStart(8)
      + home.padStart(12));
  }
}
