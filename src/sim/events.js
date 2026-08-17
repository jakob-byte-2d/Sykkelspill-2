import { EVENT_NEAR } from "../content/tuning.js";

/* The news wire. Four lines deep, newest first — the chyron reads the top one, the
   commentator mirrors them into his own feed, and that is all anybody does with them:
   no rider ever reads an event, so nothing written here can move a watt.

   Its own module because both ends of the race write to it. step.js pushes the
   attack, the catch, the flamme rouge; commentary.js pushes the warnings it is the
   only one in a position to see — and a leaf importing back up into step.js would be
   the first cycle in the engine. */

// big marks the events worth reacting to — an attack going, a man riding clear, a
// wheel the player cannot afford — so the UI can slam the replay speed back to 1× and
// put the news over the screen, not just in the chyron's small print.
// ...but only when it is happening NEAR him: pass the actor's road position as `at`,
// and anything further than EVENT_NEAR ahead or behind the player is demoted to an
// ordinary line — an attack fired 200 m up the road is news, not an alarm. Events
// without an `at` (the flamme rouge, the player's own moments) keep their headline.
export function pushEvent(S, txt, big = 0, at = null) {
  if (big && at != null && S.riders && S.riders[0]
    && Math.abs(at - S.riders[0].dist) > EVENT_NEAR) big = 0;
  S.events.unshift({ t: S.t, txt, big });
  if (S.events.length > 4) S.events.pop();
}
