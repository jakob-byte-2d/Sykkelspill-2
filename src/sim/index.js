/* The engine's public face. Everything a caller needs to run a race — a browser
   drawing it at sixty frames a second, or a script running four hundred of them in
   fifteen — and nothing more. No DOM, no React, no canvas anywhere below this line:
   seed in, race out, the same result every time. */
export { newSim } from "./newRace.js";
export { stepSim, finalize } from "./step.js";
export { raceGroups, gapRows } from "./groups.js";
export { bodyNow, usableSurge } from "./body.js";
export { SHEL_MAX } from "./physics.js";
