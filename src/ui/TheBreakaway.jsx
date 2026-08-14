import React, { useEffect, useRef, useState } from "react";
import { DEBUG, draw, setDebug } from "../render/draw.js";
import { fmtGap, fmtTime } from "../render/format.js";
import { SPRINT_FINALE_M } from "../content/tuning.js";
import { bodyNow, clamp, finalize, gapRows, newSim, pushEvent, setInput, stepSim } from "../sim/index.js";
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
  const speedRef = useRef(5);
  const prevSpeedRef = useRef(5);   // what pause interrupted, so resume lands where you were
  const simRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const seedRef = useRef((Math.random() * 1e9) | 0);
  const dragRef = useRef(false);
  const alertRef = useRef(null);   // the last big event already reacted to

  const start = (seed) => {
    seedRef.current = seed;
    simRef.current = newSim(seed);
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
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
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
      if (S && canvasRef.current) draw(S, canvasRef.current, clamp(acc, 0, 1));
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
    // Two readings on one track. The INSTRUCTION is the player's setpoint: it sits
    // exactly where the thumb put it, whatever mode is riding, and only the MANUAL
    // button hands the legs over to it. The INDICATOR is what the legs are actually
    // doing right now — the autopilot's pulls, the wheel price, the sprint — and it
    // moves entirely on its own. The order can exceed the body: pinned at or above
    // the ceiling (or sprinting), the instruction glows red and shivers.
    const setW = S.input.watts;
    const liveW = S.playerW;
    const atMax = S.input.sprint || setW >= Math.floor(body.ceil);
    const tT = tFromW(body.T, pts), tC = tFromW(body.ceil, pts);
    const tSet = tFromW(setW, pts), tLive = tFromW(liveW, pts);
    // ...and it wears the colour of what you are doing, the same one the chip and the
    // button carry: the sprint's red beats the override's gold beats the mode's own.
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
              <button onClick={() => start((Math.random() * 1e9) | 0)}
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
            one column — grabbing the slider itself is what MANUAL is. */}
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

        {/* watt slider — its foot carries the WATTS label, so the column has to stop
            clear of the mode chip below it, not just above the chip's own top edge */}
        <div
          style={{ position: "absolute", right: 6, top: 84, bottom: 250, width: 104, touchAction: "none", userSelect: "none" }}
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
          {/* the INDICATOR: what the legs are actually doing, moving on its own —
              deliberately flat and un-pressable: no gloss, no grip, just a reading */}
          <div style={{
            position: "absolute", left: 44, width: 46, height: 18, top: `calc(${markerTop(tLive)} - 9px)`,
            borderRadius: 4, pointerEvents: "none",
            background: "rgba(20,34,52,0.78)",
            border: "1px solid rgba(160,185,210,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontWeight: 700, fontSize: 10.5,
            color: "#cfe0f2", transition: "top .15s linear",
          }}>
            {liveW}
          </div>
          {/* the INSTRUCTION: the player's setpoint, exactly where the thumb put it,
              in the colour of the mode — and asking for more than the body has (or
              sprinting), it turns red and shivers. MANUAL hands the legs over to it
              outright; in RELAY it is the price of YOUR pulls — the rotation rides
              itself, but your turn on the front rides this number. SIT ON ignores it. */}
          <div style={{
            position: "absolute", left: 42, width: 50, height: 34, top: `calc(${markerTop(tSet)} - 17px)`,
            borderRadius: 999, pointerEvents: "none",
            background: atMax ? "linear-gradient(180deg, #ffb3a6, #ff5a42 45%, #b31d0e)" : DOING.bg,
            border: atMax ? "2px solid #7c1810" : "2px solid " + DOING.edge,
            boxShadow: atMax
              ? "0 0 12px rgba(255,46,26,0.85), inset 0 1px 0 rgba(255,255,255,0.6)"
              : "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(15,35,60,0.5)",
            animation: atMax ? "dirre .12s linear infinite" : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontWeight: 800, fontSize: 13,
            color: atMax ? "#fff" : DOING.ink,
            textShadow: atMax || DOING.ink === "#fff" ? "0 1px 2px rgba(10,30,55,0.7)" : "none",
          }}>
            {setW}
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
              border: "2px solid " + (atMax ? "#b31d0e" : DOING.edge),
              boxShadow: atMax ? "0 0 12px rgba(255,46,26,0.7)" : "0 3px 10px rgba(15,35,60,0.45)",
              fontFamily: mono, fontWeight: 800,
              fontSize: 16, color: atMax ? "#b31d0e" : "#0d3568", pointerEvents: "none",
            }}>
              {setW} W
            </div>
          )}
          <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, textAlign: "center", fontSize: 9, letterSpacing: 2, color: "#0d3568", fontWeight: 800, fontStyle: "italic", fontFamily: font }}>WATTS</div>
        </div>

        {/* result card */}
        {S.ended && S.result && (
          <div style={overlay}>
            <div style={card}>
              <div style={{ fontFamily: font, fontSize: 12, letterSpacing: 3, color: "#3c5a7a", fontWeight: 800, fontStyle: "italic" }}>RESULT</div>
              <div style={{ fontFamily: font, fontWeight: 800, fontSize: 34, letterSpacing: 1, color: S.result.caught ? "#c22a1e" : "#0d3568", fontStyle: "italic", margin: "2px 0 10px" }}>
                {S.result.caught ? `CAUGHT · ${S.result.atKm.toFixed(1)} KM TO GO` : place(S.result.place)}
              </div>
              <ResultRow k="Average power" v={`${Math.round(player.st.work / Math.max(player.st.t, 1))} W  ·  ${(player.st.work / Math.max(player.st.t, 1) / player.mass).toFixed(1)} W/kg`} />
              <ResultRow k="Time in the wind" v={fmtTime(player.st.wind)} />
              <ResultRow k="Time above threshold" v={fmtTime(player.st.above)} />
              <ResultRow k="Deepest the tank went" v={`${Math.round(player.st.minFuel * 100)} % fuel`} />
              <ResultRow k="Wind on the day" v={`${S.course.wv.toFixed(1)} m/s`} />
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => start(seedRef.current)} style={btn("#3a76bd", "#fff", 1)}>SAME RACE AGAIN</button>
                <button onClick={() => start((Math.random() * 1e9) | 0)} style={btn("#2e7d46", "#fff", 1)}>NEW RACE</button>
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
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
        {raceUI}
        {phase === "menu" && (
          <div style={overlay}>
            <div style={{ ...card, textAlign: "center", maxWidth: 340 }}>
              <div style={{ fontSize: 13, letterSpacing: 5, color: "#b8791a", fontWeight: 800, fontStyle: "italic" }}>150 KM ALREADY IN THE LEGS</div>
              <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: 2, color: "#0d3568", fontStyle: "italic", lineHeight: 1, margin: "6px 0 14px", textShadow: "0 1px 0 rgba(255,255,255,0.8)" }}>THE<br />BREAKAWAY</div>
              <div style={{ fontSize: 12, letterSpacing: 4, color: "#3a76bd", fontWeight: 800, fontStyle: "italic", marginTop: -8, marginBottom: 12 }}>LEGENDS 0.2</div>
              <div style={{ fontSize: 14, color: "#22456b", lineHeight: 1.5, textAlign: "left" }}>
                You're away with Van der Poel, Van Aert, Küng and Pantani, ~23 km from the line, the peloton about a minute back — pacing to catch the best of you by a single second.
                <br /><br />
                <b style={{ color: "#0d3568" }}>One thumb, one control:</b> drag the watt slider. It stays where you leave it.
                <br />• <span style={{ color: "#1d7a34", fontWeight: 700 }}>Green line</span> = your threshold
                <br />• <span style={{ color: "#c22a1e", fontWeight: 700 }}>Red line</span> = all you've got right now — burn your matches and it sinks
              </div>
              <button onClick={() => start(seedRef.current)} style={{ ...btn("#2e7d46", "#fff", 1), marginTop: 18, fontSize: 16, width: "100%", padding: "14px 0" }}>ROLL OUT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
