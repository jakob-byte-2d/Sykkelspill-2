import React, { useEffect, useRef, useState } from "react";
import { DEBUG, draw, roleOf, setDebug } from "../render/draw.js";
import { fmtGap, fmtTime } from "../render/format.js";
import { SPRINT_FINALE_M } from "../content/tuning.js";
import { bodyNow, clamp, finalize, gapRows, newSim, previewRace, pushEvent, setInput, stepSim } from "../sim/index.js";
import { ATTRS, BUILD_PTS, MASSES, MASS_INFO, TEAMS, buildSpec, budgetLeft, ratingsOf } from "../content/builder.js";
import { Portrait } from "./Portrait.jsx";
import { drawProfile } from "../render/profile.js";
import { sliderPts, tFromW, wFromT } from "./slider.js";
import { ResultRow, btn, card, markerTop, overlay, place } from "./widgets.jsx";

/* ============================================================ */
export default function TheBreakaway() {
  const [phase, setPhase] = useState("menu");
  const [, setTick] = useState(0);
  const [speedMode, setSpeedMode] = useState(5);
  const [debugOn, setDebugOn] = useState(DEBUG);
  const [dragging, setDragging] = useState(false);   // finger down on the slider
  const [paused, setPaused] = useState(false);
  const [wrapH, setWrapH] = useState(0);   // the window's real height — the layout guard reads it
  const speedRef = useRef(5);
  const prevSpeedRef = useRef(5);   // what pause interrupted, so resume lands where you were
  const simRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const seedRef = useRef((Math.random() * 1e9) | 0);
  const [build, setBuild] = useState({ spurt: 6, punch: 6, motor: 6, seighet: 6, kg: 70 });
  const [pname, setPname] = useState("");           // the name on the frame — empty rides as YOU
  const [teamI, setTeamI] = useState(0);            // index into the day's AVAILABLE kits
  const [attrInfo, setAttrInfo] = useState(null);   // which builder row is explaining itself
  const previewRef = useRef(null);   // the day the builder is choosing for: course + the drawn four
  const specRef = useRef(null);      // the body the player confirmed — SAME RACE reuses it
  const buildCvs = useRef(null);
  const dragRef = useRef(false);
  const alertRef = useRef(null);   // the last big event already reacted to
  const marksRef = useRef([]);     // last frame's rider screen spots, from draw()
  const [riderCard, setRiderCard] = useState(null);  // the man whose card is open
  const cardResume = useRef(0);    // the speed the card interrupted; 0 = was paused

  // the builder's door: draw the day (course + opponents) for this seed and show it.
  // previewRace replays newSim's own opening calls on the same stream, so what the
  // screen shows is exactly what the gun will fire.
  const toBuild = (seed) => {
    seedRef.current = seed;
    previewRef.current = previewRace(seed);
    setPhase("build");
  };

  const start = (seed) => {
    seedRef.current = seed;
    simRef.current = newSim(seed, specRef.current || undefined);
    // there is a human on the controls now, so his turn on the front is his to end:
    // the END TURN button, not the ledger. A headless run never comes through here
    // and keeps the rotation's automatic rules, which is what golden measures.
    setInput(simRef.current, { turn: "manual" });
    // the fixture the telemetry reads from — the whole sim, and only when asked for
    if (DEBUG && typeof window !== "undefined") window.__S = simRef.current;
    speedRef.current = 5; setSpeedMode(5); setPaused(false);
    setPhase("race");
  };

  // the button owns the flag; the D key is the same switch, kept so a keyboard and
  // an automated run can reach it without hunting for the chyron
  const toggleDebug = () => {
    const on = !DEBUG;
    setDebug(on, simRef.current);
    setDebugOn(on);
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "d" || e.key === "D") toggleDebug(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const fit = () => {
      const c = canvasRef.current, el = wrapRef.current;
      if (!c || !el) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = el.clientWidth * dpr;
      c.height = el.clientHeight * dpr;
      c.style.width = el.clientWidth + "px";
      c.style.height = el.clientHeight + "px";
      setWrapH(el.clientHeight);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [phase]);

  useEffect(() => {
    if (phase !== "build" || !buildCvs.current || !previewRef.current) return;
    const c = buildCvs.current;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0e1c30"; ctx.fillRect(0, 0, w, h);
    drawProfile({ course: previewRef.current.course, profile: null, groups: [], riders: [], pel: { dist: -1 } }, ctx, w, h, 0);
  }, [phase]);

  useEffect(() => {
    if (phase !== "race") return;
    let raf, last = performance.now(), acc = 0;
    const loop = (now) => {
      const S = simRef.current;
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      if (S && !S.ended) {
        const ff = speedRef.current;
        acc += dt * ff;
        let guard = 0;
        while (acc >= 1 && guard < 220) { stepSim(S); acc -= 1; guard++; }
        const p = S.riders[0];
        if (p.caught && !S.ended) { S.ended = true; S.result = { caught: true, atKm: (S.course.total - p.dist) / 1000 }; }
        if (p.finished != null && !S.ended) finalize(S);
      }
      if (S && canvasRef.current) marksRef.current = draw(S, canvasRef.current, clamp(acc, 0, 1)) || [];
      if (S && now - S.uiAt > 140) { S.uiAt = now; setTick((t) => t + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const S = simRef.current;
  const player = S ? S.riders[0] : null;
  const body = player ? bodyNow(player) : null;
  const pts = player ? sliderPts(player.T0 * player.form, player.curve.p5s) : null;

  // a tap on the road: the nearest rider drawn last frame, with thumb-sized slack —
  // the sprite is ~11 px wide, so the target is the man, not the pixels. Opening the
  // card pauses the race (reading mid-finale must not cost); closing hands back the
  // interrupted speed, and leaves a deliberate pause alone.
  const onCanvasTap = (e) => {
    if (phase !== "race" || !S || S.ended) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let hit = null, best = 27;
    for (const m of marksRef.current) {
      const dx = Math.abs(m.x - px);
      if (dx < best && Math.abs(m.y - 8 - py) < 48) { best = dx; hit = m.r; }
    }
    if (!hit) return;
    cardResume.current = paused ? 0 : speedRef.current || 1;
    speedRef.current = 0; setPaused(true);
    setRiderCard(hit);
  };
  const closeCard = () => {
    setRiderCard(null);
    if (phase === "race" && cardResume.current > 0 && S && !S.ended) {
      speedRef.current = cardResume.current; setPaused(false);
    }
    cardResume.current = 0;
  };

  const onSlider = (e, elem) => {
    if (!S || S.ended) return;
    const rect = elem.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const t = 1 - clamp((y - 14) / (rect.height - 28), 0, 1);
    const asked = Math.round(wFromT(t, pts));
    // the slider moves the INSTRUCTION and nothing else: the mode keeps riding —
    // handing the legs over to the setpoint is the MANUAL button's job
    setInput(S, { watts: asked });
  };
  const onSliderUp = () => {
    dragRef.current = false;
    setDragging(false);
  };

  /* ---------- UI pieces ---------- */
  const font = "'Barlow Condensed','Arial Narrow',system-ui,sans-serif";
  const mono = "ui-monospace,'SF Mono',Menlo,monospace";

  // the two action buttons share everything but colour and height — one factory, like btn()
  const actionBtn = (bottom, extra) => ({
    position: "absolute", right: 6, bottom, width: 74, padding: "8px 0",
    fontFamily: font, fontWeight: 800, fontStyle: "italic", letterSpacing: 0.8, fontSize: 11, lineHeight: 1.15,
    borderRadius: 999, textShadow: "0 1px 1px rgba(0,0,0,0.35)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(20,40,70,0.35)",
    ...extra,
  });

  const Bar = ({ label, frac, color }) => (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 1.5, color: "#0d3568", fontWeight: 800, fontStyle: "italic", fontFamily: font }}>
        <span>{label}</span><span style={{ fontFamily: mono }}>{Math.round(frac * 100)}%</span>
      </div>
      <div style={{ height: 8, background: "#31455c", border: "1px solid #223349", borderRadius: 4, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.45)" }}>
        <div style={{ height: "100%", width: `${clamp(frac, 0, 1) * 100}%`, background: `linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0) 45%), ${color}`, borderRadius: 3, transition: "width .25s linear" }} />
      </div>
    </div>
  );

  let raceUI = null;
  if (phase === "race" && S && player && body) {
    const kmToGo = Math.max(0, (S.course.total - player.dist) / 1000);
    // the flamme rouge takes the autopilot away: inside the last kilometre nobody
    // rides for anybody, so RELAY and SIT ON stop existing and the watts land in
    // MANUAL carrying whatever the autopilot was actually doing — a seamless handover,
    // announced once in the chyron. A rule about the player's CONTROLS, deliberately
    // not about the sim: headless runs keep the full autopilot (including its sprint),
    // so the golden fixture and every measurement are untouched.
    const finale = player.finished == null && !player.caught
      && S.course.total - player.dist < SPRINT_FINALE_M;
    if (finale && !S.finaleLock) {
      S.finaleLock = true;
      if (S.input.mode !== "manual") setInput(S, { mode: "manual", watts: S.playerW });
      pushEvent(S, "Flamme rouge — the finale is yours", 1);
    }
    // the director's cut: news worth reacting to — an attack going, a man riding
    // clear, the flamme rouge — slams the replay back to real time and puts itself
    // over the screen. Handled once per event (the ref remembers the object), so
    // the player can wind the speed back up without the same headline re-braking him.
    const ev = S.events[0];
    if (ev && ev.big && alertRef.current !== ev) {
      alertRef.current = ev;
      if (speedRef.current > 1) { speedRef.current = 1; setSpeedMode(1); }
    }
    const alert = ev && ev.big && S.t - ev.t < 5 && !S.ended ? ev : null;
    // Two readings on one track. The INDICATOR is what the legs are actually doing
    // right now — the autopilot's pulls, the wheel price, the sprint — the solid
    // bubble, moving entirely on its own. The INSTRUCTION is the player's setpoint:
    // it sits exactly where the thumb put it, whatever mode is riding, a glass ring
    // floating over everything, always wearing the same face — an order does not
    // change with the weather. The BODY is what alarms: legs pinned at the ceiling
    // (or sprinting), the indicator turns red and shivers.
    const setW = S.input.watts;
    const liveW = S.playerW;
    // the alarm reads the LEGS, not the ask: a sky-high setpoint parked in RELAY
    // while you sit in a wheel at 200 W is a plan, not an emergency
    const liveMax = S.input.sprint || liveW >= Math.floor(body.ceil);
    // ...but the drag readout still answers the thumb: asking over the ceiling is
    // worth knowing the moment you ask it, before the legs ever get the order
    const askMax = S.input.sprint || setW >= Math.floor(body.ceil);
    const tT = tFromW(body.T, pts), tC = tFromW(body.ceil, pts);
    const tSet = tFromW(setW, pts), tLive = tFromW(liveW, pts);
    // ...and the indicator wears the colour of what you are doing, the same one the
    // buttons carry: the sprint's red beats the override's gold beats the mode's own.
    const doing = S.input.sprint ? "sprint" : player.sulT > 0 ? "htfu"
      : S.input.mode === "sit" ? "sit" : S.input.mode === "relay" ? "relay" : "manual";
    const DOING = {
      sprint: { bg: "linear-gradient(180deg, #ffd9d2, #ff7a63 45%, #c0392b)", edge: "#7c1810", ink: "#fff" },
      htfu:   { bg: "linear-gradient(180deg, #fff3c4, #ffd23f 45%, #d99a1b)", edge: "#7a5410", ink: "#3d2800" },
      sit:    { bg: "linear-gradient(180deg, #d8f7dd, #5fc978 45%, #1d7a34)", edge: "#145c27", ink: "#fff" },
      relay:  { bg: "linear-gradient(180deg, #eaf3fb, #7db3e0 45%, #2f6cb3)", edge: "#123a6b", ink: "#fff" },
      manual: { bg: "linear-gradient(180deg, #e8eef4, #93a9bf 45%, #55708c)", edge: "#35516e", ink: "#fff" },
    }[doing];
    // the scale: a mark every hundred watts, thinned out where the track compresses so
    // the numbers never sit on top of each other. Built from the same pts the thumb
    // rides, so a mark reading 300 is where 300 watts actually is.
    const ticks = [];
    let lastT = -1, lastLabelT = -1;
    for (let w = 100; w <= pts[pts.length - 1][1]; w += 100) {
      const t = tFromW(w, pts);
      if (t - lastT < 0.035) continue;   // a mark this close to the last one is a smudge
      const label = t - lastLabelT >= 0.05;
      if (label) lastLabelT = t;
      lastT = t;
      ticks.push({ w, t, label });
    }
    // the bottom guard: the button stack is a fixed 288 px column, and on a window
    // too short to hold the chyron, a usable slider track AND the buttons, something
    // has to give. The whole stack scales down from its bottom-right corner and the
    // slider keeps every pixel the stack gives up. 558 px is the last height where
    // everything fits at full size — any normal screen sits well above it, so there
    // k is exactly 1 and nothing moves. (Both numbers grew by one button-pitch when
    // END TURN joined the column.)
    const k = wrapH > 0 ? clamp(wrapH / 558, 0.7, 1) : 1;
    const stackB = Math.round(288 * k);   // where the button column now ends, the slider's new foot
    // ...and the guard's measurements answer one more question: are the two bubbles
    // on the slider actually clear of each other, in pixels on THIS track? Closer
    // than a bubble-height, the ring's number would print on top of the indicator's.
    const apart = Math.abs(tSet - tLive) * Math.max(wrapH - 84 - stackB - 28, 1) > 26;
    // ...and whether the END TURN button has anything to end: you are in the rotation,
    // on the front, still pulling (not already swinging off), and not in the finale
    // where nobody owes anybody a turn any more.
    const canEndTurn = S.input.mode === "relay" && !finale
      && player.groupPos === 1 && !player.offline && (player.groupSize ?? 1) > 1;

    raceUI = (
      <>
        {/* chyron */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <div style={{ background: "linear-gradient(180deg, #8dbce6 0%, #3a76bd 42%, #1c4f92 100%)", borderBottom: "2px solid #0d3568", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), 0 3px 8px rgba(15,35,60,0.4)", padding: "7px 10px 6px", fontFamily: font, fontStyle: "italic" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, color: "#f2f5f7" }}>
            <span style={{ color: "#e8443a", fontWeight: 800, fontSize: 11, letterSpacing: 2 }}>● LIVE</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: "#d7e6f5", fontStyle: "normal" }}>{fmtTime(S.clock0 + S.t)}</span>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1, textShadow: "0 1px 2px rgba(10,30,55,0.7)" }}>{kmToGo.toFixed(1)} KM</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button onClick={toggleDebug}
                title="Telemetri i boblene over hodene (eller trykk D)"
                style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #0d3568", cursor: "pointer", fontStyle: "normal",
                  boxShadow: debugOn ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.55)",
                  background: debugOn ? "linear-gradient(180deg, #ffffff, #cfe2f6 60%, #a9cdf0)" : "linear-gradient(180deg, #9cc0e6, #3a76bd 55%, #2a5f9e)",
                  color: debugOn ? "#0d3568" : "#eaf3fb" }}>
                DBG
              </button>
              <button onClick={() => toBuild((Math.random() * 1e9) | 0)}
                title="Start et nytt løp"
                style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #5c1010", cursor: "pointer", fontStyle: "normal",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                  background: "linear-gradient(180deg, #f0a29a, #c0392b 55%, #96281c)",
                  color: "#fff" }}>
                ↻
              </button>
            </span>
          </div>
          {S.events[0] && S.t - S.events[0].t < 7 && (
            <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#ffe57a", textShadow: "0 1px 2px rgba(10,30,55,0.7)" }}>{S.events[0].txt.toUpperCase()}</div>
          )}
        </div>

        {/* time gaps — sits under the chyron, never behind it */}
        <div style={{ margin: "6px 0 0 10px", width: 168, background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)", border: "2px solid #6f8cab", borderRadius: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 8px rgba(15,35,60,0.3)", padding: "4px 0" }}>
          {gapRows(S).map((r) => (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "1px 7px", background: r.me ? "rgba(255,210,63,0.55)" : "transparent", fontFamily: mono, fontSize: 9.5, fontWeight: 700 }}>
              <span style={{ color: "#0d3568", overflow: "hidden", whiteSpace: "nowrap" }}>{r.label}</span>
              <span style={{ color: Math.abs(r.gapS) < 1 ? "#123a6b" : r.gapS < 0 ? "#1d7a34" : "#c22a1e" }}>{Math.abs(r.gapS) < 1 ? "—" : fmtGap(r.gapS)}</span>
            </div>
          ))}
        </div>

        {/* the commentary box — the voice that took over from the bubbles: form,
            intentions and the race's mood, told as a race. Newest line lit, the
            older ones fading; a line lives about half a minute and the box folds
            away when the commentator has nothing. */}
        {S.comm && S.comm.some((c) => S.t - c.t < 28) && (
          <div style={{ margin: "6px 0 0 10px", width: 196, pointerEvents: "none", background: "linear-gradient(180deg, rgba(16,30,48,0.88), rgba(10,20,34,0.88))", border: "1.5px solid rgba(111,140,171,0.7)", borderRadius: 8, boxShadow: "0 3px 8px rgba(15,35,60,0.35)", padding: "4px 8px 5px", fontFamily: font, fontStyle: "italic" }}>
            {S.comm.filter((c) => S.t - c.t < 28).slice(0, 3).map((c, k) => (
              <div key={c.t + c.txt} style={{ fontSize: k === 0 ? 12.5 : 10.5, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.3, marginTop: k === 0 ? 0 : 3, color: k === 0 ? "#ffe57a" : "rgba(205,220,238,0.72)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                {k === 0 ? "🎙 " : ""}{c.txt}
              </div>
            ))}
          </div>
        )}
        </div>

        {/* the headline: big news over the screen — the race just changed, and the
            speed has already been slammed to 1× so there is time to answer it */}
        {alert && (
          <div style={{ position: "absolute", top: "30%", left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
            <div style={{
              animation: "headline .28s cubic-bezier(.2,1.6,.4,1)",
              background: "linear-gradient(180deg, #f0a29a, #c0392b 40%, #7c1810)",
              border: "2px solid #5c1010", borderRadius: 10, padding: "10px 22px 9px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 6px 22px rgba(15,35,60,0.55)",
              textAlign: "center", maxWidth: "86%",
            }}>
              <div style={{ fontFamily: font, fontWeight: 800, fontStyle: "italic", fontSize: 24, lineHeight: 1.1, letterSpacing: 1.5, color: "#fff", textShadow: "0 2px 3px rgba(60,10,5,0.8)" }}>
                {alert.txt.toUpperCase()}
              </div>
            </div>
          </div>
        )}

        {/* the right column under the slider, top to bottom: the doing-chip, the
            relay/sit toggle, the motivation one-shot, and the sprint hold. One thumb,
            one column — grabbing the slider itself is what MANUAL is. The whole
            column lives in one box so the bottom guard can shrink it as one thing. */}
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 136, height: 250, transform: k < 1 ? `scale(${k})` : "none", transformOrigin: "100% 100%" }}>
        {/* manual: the third intention — the legs answer to the setpoint bubble and
            nothing else. Relay and sit on keep their whole autopilot; this button is
            how the standing order on the slider becomes the ride. */}
        <button
          onClick={() => { if (S && !S.ended) setInput(S, { mode: "manual" }); }}
          style={actionBtn(208, {
            cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", touchAction: "manipulation",
            border: "2px solid #35516e",
            color: "#fff",
            background: S.input.mode === "manual"
              ? "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.25) 45%, rgba(0,0,0,0.10)), #55708c"
              : "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(0,0,0,0.28)), #3d5570",
            boxShadow: S.input.mode === "manual"
              ? "inset 0 1px 0 rgba(255,255,255,0.8), 0 0 8px rgba(147,169,191,0.9)"
              : "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(20,40,70,0.35)",
          })}>
          MANUAL
        </button>

        {/* END TURN: in a break it is the man on the front who decides when he has
            had enough, not a ledger — so in RELAY the turn lasts until this is
            pressed. Live only while you are actually pulling; dark otherwise, the
            same way RELAY and SIT ON go dark past the flamme rouge. */}
        <button
          onClick={() => { if (S && !S.ended && canEndTurn) setInput(S, { endTurn: true }); }}
          style={actionBtn(246, {
            cursor: canEndTurn ? "pointer" : "default", userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", touchAction: "manipulation",
            opacity: canEndTurn ? 1 : 0.35,
            border: "2px solid #6b4a12",
            color: "#fff",
            background: canEndTurn
              ? "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #a8791f"
              : "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(0,0,0,0.28)), #6f5218",
          })}>
          END TURN
        </button>

        {/* relay and sit on: two buttons, one per intention — the lit one is the mode
            you are in, and past the flamme rouge both go dark: nobody rides for
            anybody in the last kilometre. */}
        <button
          onClick={() => { if (S && !S.ended && !finale) setInput(S, { mode: "relay" }); }}
          style={actionBtn(170, {
            cursor: finale ? "default" : "pointer", userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", touchAction: "manipulation",
            opacity: finale ? 0.35 : 1,
            border: "2px solid #123a6b",
            color: "#fff",
            background: S.input.mode === "relay"
              ? "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.25) 45%, rgba(0,0,0,0.10)), #3a76bd"
              : "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(0,0,0,0.28)), #2a507c",
            boxShadow: S.input.mode === "relay"
              ? "inset 0 1px 0 rgba(255,255,255,0.8), 0 0 8px rgba(125,179,224,0.8)"
              : "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(20,40,70,0.35)",
          })}>
          RELAY
        </button>
        <button
          onClick={() => { if (S && !S.ended && !finale) setInput(S, { mode: "sit" }); }}
          style={actionBtn(132, {
            cursor: finale ? "default" : "pointer", userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", touchAction: "manipulation",
            opacity: finale ? 0.35 : 1,
            border: "2px solid #145c27",
            color: "#fff",
            background: S.input.mode === "sit"
              ? "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.25) 45%, rgba(0,0,0,0.10)), #2f9e4f"
              : "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(0,0,0,0.28)), #24693a",
            boxShadow: S.input.mode === "sit"
              ? "inset 0 1px 0 rgba(255,255,255,0.8), 0 0 8px rgba(95,201,120,0.8)"
              : "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(20,40,70,0.35)",
          })}>
          SIT ON
        </button>

        {/* the tempo column, beside the action buttons: a clear pause on top, then
            the four replay speeds. Pause remembers what it interrupted; any speed
            press is also the way out of it. */}
        <button
          onClick={() => {
            if (paused) { speedRef.current = prevSpeedRef.current || 1; setPaused(false); }
            else { prevSpeedRef.current = speedRef.current || 1; speedRef.current = 0; setPaused(true); }
          }}
          style={{ position: "absolute", right: 86, bottom: 184, width: 44, padding: "7px 0",
            fontFamily: mono, fontSize: 15, fontWeight: 800, lineHeight: 1, textAlign: "center",
            borderRadius: 12, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
            border: paused ? "2px solid #7a5410" : "2px solid #5c1010",
            color: paused ? "#3d2800" : "#fff",
            background: paused
              ? "linear-gradient(180deg, #fff3c4, #ffd23f 45%, #d99a1b)"
              : "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.1) 45%, rgba(0,0,0,0.2)), #b03227",
            boxShadow: paused
              ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 10px rgba(255,210,63,0.8)"
              : "inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 4px rgba(20,40,70,0.35)",
          }}>
          {paused ? "►" : "❚❚"}
        </button>
        {[1, 5, 10, 100].map((m, i) => (
          <button key={m}
            onClick={() => { speedRef.current = m; setSpeedMode(m); setPaused(false); }}
            style={{ position: "absolute", right: 86, bottom: 152 - i * 32, width: 44, padding: "6px 0",
              fontFamily: mono, fontSize: 11, fontWeight: 700, lineHeight: 1, textAlign: "center",
              borderRadius: 999, border: "1px solid #0d3568", cursor: "pointer",
              userSelect: "none", WebkitUserSelect: "none",
              boxShadow: !paused && speedMode === m ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.55)",
              background: !paused && speedMode === m ? "linear-gradient(180deg, #ffffff, #cfe2f6 60%, #a9cdf0)" : "linear-gradient(180deg, #9cc0e6, #3a76bd 55%, #2a5f9e)",
              color: !paused && speedMode === m ? "#0d3568" : "#eaf3fb" }}>
            {m}×
          </button>
        ))}

        {/* the governor's override, Rule #5 spelling */}
        <button
          onClick={() => { if (S && !S.ended) setInput(S, { sul: true }); }}
          style={actionBtn(94, {
            cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", touchAction: "manipulation",
            color: player.sulT > 0 ? "#3d2800" : "#fff",
            textShadow: player.sulT > 0 ? "none" : "0 1px 1px rgba(0,0,0,0.35)",
            border: "2px solid #7a5410",
            opacity: player.sulLeft > 0 || player.sulT > 0 ? 1 : 0.45,
            background: player.sulT > 0
              ? "linear-gradient(180deg, #fff3c4, #ffd23f 45%, #d99a1b)"
              : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #b8791a",
          })}>
          HTFU! {player.sulT > 0 ? Math.ceil(player.sulT) + "s"
            : "\u25cf".repeat(player.sulLeft) + "\u25cb".repeat(Math.max(2 - player.sulLeft, 0))}
        </button>

        {/* the sprint: a hold — the commitment lasts exactly as long as the finger
            dares. The pointer is captured so a thumb sliding a millimetre off the pill
            does not drop the sprint, and releasing lands you in MANUAL at threshold:
            after a sprint you are on your own for the dosing, and threshold is the one
            level the body can actually hold from there. */}
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            if (S && !S.ended) setInput(S, { sprint: true });
          }}
          onPointerUp={() => S && S.input.sprint && setInput(S, { sprint: false, mode: "manual", watts: Math.round(body.T) })}
          onPointerCancel={() => S && S.input.sprint && setInput(S, { sprint: false, mode: "manual", watts: Math.round(body.T) })}
          onContextMenu={(e) => e.preventDefault()}
          style={actionBtn(56, {
            cursor: "pointer", touchAction: "none", userSelect: "none",
            WebkitUserSelect: "none", WebkitTouchCallout: "none",
            letterSpacing: 1.2, color: "#fff",
            border: S.input.sprint ? "2px solid #ffb3a6" : "2px solid #7c1810",
            transform: S.input.sprint ? "scale(0.94)" : "none",
            background: S.input.sprint
              ? "linear-gradient(180deg, #a01608, #7c0e04 60%, #5c0a02)"
              : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #d8432f",
            boxShadow: S.input.sprint
              ? "0 0 14px rgba(255,46,26,0.9), inset 0 2px 6px rgba(0,0,0,0.55)"
              : "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(20,40,70,0.35)",
          })}>
          SPRINT
        </button>
        </div>

        {/* instrument panel */}
        <div style={{ position: "absolute", left: 10, bottom: 56, width: 168, background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)", border: "2px solid #6f8cab", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(60,90,125,0.35), 0 3px 10px rgba(15,35,60,0.35)", borderRadius: 12, padding: "10px 12px 8px" }}>
          <Bar label="SURGE" frac={body.sf} color="#35c24d" />
          <Bar label="FUEL" frac={body.ff} color="#2e8fe0" />
          {/* the jump: the ten seconds above everything else, spent only all-out.
              It took DURA's slot — wear moves 0.42 to 0.62 over a whole race and
              told you little, while this drains in a sprint and refills in minutes:
              a gauge there is actually a fight over. Wear stays in the debug bubble. */}
          <Bar label="JUMP" frac={player.jump / player.jumpMax} color="#e0483c" />
          {/* the complement of the shelter: the share of the work he is taking in the
              wind himself. Same number, read the way a rider says it — and it uses the
              whole scale, where the saving alone sat in the bottom third all race */}
          <Bar label="WIND" frac={1 - player.ly} color="#8e6bd6" />
          {/* watts, speed and what he is doing moved down to the rider himself —
              the panel keeps only what the body offers, not what it is spending */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: mono, fontSize: 11 }}>
            <span style={{ color: "#1d7a34", fontWeight: 700 }}>THR {Math.round(body.T)}</span>
            <span style={{ color: "#c22a1e", fontWeight: 700 }}>MAX {Math.round(body.ceil)}</span>
          </div>
        </div>

        {/* watt slider — its foot carries the WATTS label, so the column stops where
            the button stack begins: at the stack's scaled top, not a hardcoded 250 */}
        <div
          style={{ position: "absolute", right: 6, top: 84, bottom: stackB, width: 104, touchAction: "none", userSelect: "none" }}
          onPointerDown={(e) => { dragRef.current = true; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); onSlider(e, e.currentTarget); }}
          onPointerMove={(e) => { if (dragRef.current) onSlider(e, e.currentTarget); }}
          onPointerUp={onSliderUp}
          onPointerCancel={onSliderUp}
        >
          <div style={{ position: "absolute", left: 56, top: 14, bottom: 14, width: 22, borderRadius: 11, background: "linear-gradient(180deg, rgba(224,72,60,0.55), #7e93a8 30%, #55708c)", border: "2px solid #35516e", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.35)" }} />
          {/* the scale, under everything else: a tick into the track, a number beside it */}
          {ticks.map((k) => (
            <div key={k.w}>
              <div style={{ position: "absolute", left: 50, width: k.label ? 10 : 6, height: 1, background: "rgba(13,53,104,0.55)", top: markerTop(k.t) }} />
              {k.label && (
                <div style={{ position: "absolute", left: 0, width: 44, textAlign: "right", top: `calc(${markerTop(k.t)} - 6px)`, fontFamily: mono, fontSize: 9, fontWeight: 700, color: "#0d3568", textShadow: "0 1px 0 rgba(255,255,255,0.75)" }}>
                  {k.w}
                </div>
              )}
            </div>
          ))}
          {/* green threshold line */}
          <div style={{ position: "absolute", left: 50, width: 40, height: 2, background: "#2fdc55", top: markerTop(tT), boxShadow: "0 0 5px #2fdc55" }} />
          {/* red ceiling line — sinks when you burn your matches */}
          <div style={{ position: "absolute", left: 50, width: 40, height: 2, background: "#ff4b3a", top: markerTop(tC), boxShadow: "0 0 5px #ff4b3a", transition: "top .3s linear" }} />
          {/* the INDICATOR: what the legs are actually doing, moving on its own — the
              solid bubble, in the colour of the act the buttons carry: the sprint's
              red, the override's gold, the mode's blue, green or grey. And this is
              where the body's alarm lives: legs pinned at the ceiling (or sprinting),
              it turns alarm-red and shivers — the ENGINE is redlining, whatever the
              order says. Un-pressable: it is a reading, however good it looks. */}
          <div style={{
            position: "absolute", left: 42, width: 50, height: 30, top: `calc(${markerTop(tLive)} - 15px)`,
            borderRadius: 999, pointerEvents: "none",
            background: liveMax ? "linear-gradient(180deg, #ffb3a6, #ff5a42 45%, #b31d0e)" : DOING.bg,
            border: liveMax ? "2px solid #7c1810" : "2px solid " + DOING.edge,
            boxShadow: liveMax
              ? "0 0 12px rgba(255,46,26,0.85), inset 0 1px 0 rgba(255,255,255,0.6)"
              : "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(15,35,60,0.5)",
            animation: liveMax ? "dirre .12s linear infinite" : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontWeight: 800, fontSize: 13,
            color: liveMax ? "#fff" : DOING.ink,
            textShadow: liveMax || DOING.ink === "#fff" ? "0 1px 2px rgba(10,30,55,0.7)" : "none",
            transition: "top .15s linear",
          }}>
            {liveW}
          </div>
          {/* the INSTRUCTION: the player's setpoint, exactly where the thumb put it —
              a glass ring OVER the indicator, so the standing order never hides what
              the legs are doing. One face, always: an order does not change with the
              weather — the drama belongs to the indicator. What the ring MEANS still
              depends on the mode: MANUAL rides it, in RELAY it is the price of YOUR
              pulls (and parked above S.ownBar with the legs delivering, the front
              stays yours), SIT ON ignores it. Its number yields when the two bubbles
              share the same stretch of track — when they agree, one reading is
              enough. */}
          <div style={{
            position: "absolute", left: 39, width: 56, height: 36, top: `calc(${markerTop(tSet)} - 18px)`,
            borderRadius: 999, pointerEvents: "none",
            background: "rgba(255,255,255,0.16)",
            border: "2px solid rgba(255,255,255,0.85)",
            boxShadow: "0 0 0 1px rgba(13,27,42,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontWeight: 800, fontSize: 12,
            color: "#f2f6fa",
            textShadow: "0 1px 2px rgba(10,30,55,0.8)",
          }}>
            {apart ? setW : ""}
          </div>
          {/* ...and a finger covers what it points at, so while you are holding the grip the
              value stands well clear of it: two thumb-heights up, out from under the hand
              entirely. Near the top of the track there is no room for that, so it flips to
              the same distance below instead. */}
          {dragging && (
            <div style={{
              position: "absolute", left: 34, width: 66, height: 30, borderRadius: 999,
              top: `calc(${markerTop(tSet)} ${tSet > 0.80 ? "+ 57px" : "- 79px"})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(180deg, #ffffff, #dcebfa)",
              border: "2px solid " + (askMax ? "#b31d0e" : DOING.edge),
              boxShadow: askMax ? "0 0 12px rgba(255,46,26,0.7)" : "0 3px 10px rgba(15,35,60,0.45)",
              fontFamily: mono, fontWeight: 800,
              fontSize: 16, color: askMax ? "#b31d0e" : "#0d3568", pointerEvents: "none",
            }}>
              {setW} W
            </div>
          )}
          <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, textAlign: "center", fontSize: 9, letterSpacing: 2, color: "#0d3568", fontWeight: 800, fontStyle: "italic", fontFamily: font }}>WATTS</div>
        </div>

        {/* result card: the headline, then the broadcast graphic — every man's day in
            numbers. Finish order decides the rows (the road's own sorting: finishers by
            the clock, everyone else by where the race left him); the stats are the
            sim's st ledger read straight, nothing computed twice. */}
        {S.ended && S.result && (
          <div style={overlay}>
            <div style={{ ...card, maxWidth: 400 }}>
              <div style={{ fontFamily: font, fontSize: 12, letterSpacing: 3, color: "#3c5a7a", fontWeight: 800, fontStyle: "italic" }}>RESULT</div>
              <div style={{ fontFamily: font, fontWeight: 800, fontSize: 30, letterSpacing: 1, color: S.result.caught ? "#c22a1e" : "#0d3568", fontStyle: "italic", margin: "2px 0 8px" }}>
                {S.result.caught ? `CAUGHT · ${S.result.atKm.toFixed(1)} KM TO GO` : place(S.result.place)}
              </div>
              {(() => {
                const order = [...S.riders].sort((a, b) =>
                  (a.finished != null ? a.finished : 1e12) - (b.finished != null ? b.finished : 1e12)
                  || b.dist - a.dist);
                const winT = order[0].finished;
                // eight stat columns need the card's whole width, so the name rides its
                // own line above them — a broadcast lower-third, not a spreadsheet
                const cols = "repeat(7, 1fr)";
                const num = { fontFamily: mono, fontSize: 9, fontWeight: 700, color: "#0d3568", textAlign: "right" };
                return (
                  <div style={{ margin: "0 0 8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 2, padding: "0 4px 2px", borderBottom: "1.5px solid rgba(60,90,125,0.45)" }}>
                      {["AVG WATTS", "AVG W/KG", "MAX WATTS", "TIME ON WHEEL", "TIME ON FRONT", "OVER THRESHOLD", "AVG KM/H"].map((h) => (
                        <span key={h} style={{ fontFamily: font, fontSize: 7, letterSpacing: 0.4, fontWeight: 800, color: "#3c5a7a", textAlign: "right", lineHeight: 1.15, alignSelf: "end" }}>{h}</span>
                      ))}
                    </div>
                    {order.map((r, k) => {
                      const avg = r.st.work / Math.max(r.st.t, 1);
                      // the winner's row needs no label — "1." says it; everyone else
                      // carries his gap, the caught their fate, the still-riding a dash
                      const gap = r.caught ? "CAUGHT" : r.finished == null ? "—"
                        : winT != null && r.finished > winT ? "+" + fmtTime(r.finished - winT) : "";
                      return (
                        <div key={r.i} style={{ padding: "3px 4px 2px", borderBottom: "1px solid rgba(60,90,125,0.22)", background: r.isPlayer ? "rgba(255,210,63,0.5)" : "transparent" }}>
                          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                            <span style={{ fontFamily: font, fontSize: 11, fontWeight: 800, fontStyle: "italic", color: "#0d3568" }}>{k + 1}. {r.name}</span>
                            <span style={{ fontFamily: font, fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: "#3c5a7a" }}>{"  " + r.team}</span>
                            <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: r.caught ? "#c22a1e" : "#547294" }}>{"  " + gap}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 2 }}>
                            <span style={num}>{Math.round(avg)}</span>
                            <span style={num}>{(avg / r.mass).toFixed(1)}</span>
                            <span style={num}>{Math.round(r.st.max)}</span>
                            <span style={num}>{fmtTime(r.st.drft)}</span>
                            <span style={num}>{fmtTime(r.st.front)}</span>
                            <span style={num}>{fmtTime(r.st.above)}</span>
                            <span style={num}>{(Math.min(r.dist, S.course.total) / Math.max(r.st.t, 1) * 3.6).toFixed(1)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* the road itself, under the men who rode it — walked once off eleAt/
                  windAt at render time, no state anywhere. Wind speaks the pill's
                  language (HEAD/TAIL/CROSS reads the sign the same way draw.js does). */}
              {(() => {
                const C = S.course;
                let climb = 0, hi = -1e9, steep = 0, prev = C.eleAt(0);
                for (let d = 10; d <= C.total; d += 10) {
                  const e = C.eleAt(d);
                  if (e > prev) climb += e - prev;
                  if (e > hi) hi = e;
                  const g = (e - prev) / 10;
                  if (g > steep) steep = g;
                  prev = e;
                }
                const hw = C.windAt(0);
                const wdir = hw > 0.4 ? "HEADWIND" : hw < -0.4 ? "TAILWIND" : "CROSSWIND";
                const lead = [...S.riders].sort((a, b) =>
                  (a.finished != null ? a.finished : 1e12) - (b.finished != null ? b.finished : 1e12)
                  || b.dist - a.dist)[0];
                const vAvg = Math.min(lead.dist, C.total) / Math.max(lead.st.t, 1) * 3.6;
                return (
                  <>
                    <div style={{ fontFamily: font, fontSize: 10, letterSpacing: 2, color: "#3c5a7a", fontWeight: 800, fontStyle: "italic", margin: "4px 0 0" }}>THE COURSE</div>
                    <ResultRow k="Distance" v={`${(C.total / 1000).toFixed(1)} km`} />
                    <ResultRow k="Average speed" v={`${vAvg.toFixed(1)} km/h`} />
                    <ResultRow k="Wind" v={`${wdir} · ${C.wv.toFixed(1)} m/s`} />
                    <ResultRow k="Total climbing" v={`${Math.round(climb)} m`} />
                    <ResultRow k="Highest point" v={`${Math.round(hi)} m`} />
                    <ResultRow k="Steepest pitch" v={`${(steep * 100).toFixed(1)} %`} />
                  </>
                );
              })()}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => start(seedRef.current)} style={btn("#3a76bd", "#fff", 1)}>SAME RACE AGAIN</button>
                <button onClick={() => toBuild((Math.random() * 1e9) | 0)} style={btn("#2e7d46", "#fff", 1)}>NEW RACE</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#3c5a7a", fontFamily: font, letterSpacing: 1 }}>SAME RACE = same wind, same legs. A fair rematch.</div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ height: "100dvh", width: "100%", background: "linear-gradient(180deg, #e6edf4, #9fb2c5)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font, padding: 6, boxSizing: "border-box" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,700;0,800;1,700;1,800&display=swap'); button:active{transform:scale(0.97)} button{cursor:pointer}`}</style>
      <div ref={wrapRef} style={{ position: "relative", flex: 1, overflow: "hidden", borderRadius: 14, border: "2px solid #6f8cab", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.55), 0 4px 14px rgba(15,35,60,0.35)" }}>
        <canvas ref={canvasRef} onPointerDown={onCanvasTap} style={{ position: "absolute", inset: 0 }} />
        {raceUI}
        {phase === "build" && previewRef.current && (() => {
          const pv = previewRef.current;
          const C = pv.course;
          const kindTxt = C.kind === "climb" ? "SUMMIT FINISH" : C.kind === "sprint" ? "SPRINT FINISH" : "PUNCHY FINISH";
          let climbM = 0, prev = C.eleAt(0);
          for (let d = 10; d <= C.total; d += 10) { const e = C.eleAt(d); if (e > prev) climbM += e - prev; prev = e; }
          const hw = C.windAt(0);
          const wdir = hw > 0.4 ? "HEADWIND" : hw < -0.4 ? "TAILWIND" : "CROSSWIND";
          const left = budgetLeft(build);
          const clsTxt = { sprinter: "SPRINTER", breaker: "BREAKAWAY", climber: "CLIMBER" };
          const bump = (key, d) => setBuild((b) => {
            const v = clamp(b[key] + d, 1, 10);
            if (d > 0 && budgetLeft({ ...b, [key]: v }) < 0) return b;
            return { ...b, [key]: v };
          });
          const stepBtn = (dis) => ({ ...btn("#3a76bd", "#fff"), padding: "2px 12px", fontSize: 15, opacity: dis ? 0.35 : 1 });
          // every kit except the four already in the break — you cannot ride in an
          // opponent's colours. The modulo keeps a re-rolled day from stranding the
          // index when the struck teams change under it.
          const kits = TEAMS.filter((t) => !pv.opponents.some((o) => o.team === t.team));
          const kit = kits[((teamI % kits.length) + kits.length) % kits.length];
          const rowLabel = { fontFamily: font, fontSize: 11.5, fontWeight: 800, fontStyle: "italic", letterSpacing: 1, color: "#0d3568", width: 76, flexShrink: 0 };
          // the label is the button: tap the name (or its little marker) and the row
          // explains itself in one line; tap again — or another row — and it yields
          const infoLabel = (key, label) => (
            <span onClick={() => setAttrInfo(attrInfo === key ? null : key)}
              style={{ fontFamily: font, fontSize: 11.5, fontWeight: 800, fontStyle: "italic", letterSpacing: 1, color: "#0d3568", width: 76, cursor: "pointer", userSelect: "none" }}>
              {label}
              <span style={{ display: "inline-block", marginLeft: 4, width: 12, height: 12, lineHeight: "12px", textAlign: "center", borderRadius: 999, background: attrInfo === key ? "#3a76bd" : "rgba(60,90,125,0.25)", color: attrInfo === key ? "#fff" : "#3c5a7a", fontSize: 8.5, fontStyle: "normal", fontWeight: 700, verticalAlign: "1px" }}>i</span>
            </span>
          );
          const infoLine = (txt) => (
            <div style={{ fontFamily: font, fontSize: 10, lineHeight: 1.35, color: "#22456b", background: "rgba(58,118,189,0.12)", border: "1px solid rgba(58,118,189,0.35)", borderRadius: 6, padding: "4px 8px", margin: "1px 0 3px" }}>{txt}</div>
          );
          return (
            <div style={overlay}>
              <div style={{ ...card, maxWidth: 380, padding: "14px 16px" }}>
                <div style={{ fontFamily: font, fontSize: 11, letterSpacing: 3, color: "#3c5a7a", fontWeight: 800, fontStyle: "italic" }}>THE DAY AHEAD</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: font, fontWeight: 800, fontSize: 22, fontStyle: "italic", color: "#0d3568", letterSpacing: 1 }}>{kindTxt}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: "#22456b" }}>{(C.total / 1000).toFixed(1)} km · {Math.round(climbM)} m ↑ · {wdir} {C.wv.toFixed(1)}</span>
                </div>
                <canvas ref={buildCvs} style={{ width: "100%", height: 54, borderRadius: 6, border: "1.5px solid #6f8cab", margin: "6px 0 8px" }} />
                {/* the four who went with you */}
                {pv.opponents.map((o) => (
                  <div key={o.name} onClick={() => setRiderCard(o)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 2px", cursor: "pointer" }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: o.color, border: "1.5px solid #123a6b", flexShrink: 0 }} />
                    <span style={{ fontFamily: font, fontWeight: 800, fontStyle: "italic", fontSize: 12.5, color: "#0d3568", letterSpacing: 0.5 }}>{o.name}</span>
                    <span style={{ fontFamily: font, fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "#3c5a7a", flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{o.team}</span>
                    <span style={{ fontFamily: font, fontSize: 8, fontWeight: 800, letterSpacing: 1, color: "#fff", background: "#3a76bd", borderRadius: 999, padding: "1px 7px" }}>{clsTxt[o.class] || ""}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "8px 0 2px" }}>
                  <span style={{ fontFamily: font, fontSize: 11, letterSpacing: 3, color: "#3c5a7a", fontWeight: 800, fontStyle: "italic" }}>BUILD YOUR RIDER</span>
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: left > 0 ? "#1d7a34" : "#c22a1e" }}>POINTS LEFT: {left}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2.5px 0" }}>
                  <span style={rowLabel}>NAME</span>
                  <input value={pname} maxLength={12} placeholder="YOUR NAME" spellCheck={false}
                    onChange={(e) => setPname(e.target.value.toUpperCase())}
                    style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#0d3568", background: "rgba(255,255,255,0.55)", border: "1.5px solid #6f8cab", borderRadius: 6, padding: "3px 8px", outline: "none" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2.5px 0" }}>
                  <span style={rowLabel}>TEAM</span>
                  <button onClick={() => setTeamI((i) => i - 1)} style={stepBtn(false)}>◀</button>
                  <span style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: kit.color, border: "1.5px solid #123a6b", flexShrink: 0 }} />
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 800, fontStyle: "italic", letterSpacing: 1, color: "#0d3568", overflow: "hidden", whiteSpace: "nowrap" }}>{kit.team}</span>
                  </span>
                  <button onClick={() => setTeamI((i) => i + 1)} style={stepBtn(false)}>▶</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2.5px 0" }}>
                  {infoLabel("kg", "WEIGHT")}
                  <button onClick={() => setBuild((b) => ({ ...b, kg: Math.max(b.kg - 4, MASSES[0]) }))} disabled={build.kg <= MASSES[0]} style={stepBtn(build.kg <= MASSES[0])}>−</button>
                  <span style={{ flex: 1, textAlign: "center", fontFamily: mono, fontSize: 13, fontWeight: 700, color: "#0d3568" }}>{build.kg} KG</span>
                  <button onClick={() => setBuild((b) => ({ ...b, kg: Math.min(b.kg + 4, MASSES[MASSES.length - 1]) }))} disabled={build.kg >= MASSES[MASSES.length - 1]} style={stepBtn(build.kg >= MASSES[MASSES.length - 1])}>+</button>
                </div>
                {attrInfo === "kg" && infoLine(MASS_INFO)}
                {ATTRS.map((at) => (
                  <React.Fragment key={at.key}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2.5px 0" }}>
                      {infoLabel(at.key, at.label)}
                      <button onClick={() => bump(at.key, -1)} disabled={build[at.key] <= 1} style={stepBtn(build[at.key] <= 1)}>−</button>
                      <div style={{ flex: 1, display: "flex", gap: 2 }}>
                        {Array.from({ length: 10 }, (_, i) => (
                          <span key={i} style={{ flex: 1, height: 10, borderRadius: 2, background: i < build[at.key] ? "#3a76bd" : "rgba(60,90,125,0.25)", boxShadow: i < build[at.key] ? "inset 0 1px 0 rgba(255,255,255,0.5)" : "none" }} />
                        ))}
                      </div>
                      <button onClick={() => bump(at.key, 1)} disabled={build[at.key] >= 10 || left <= 0} style={stepBtn(build[at.key] >= 10 || left <= 0)}>+</button>
                    </div>
                    {attrInfo === at.key && infoLine(at.info)}
                  </React.Fragment>
                ))}
                <button onClick={() => { specRef.current = { ...buildSpec(build), name: pname.trim() || "YOU", team: kit.team, color: kit.color }; start(seedRef.current); }}
                  style={{ ...btn("#2e7d46", "#fff", 1), marginTop: 10, fontSize: 15, width: "100%", padding: "12px 0" }}>
                  START RACE
                </button>
              </div>
            </div>
          );
        })()}
        {riderCard && (() => {
          // one card for both doors: a raw POOL spec from the build screen, or the
          // live rider object off the road — same fields, same 1-10 scale as the
          // builder's own pips (ratingsOf is buildSpec's anchors inverted)
          const r = riderCard;
          const cls = { sprinter: "SPRINTER", breaker: "BREAKAWAY", climber: "CLIMBER" }[r.klass || r.class] || "";
          const rat = ratingsOf(r);
          const live = phase === "race" && S && !S.ended && r.isPlayer !== undefined;
          const pipRow = (label, v) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2.5px 0" }}>
              <span style={{ fontFamily: font, fontSize: 10.5, fontWeight: 800, fontStyle: "italic", letterSpacing: 1, color: "#0d3568", width: 56, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, display: "flex", gap: 2 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: i < v ? "#3a76bd" : "rgba(60,90,125,0.25)", boxShadow: i < v ? "inset 0 1px 0 rgba(255,255,255,0.5)" : "none" }} />
                ))}
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: "#22456b", width: 14, textAlign: "right" }}>{v}</span>
            </div>
          );
          return (
            <div style={{ ...overlay, zIndex: 8 }} onClick={closeCard}>
              <div style={{ ...card, maxWidth: 330, padding: "14px 16px" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Portrait look={r.look} color={r.color} size={68} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: font, fontWeight: 800, fontStyle: "italic", fontSize: 21, color: "#0d3568", letterSpacing: 1, lineHeight: 1.05 }}>{r.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, border: "1.5px solid #123a6b", flexShrink: 0 }} />
                      <span style={{ fontFamily: font, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#3c5a7a", overflow: "hidden", whiteSpace: "nowrap" }}>{r.team}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      {cls && <span style={{ fontFamily: font, fontSize: 8, fontWeight: 800, letterSpacing: 1, color: "#fff", background: "#3a76bd", borderRadius: 999, padding: "1px 7px" }}>{cls}</span>}
                      <span style={{ fontFamily: mono, fontSize: 9.5, fontWeight: 700, color: "#22456b" }}>{r.mass} KG · {r.h.toFixed(2)} M</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: font, fontSize: 11.5, lineHeight: 1.4, color: r.merits ? "#22456b" : "#5a7086", fontStyle: r.merits ? "normal" : "italic", background: "rgba(58,118,189,0.10)", border: "1px solid rgba(58,118,189,0.3)", borderRadius: 6, padding: "5px 9px", margin: "10px 0 8px" }}>
                  {r.merits || "The palmarès is still blank."}
                </div>
                {ATTRS.map((at) => pipRow(at.label, rat[at.key]))}
                {live && (
                  <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: "#b8791a", marginTop: 6 }}>
                    NOW: {roleOf(S, r)} · {Math.round(r.power)} W · {(r.speed * 3.6).toFixed(0)} KM/H
                  </div>
                )}
                <button onClick={closeCard} style={{ ...btn("#3a76bd", "#fff", 1), marginTop: 10, width: "100%", padding: "9px 0", fontSize: 13 }}>CLOSE</button>
              </div>
            </div>
          );
        })()}
        {phase === "menu" && (
          <div style={overlay}>
            <div style={{ ...card, textAlign: "center", maxWidth: 340 }}>
              <div style={{ fontSize: 13, letterSpacing: 5, color: "#b8791a", fontWeight: 800, fontStyle: "italic" }}>150 KM ALREADY IN THE LEGS</div>
              <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: 2, color: "#0d3568", fontStyle: "italic", lineHeight: 1, margin: "6px 0 14px", textShadow: "0 1px 0 rgba(255,255,255,0.8)" }}>THE<br />BREAKAWAY</div>
              <div style={{ fontSize: 12, letterSpacing: 4, color: "#3a76bd", fontWeight: 800, fontStyle: "italic", marginTop: -8, marginBottom: 12 }}>LEGENDS 0.4</div>
              <div style={{ fontSize: 14, color: "#22456b", lineHeight: 1.5, textAlign: "left" }}>
                You're away with four legends — drawn from fifteen, weighted by the day's finale — ~23 km from the line, the peloton about a minute back, pacing to catch the best of you by a single second.
                <br /><br />
                <b style={{ color: "#0d3568" }}>One thumb, one control:</b> drag the watt slider. It stays where you leave it.
                <br />• <span style={{ color: "#1d7a34", fontWeight: 700 }}>Green line</span> = your threshold
                <br />• <span style={{ color: "#c22a1e", fontWeight: 700 }}>Red line</span> = all you've got right now — burn your matches and it sinks
              </div>
              <button onClick={() => toBuild(seedRef.current)} style={{ ...btn("#2e7d46", "#fff", 1), marginTop: 18, fontSize: 16, width: "100%", padding: "14px 0" }}>ROLL OUT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
