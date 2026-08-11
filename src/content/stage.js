/* ============================================================
   STAGES — the shape of the road, written as a course designer would describe it:
   a list of segments, each so many metres at so many per cent. The numbers are ranges
   because every start is a different day on the same roads; the engine samples them.
   Adding a second stage is adding a second function here, and nothing else.
   ============================================================ */

/* The finale of a hilly one-day race: two long false flats, a ramp into the day's
   climb, a fast descent off it, then a short sharp rise inside the last ten kilometres
   for anyone who still has the legs — and a flat run to the line for those who do not. */
export function southernRoads(rng) {
  const seg = (len, grad) => ({ len, g: grad });
  const climbLen = 2300 + rng() * 1300, climbGrad = 4.0 + rng() * 2.0;
  return [
    seg(2800 + rng() * 1400, rng() * 0.6 - 0.3),        // rolling out of the valley
    seg(2300 + rng() * 1200, rng() * 0.8 - 0.4),
    seg(1100, 1.4 + rng() * 0.8),                        // the road tips up
    seg(climbLen, climbGrad),                            // ...and this is the climb
    seg(climbLen * 0.8, -(climbGrad + 0.6 + rng())),     // down the far side, steeper
    seg(3200 + rng() * 1600, rng() * 0.8 - 0.4),
    seg(850 + rng() * 500, 2.6 + rng() * 1.8),           // the late kick
    seg(800 + rng() * 300, -(2.4 + rng() * 1.4)),
    seg(2500 + rng() * 1200, rng() * 0.4 - 0.2),         // the run to the line
  ];
}

export const DEFAULT_STAGE = southernRoads;
