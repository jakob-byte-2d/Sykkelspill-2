import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* The artifact build: the whole game as ONE self-contained HTML page, ready to be
   published to the test artifact (claude.ai artifacts allow no external requests, so
   the webfont is inlined as data URIs and the Google Fonts @import stripped).

   Run `npm run build` first; then `node tools/bundle.mjs` writes dist/breakaway.html. */

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const OUT = join(DIST, "breakaway.html");

/* ---- fonts: fetch the css, keep only the latin blocks, inline each woff2 ---- */
// the UA matters: without a modern one Google serves ttf, not woff2
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,700;0,800;1,700;1,800&display=swap";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
let faces = "";
try {
  const tmp = mkdtempSync(join(tmpdir(), "bundle-"));
  execSync(`curl -sL -A "${UA}" "${FONT_CSS}" -o "${join(tmp, "bc.css")}"`);
  const css = readFileSync(join(tmp, "bc.css"), "utf8");
  const blocks = css.split("/*").map((b) => "/*" + b);
  let n = 0;
  for (const b of blocks) {
    if (!/^\/\*\s*latin\s*\*\//.test(b)) continue;   // latin only — skip vietnamese/latin-ext
    const url = b.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) continue;
    const file = join(tmp, `f${n}.woff2`);
    execSync(`curl -sL "${url}" -o "${file}"`);
    const b64 = readFileSync(file).toString("base64");
    const style = b.match(/font-style:\s*(\w+)/)?.[1] ?? "normal";
    const weight = b.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
    faces += `@font-face{font-family:'Barlow Condensed';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
    n++;
  }
  console.log("inlined faces:", n);
} catch (e) {
  console.warn("font inlining failed (" + e.message + ") — shipping with system fallback");
}

/* ---- the built app, inlined ---- */
const index = readFileSync(join(DIST, "index.html"), "utf8");
const jsName = index.match(/src="[^"]*?([^/"]+\.js)"/)[1];
const cssName = index.match(/href="[^"]*?([^/"]+\.css)"/)[1];
const appJs = readFileSync(join(DIST, "assets", jsName), "utf8");
const appCss = readFileSync(join(DIST, "assets", cssName), "utf8");

// the font is inlined above, so the app's own webfont @import is dead weight —
// and under the artifact CSP it is a blocked request that logs an error
const safeJs = appJs
  .replace(/@import url\(\\?'https:\/\/fonts\.googleapis\.com[^)]*\);?/g, "")
  // a closing script tag inside any string literal would end the block early
  .replace(/<\/script/gi, "<\\/script");

const page = `<title>The Breakaway — Legends 0.4</title>
<style>
${faces}${appCss}
/* The game paints its own world on canvas; this only gives it a full-bleed ground.
   Deliberately single-theme — the broadcast palette is the design. */
html, body { height: 100%; margin: 0; background: #9fb2c5; }
#root { height: 100%; }
body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

writeFileSync(OUT, page);
console.log("page bytes:", page.length, "->", OUT);
