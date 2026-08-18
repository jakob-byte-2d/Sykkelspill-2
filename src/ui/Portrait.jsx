import React from "react";

/* ============================================================
   THE PORTRAIT — a stylized head built from the roster's `look` descriptor and the
   kit color. Pure SVG, flat poster style: the card is DOM, so no canvas ref needed.
   Everything is dressing — riders.js documents the vocabulary (style: bald|short|
   slick|curls|bandana|cap, extra: shades|goatee|sideburns|stubble|earring).
   ============================================================ */

export function Portrait({ look, color, size = 56 }) {
  const L = look || { skin: "#e8c9a0", style: "short" };
  const skin = L.skin || "#e8c9a0";
  const hair = L.hair || "#2a2118";
  const ex = L.extra || [];
  const has = (k) => ex.includes(k);
  const style = L.style || "short";
  const shadow = "rgba(20,30,45,0.28)";     // one darkener for brim, collar edge, neck
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", flexShrink: 0 }}>
      {/* jersey collar + neck */}
      <rect x="27" y="40" width="10" height="10" fill={skin} />
      <rect x="27" y="40" width="10" height="4" fill={shadow} opacity="0.35" />
      <path d="M14 64 Q14 50 26 49 L38 49 Q50 50 50 64 Z" fill={color} stroke="#123a6b" strokeWidth="1.5" />
      <path d="M26 49 L32 55 L38 49" fill="none" stroke={shadow} strokeWidth="1.5" />
      {/* ears + head */}
      <circle cx="19.5" cy="31" r="3" fill={skin} />
      <circle cx="44.5" cy="31" r="3" fill={skin} />
      <ellipse cx="32" cy="30" rx="12.5" ry="14" fill={skin} />
      {/* sideburns ride on the head, under the hair */}
      {has("sideburns") && <>
        <rect x="20.2" y="26" width="3.2" height="9.5" rx="1.5" fill={hair} />
        <rect x="40.6" y="26" width="3.2" height="9.5" rx="1.5" fill={hair} />
      </>}
      {/* the top: hair, bandana or cap */}
      {style === "short" && <path d="M19.5 27 Q19.5 15.5 32 15.5 Q44.5 15.5 44.5 27 Q40 21.5 32 21.5 Q24 21.5 19.5 27 Z" fill={hair} />}
      {style === "slick" && <>
        <path d="M19.5 26 Q19.5 15 32 15 Q44.5 15 44.5 26 Q40 19.5 32 19.5 Q24 19.5 19.5 26 Z" fill={hair} />
        <path d="M23 18.5 Q32 15.8 41 18.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      </>}
      {style === "curls" && <>
        <circle cx="23" cy="20.5" r="5.2" fill={hair} />
        <circle cx="32" cy="17.5" r="5.8" fill={hair} />
        <circle cx="41" cy="20.5" r="5.2" fill={hair} />
        <path d="M19.5 27 Q19.5 18 32 18 Q44.5 18 44.5 27 Q40 22 32 22 Q24 22 19.5 27 Z" fill={hair} />
      </>}
      {style === "bandana" && <>
        <path d="M19.5 26.5 Q19.5 14.5 32 14.5 Q44.5 14.5 44.5 26.5 L19.5 26.5 Z" fill={color} stroke="#123a6b" strokeWidth="1.2" />
        <path d="M44 24 L51 29 L45 27.5 Z" fill={color} stroke="#123a6b" strokeWidth="1" />
        <circle cx="26" cy="21" r="1.2" fill="rgba(255,255,255,0.85)" />
        <circle cx="33" cy="18.5" r="1.2" fill="rgba(255,255,255,0.85)" />
        <circle cx="39.5" cy="21.5" r="1.2" fill="rgba(255,255,255,0.85)" />
      </>}
      {style === "cap" && <>
        <path d="M19.5 25.5 Q19.5 14.5 32 14.5 Q44.5 14.5 44.5 25.5 L19.5 25.5 Z" fill={color} stroke="#123a6b" strokeWidth="1.2" />
        <ellipse cx="32" cy="25.5" rx="14.5" ry="2.6" fill={color} stroke="#123a6b" strokeWidth="1.2" />
        <ellipse cx="32" cy="25.5" rx="14.5" ry="2.6" fill={shadow} opacity="0.4" />
        <circle cx="32" cy="15.5" r="1.3" fill="#123a6b" />
      </>}
      {/* face: eyes or shades, nose, mouth */}
      {has("shades")
        ? <>
          <rect x="21.5" y="26.5" width="21" height="6.5" rx="3.2" fill="#1b2129" />
          <line x1="19.5" y1="29" x2="21.5" y2="28.5" stroke="#1b2129" strokeWidth="1.6" />
          <line x1="44.5" y1="29" x2="42.5" y2="28.5" stroke="#1b2129" strokeWidth="1.6" />
        </>
        : <>
          <circle cx="27" cy="29.5" r="1.4" fill="#26303a" />
          <circle cx="37" cy="29.5" r="1.4" fill="#26303a" />
        </>}
      <path d="M32 31 Q31 34 30.6 35.4 Q31.4 36.2 32.6 35.8" fill="none" stroke={shadow} strokeWidth="1.2" />
      {has("stubble") && <ellipse cx="32" cy="38.5" rx="8.5" ry="5.5" fill={hair} opacity="0.18" />}
      <path d="M28.5 39 Q32 40.6 35.5 39" fill="none" stroke="#8d5a4a" strokeWidth="1.4" />
      {has("goatee") && <path d="M27.5 37.5 Q27.5 44.5 32 44.5 Q36.5 44.5 36.5 37.5 Q36.5 41.5 32 41.5 Q27.5 41.5 27.5 37.5 Z" fill={hair} />}
      {has("earring") && <circle cx="45" cy="34" r="1.4" fill="#e8b23a" />}
    </svg>
  );
}
