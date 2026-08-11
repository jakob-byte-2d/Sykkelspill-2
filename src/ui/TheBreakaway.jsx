import React, { useEffect, useRef, useState } from "react";
import { DEBUG, draw, setDebug } from "../render/draw.js";
import { fmtGap, fmtTime } from "../render/format.js";
import { SHEL_MAX, bodyNow, clamp, finalize, gapRows, newSim, setInput, stepSim } from "../sim/index.js";
import { sliderPts, tFromW, wFromT } from "./slider.js";
import { ResultRow, btn, card, markerTop, overlay, place } from "./widgets.jsx";

/* ============================================================ */
export default function TheBreakaway() {
  const [phase, setPhase] = useState("menu");
  const [, setTick] = useState(0);
  const [speedMode, setSpeedMode] = useState(5);
  const [debugOn, setDebugOn] = useState(DEBUG);
  const speedRef = useRef(5);
  const simRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const seedRef = useRef((Math.random() * 1e9) | 0);
  const dragRef = useRef(false);

  const start = (seed) => {
    seedRef.current = seed;
    simRef.current = newSim(seed);
    // the fixture the telemetry reads from — the whole sim, and only when asked for
    if (DEBUG && typeof window !== "undefined") window.__S = simRef.current;
    speedRef.current = 5; setSpeedMode(5);
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
    // grabbing the slider takes the controls back, whatever mode you were in
    setInput(S, { mode: "manual", watts: asked });
  };
  const onSliderUp = () => {
    dragRef.current = false;
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
    const grad = S.course.gradAt(player.dist);
    const inWheels = player.shel > 0.05;
    const tT = tFromW(body.T, pts), tC = tFromW(body.ceil, pts), tS = tFromW(S.playerW, pts);

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
              {[1, 5, 10, 100].map((m) => (
                <button key={m} onClick={() => { speedRef.current = m; setSpeedMode(m); }}
                  style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #0d3568", cursor: "pointer", fontStyle: "normal",
                    boxShadow: speedMode === m ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.55)",
                    background: speedMode === m ? "linear-gradient(180deg, #ffffff, #cfe2f6 60%, #a9cdf0)" : "linear-gradient(180deg, #9cc0e6, #3a76bd 55%, #2a5f9e)",
                    color: speedMode === m ? "#0d3568" : "#eaf3fb" }}>
                  {m}×
                </button>
              ))}
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
        </div>

        {/* sit on: park at the back of the rotation */}
        <button
          onClick={() => {
            if (!S || S.ended) return;
            // leaving SIT ON hands the controls back exactly where the legs are
            setInput(S, S.input.mode === "sit"
              ? { mode: "manual", watts: Math.round(player.power) }
              : { mode: "sit" });
          }}
          style={actionBtn(94, {
            cursor: "pointer",
            border: "2px solid #145c27", color: "#fff",
            background: S.input.mode === "sit"
              ? "linear-gradient(180deg, #d8f7dd, #5fc978 45%, #1d7a34)"
              : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #2f9e4f",
          })}>
          {S.input.mode === "sit" ? "HOLDING" : "SIT ON"}
        </button>

        {/* take the front */}
        <button
          onClick={() => {
            if (!S || S.ended) return;
            setInput(S, S.input.mode === "relay"
              ? { mode: "manual", watts: Math.round(player.power) }
              : { mode: "relay" });
          }}
          style={actionBtn(56, {
            cursor: "pointer",
            border: "2px solid #123a6b", color: "#fff",
            background: S.input.mode === "relay"
              ? "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #c0392b"
              : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), #3a76bd",
          })}>
          {S.input.mode === "relay" ? "MANUAL" : "RELAY"}
        </button>

        {/* mode chip — where you ARE; the buttons say where you can go */}
        <div style={{
          position: "absolute", right: 6, bottom: 132, width: 74, padding: "3px 0",
          fontFamily: font, fontWeight: 800, fontStyle: "italic", letterSpacing: 0.8, fontSize: 10,
          textAlign: "center", borderRadius: 999, color: "#dfe9f4",
          background: "rgba(10,25,45,0.55)", border: "1px solid rgba(255,255,255,0.25)",
        }}>
          {S.input.mode === "sit" ? "SIT ON" : S.input.mode === "relay" ? "RELAY" : "MANUAL"}
        </div>

        {/* instrument panel */}
        <div style={{ position: "absolute", left: 10, bottom: 56, width: 168, background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)", border: "2px solid #6f8cab", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(60,90,125,0.35), 0 3px 10px rgba(15,35,60,0.35)", borderRadius: 12, padding: "10px 12px 8px" }}>
          <Bar label="SURGE" frac={body.sf} color="#35c24d" />
          <Bar label="FUEL" frac={body.ff} color="#2e8fe0" />
          <Bar label="LEGS" frac={1 - player.legs} color="#e0483c" />
          <Bar label="LY" frac={player.shel / SHEL_MAX} color="#8e6bd6" />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: mono, fontSize: 11 }}>
            <span style={{ color: "#1d7a34", fontWeight: 700 }}>THR {Math.round(body.T)}</span>
            <span style={{ color: "#c22a1e", fontWeight: 700 }}>MAX {Math.round(body.ceil)}</span>
          </div>
          <div style={{ marginTop: 3, fontFamily: mono, fontSize: 11, color: "#0d3568" }}>
            I VINDEN <b>{Math.round((player.st.wind / Math.max(player.st.t, 1)) * 100)}%</b>
            <span style={{ float: "right", color: "#3c5a7a" }}>av tiden</span>
          </div>
          <div style={{ marginTop: 3, fontFamily: mono, fontSize: 11, color: "#123a6b", fontWeight: 700 }}>
            {`${Math.round(player.power)} W${inWheels ? " · " + Math.round(player.shel * 100) + "% LY" : ""}`}
            <span style={{ float: "right", color: "#3c5a7a" }}>{(player.speed * 3.6).toFixed(0)} km/h {grad > 0.005 ? "▲" : grad < -0.005 ? "▼" : ""}{Math.abs(grad * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* watt slider — its foot carries the WATTS label, so the column has to stop
            clear of the mode chip below it, not just above the chip's own top edge */}
        <div
          style={{ position: "absolute", right: 6, top: 84, bottom: 158, width: 74, touchAction: "none", userSelect: "none" }}
          onPointerDown={(e) => { dragRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); onSlider(e, e.currentTarget); }}
          onPointerMove={(e) => { if (dragRef.current) onSlider(e, e.currentTarget); }}
          onPointerUp={onSliderUp}
          onPointerCancel={onSliderUp}
        >
          <div style={{ position: "absolute", left: 26, top: 14, bottom: 14, width: 22, borderRadius: 11, background: "linear-gradient(180deg, rgba(224,72,60,0.55), #7e93a8 30%, #55708c)", border: "2px solid #35516e", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.35)" }} />
          {/* green threshold line */}
          <div style={{ position: "absolute", left: 20, width: 40, height: 2, background: "#2fdc55", top: markerTop(tT), boxShadow: "0 0 5px #2fdc55" }} />
          {/* red ceiling line — sinks when you burn your matches */}
          <div style={{ position: "absolute", left: 20, width: 40, height: 2, background: "#ff4b3a", top: markerTop(tC), boxShadow: "0 0 5px #ff4b3a", transition: "top .3s linear" }} />
          {/* thumb */}
          <div style={{ position: "absolute", left: 12, width: 50, height: 34, top: `calc(${markerTop(tS)} - 17px)`, borderRadius: 999, background: S.input.mode === "sit" ? "linear-gradient(180deg, #d8f7dd, #5fc978 45%, #1d7a34)" : "linear-gradient(180deg, #eaf3fb, #7db3e0 45%, #2f6cb3)", border: S.input.mode === "sit" ? "2px solid #145c27" : "2px solid #123a6b", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(15,35,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 800, fontSize: 13, color: "#fff", textShadow: "0 1px 2px rgba(10,30,55,0.7)" }}>
            {S.input.mode === "sit" ? (S.braking > 1 ? "BREMS" : "HJUL") : S.playerW}
          </div>
          {S.input.mode === "sit" && (
            <div style={{ position: "absolute", right: 64, width: 42, textAlign: "right", top: `calc(${markerTop(tS)} - 8px)`, fontFamily: mono, fontWeight: 800, fontSize: 12, color: "#1d7a34", textShadow: "0 1px 0 rgba(255,255,255,0.8)" }}>
              {S.playerW}
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
