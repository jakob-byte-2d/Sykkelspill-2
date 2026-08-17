/* ============================================================
   STAGES — the shape of the road, written as a course designer would describe it:
   a list of segments, each so many metres at so many per cent. The numbers are ranges
   because every start is a different day on the same roads; the engine samples them.

   Three finale archetypes, drawn 1/3 each by the day's first dice roll — the three
   ways a real race actually ends. The stage returns { kind, segs }: `kind` rides
   through buildCourse onto the course object, where the opponent draw and the UI
   read it. Segments stay ≥ ~600 m (the ±300 m smoothing in buildCourse erases
   anything shorter) and totals stay 20–25 km (the plan/peloton solvers' guards and
   every balance number are calibrated in that band).
   ============================================================ */

const seg = (len, grad) => ({ len, g: grad });

/* A sprinter's finale: the day's one real climb sits in the middle, a long descent
   pays it back, and from five kilometres out the road is a wide flat drag to the
   line. If the break is still clear here, it ends in a gallop. */
export function sprintFinish(rng) {
  const climbLen = 1600 + rng() * 900, climbGrad = 3.0 + rng() * 1.5;
  return {
    kind: "sprint",
    segs: [
      seg(3000 + rng() * 1500, rng() * 0.6 - 0.3),       // rolling out of the valley
      seg(2400 + rng() * 1200, rng() * 0.8 - 0.4),
      seg(900 + rng() * 400, 1.6 + rng() * 1.0),         // the road lifts once
      seg(climbLen, climbGrad),                           // the day's climb, mid-race
      seg(climbLen * 0.9, -(climbGrad + 0.8)),            // and down the far side
      seg(3000 + rng() * 1500, rng() * 0.8 - 0.4),
      seg(5200 + rng() * 1500, rng() * 0.3 - 0.15),      // the long flat run-in
    ],
  };
}

/* The finale of a hilly one-day race: two long false flats, a ramp into the day's
   climb, a fast descent off it, then a short sharp rise inside the last ten
   kilometres for anyone who still has the legs — and a flat run to the line for
   those who do not. (The original southernRoads, now one archetype of three.) */
export function rouleurFinish(rng) {
  const climbLen = 2300 + rng() * 1300, climbGrad = 4.0 + rng() * 2.0;
  return {
    kind: "rouleur",
    segs: [
      seg(2800 + rng() * 1400, rng() * 0.6 - 0.3),       // rolling out of the valley
      seg(2300 + rng() * 1200, rng() * 0.8 - 0.4),
      seg(1100, 1.4 + rng() * 0.8),                       // the road tips up
      seg(climbLen, climbGrad),                           // ...and this is the climb
      seg(climbLen * 0.8, -(climbGrad + 0.6 + rng())),    // down the far side, steeper
      seg(3200 + rng() * 1600, rng() * 0.8 - 0.4),
      seg(850 + rng() * 500, 2.6 + rng() * 1.8),          // the late kick
      seg(800 + rng() * 300, -(2.4 + rng() * 1.4)),
      seg(2500 + rng() * 1200, rng() * 0.4 - 0.2),        // the run to the line
    ],
  };
}

/* A summit finish: rolling approach, one early riser to soften the legs, a valley,
   then the final climb all the way to the line — the last metres are the steepest
   part of the day, and nobody hides there. */
export function climbFinish(rng) {
  const finalLen = 3400 + rng() * 2000, finalGrad = 5.0 + rng() * 2.5;
  return {
    kind: "climb",
    segs: [
      seg(2600 + rng() * 1300, rng() * 0.6 - 0.3),       // rolling out
      seg(2600 + rng() * 1300, rng() * 0.8 - 0.4),
      seg(1500 + rng() * 800, 2.0 + rng() * 1.2),        // an early riser
      seg(1400 + rng() * 600, -(3.0 + rng() * 1.5)),     // and down again
      seg(3800 + rng() * 1600, rng() * 0.8 - 0.4),       // the valley before the wall
      seg(1000, 1.5 + rng() * 1.0),                       // the approach ramp
      seg(finalLen, finalGrad),                           // the final climb, to the LINE
    ],
  };
}

/* The day's draw: one of the three finales, equal thirds, decided by the seed's
   first roll so the archetype is the first fact a race establishes about itself. */
export function anyFinish(rng) {
  const k = rng();
  return k < 1 / 3 ? sprintFinish(rng) : k < 2 / 3 ? rouleurFinish(rng) : climbFinish(rng);
}

export const DEFAULT_STAGE = anyFinish;
