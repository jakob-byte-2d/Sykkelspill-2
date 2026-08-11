/* Clock and gap formatting — presentation only. */

export const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h > 0 ? h + ":" : "") + String(m).padStart(h > 0 ? 2 : 1, "0") + ":" + String(ss).padStart(2, "0");
};

export const fmtGap = (s) => (s < 0 ? "−" : "+") + fmtTime(Math.abs(s));
