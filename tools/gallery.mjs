/* The reference gallery: fixed seeds, fixed moments, both viewports — every visual
   change gets judged against a before/after pair instead of an impression.

   Picks one seed per finale archetype (previewRace tells us the kind without running
   a race), then screenshots the game window at fixed points of the race: the start,
   mid-race, the steepest pitch, the flamme rouge and the last 300 m.

     node tools/gallery.mjs [outDir] [url]

   outDir defaults to ./gallery-shots (gitignored); url to http://localhost:5173/.
   Requires the dev server (or a built preview) running, and the sandbox chromium. */
import { mkdirSync } from "node:fs";
import { previewRace } from "../src/sim/index.js";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const OUT = process.argv[2] || "gallery-shots";
const URL = process.argv[3] || "http://localhost:5173/";
mkdirSync(OUT, { recursive: true });

// one seed per archetype, scanned from a fixed base so the gallery never drifts
const seeds = {};
for (let s = 501; Object.keys(seeds).length < 3 && s < 700; s++) {
  const k = previewRace(s).course.kind;
  if (!seeds[k]) seeds[k] = s;
}
console.log("seeds:", JSON.stringify(seeds));

// where to stop the clock, in km to go; "steep" resolves per course below
const MOMENTS = [
  { name: "start", kmToGo: null },
  { name: "mid", frac: 0.5 },
  { name: "steep", steep: true },
  { name: "rouge", km: 1.05 },
  { name: "sprint", km: 0.3 },
];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const V of [{ w: 430, h: 860, n: "phone" }, { w: 900, h: 760, n: "wide" }]) {
  for (const [kind, seed] of Object.entries(seeds)) {
    const pv = previewRace(seed);
    const total = pv.course.total;
    // the steepest 10 m pitch's position, read off the same course the race will ride
    let steepAt = total * 0.5, g0 = -1, prev = pv.course.eleAt(0);
    for (let d = 10; d <= total; d += 10) {
      const e = pv.course.eleAt(d);
      if (e - prev > g0) { g0 = e - prev; steepAt = d; }
      prev = e;
    }
    const stops = MOMENTS.map((m) => ({
      name: m.name,
      at: m.kmToGo === null && !m.frac && !m.km && !m.steep ? 0
        : m.frac ? total * m.frac
        : m.steep ? Math.max(steepAt - 60, 0)
        : m.km ? total - m.km * 1000 : 0,
    })).sort((a, c) => a.at - c.at);

    const pg = await b.newPage({ viewport: { width: V.w, height: V.h } });
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e).slice(0, 150)));
    await pg.goto(URL + "?seed=" + seed);
    await pg.getByText("ROLL OUT").click();
    await pg.waitForTimeout(250);
    await pg.getByText("START RACE").click();
    await pg.waitForTimeout(400);
    await pg.keyboard.press("d");   // the fixture is how we read the odometer
    for (const stop of stops) {
      if (stop.at > 0) {
        // roll at 100x until the player reaches the mark (big events keep slamming
        // the tempo back to 1x, so the button is re-pressed every poll)
        for (let i = 0; i < 600; i++) {
          const st = await pg.evaluate(() => ({ d: window.__S.riders[0].dist, end: window.__S.ended }));
          if (st.end || st.d >= stop.at) break;
          const btn = await pg.$("button:has-text('100×')");
          if (btn) await btn.click().catch(() => {});
          await pg.waitForTimeout(120);
        }
      }
      const one = await pg.$("button:has-text('1×')");
      if (one) await one.click().catch(() => {});
      await pg.keyboard.press("d");  // debug bubbles off for the picture
      await pg.waitForTimeout(350);
      await pg.screenshot({ path: `${OUT}/${kind}-${stop.name}-${V.n}.png` });
      await pg.keyboard.press("d");  // ...and back on for the next odometer read
    }
    if (errs.length) console.log("PAGE ERRORS", kind, V.n, errs.join(" | "));
    await pg.close();
    console.log(kind, V.n, "done");
  }
}
await b.close();
console.log("gallery written to", OUT);
