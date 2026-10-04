// Small colour toolkit: OKLCH <-> sRGB hex, gamut mapping, WCAG contrast.
// OKLCH is used to generate palettes because equal steps in L look equal to
// the eye, so contrast can be tuned without the hue drifting.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}
export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

// Keep L and H, lower chroma until the colour fits in sRGB.
export function oklch(L, C, H) {
  L = clamp01(L);
  let lin = oklchToLinear(L, C, H);
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid; else hi = mid;
    }
    lin = oklchToLinear(L, lo, H);
  }
  return rgbToHex(lin.map((v) => toGamma(clamp01(v))));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Walk lightness away from the background until the colour reaches the
// target contrast against every colour in `against`.
export function solveL({ C, H, against, target, startL, dir }) {
  let L = startL;
  for (let i = 0; i < 200; i++) {
    const hex = oklch(L, C, H);
    if (against.every((bg) => contrast(hex, bg) >= target)) return { hex, L };
    L += dir * 0.005;
    if (L <= 0 || L >= 1) break;
  }
  const hex = oklch(dir < 0 ? 0 : 1, C, H);
  return { hex, L: dir < 0 ? 0 : 1 };
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255));
  return `rgba(${r},${g},${b},${alpha})`;
}

// Hue families used for filtering, based on OKLCH hue of the accent.
export function hueFamily(hex) {
  const [, C, H] = hexToOklch(hex);
  // OKLCH hue angles. Pure sRGB red sits at 29, yellow at 110, green at 142
  // and blue at 264, so royal blue, cobalt and navy all belong with "blue".
  if (C < 0.035) return "mono";
  if (H >= 12 && H < 38) return "red";
  if (H >= 38 && H < 70) return "orange";
  if (H >= 70 && H < 112) return "yellow";
  if (H >= 112 && H < 170) return "green";
  if (H >= 170 && H < 215) return "teal";
  if (H >= 215 && H < 278) return "blue";
  if (H >= 278 && H < 322) return "violet";
  return "pink";
}

export function grade({ ink, muted, accent, button }) {
  if (ink >= 7 && muted >= 4.5 && accent >= 4.5 && button >= 4.5) return "AAA";
  if (ink >= 4.5 && muted >= 4.5 && accent >= 4.5 && button >= 4.5) return "AA";
  if (ink >= 4.5 && muted >= 3 && accent >= 3 && button >= 3) return "AA large";
  return "Low";
}

// Contrast of each text role against the background and the surface.
export function contrastReport(t) {
  const r = (x) => Math.round(x * 10) / 10;
  const cr = {
    ink: r(Math.min(contrast(t.ink, t.bgHex), contrast(t.ink, t.surface))),
    muted: r(Math.min(contrast(t.muted, t.bgHex), contrast(t.muted, t.surface))),
    accent: r(Math.min(contrast(t.accent, t.bgHex), contrast(t.accent, t.surface))),
    button: r(contrast(t.accentInk, t.accent)),
  };
  return { cr, grade: grade(cr) };
}
