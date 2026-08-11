import { clamp } from "../sim/rng.js";

/* Small presentational pieces shared by the screens. */

export const markerTop = (t) => `calc(14px + ${((1 - clamp(t, 0, 1)) * 100).toFixed(2)}% - ${((1 - clamp(t, 0, 1)) * 28).toFixed(1)}px)`;

export const place = (p) => (p === 1 ? "🏆 YOU WIN THE STAGE" : p === 2 ? "2ND ON THE STAGE" : p === 3 ? "3RD ON THE STAGE" : p + "TH ON THE STAGE");

export const btn = (bg, fg, big) => ({
  background: `linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.18)), ${bg}`,
  color: fg, border: "1px solid #123a6b", borderRadius: 999,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(20,40,70,0.35)",
  padding: big ? "12px 18px" : "10px 14px", fontFamily: "'Barlow Condensed','Arial Narrow',system-ui,sans-serif",
  fontWeight: 800, fontStyle: "italic", letterSpacing: 1.5, fontSize: 13, textShadow: "0 1px 1px rgba(0,0,0,0.35)",
});

export const overlay = { position: "absolute", inset: 0, background: "rgba(28,58,96,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 5 };

export const card = {
  background: "linear-gradient(180deg, #f4f8fc, #ccd9e6 55%, #b3c6d8)",
  border: "2px solid #6f8cab", borderRadius: 16, padding: "18px 20px", width: "100%", maxWidth: 360,
  boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(60,90,125,0.35), 0 12px 40px rgba(15,35,60,0.45)",
};

export const ResultRow = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(60,90,125,0.25)", fontSize: 13 }}>
    <span style={{ color: "#3c5a7a" }}>{k}</span>
    <span style={{ color: "#0d3568", fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{v}</span>
  </div>
);
