/* The engine's public face. Everything a caller needs to run a race — a browser
   drawing it at sixty frames a second, or a script running four hundred of them in
   fifteen — and nothing more. No DOM, no React, no canvas anywhere below this line:
   seed in, race out, the same result every time. */
export { newSim } from "./newRace.js";
export { stepSim, finalize } from "./step.js";
export { pushEvent } from "./events.js";
export { raceGroups, gapRows } from "./groups.js";
export { bodyNow, usableSurge } from "./body.js";
export { clamp } from "./rng.js";

/* The one way in. The engine reads S.input and nothing else the player touches, so a
   script can run a race at "relay" without knowing there are buttons, and the button
   handlers cannot reach past this into the simulation's own state. */
export function setInput(S, patch) {
  Object.assign(S.input, patch);
}
