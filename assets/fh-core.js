/* ============================================================
   FontHabibi core: shared by the library and the mixer.
   - loads the data files in /data
   - turns a font record into a CSS font stack and a Google Fonts URL
   - loads fonts lazily, in small batches, only when they are needed
   - builds the CSS people copy into their projects
   ============================================================ */

// The version string makes browsers that cached an older copy fetch the new
// files. Cloudflare revalidates on every visit anyway, so it only needs a bump
// if a long cache header is ever added again.
const DATA_VERSION = "20261005g";
const cache = {};
export function loadData(name) {
  if (!cache[name]) {
    cache[name] = fetch(`/data/${name}.json?v=${DATA_VERSION}`).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
      return r.json();
    });
  }
  return cache[name];
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const fmt = (n) => Number(n).toLocaleString("en-AU");

/* ---------- fonts ---------- */
const FALLBACK = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "system-ui, sans-serif",
  handwriting: "cursive",
  mono: "ui-monospace, Menlo, Consolas, monospace",
};
export function cssStack(f, name) {
  const n = f ? f.n : name;
  return `'${n}', ${FALLBACK[f?.c] || FALLBACK.sans}`;
}

export function nearestWeight(f, want) {
  if (!f) return want;
  if (f.ax?.wght) return Math.min(Math.max(want, f.ax.wght[0]), f.ax.wght[1]);
  if (f.w.includes(want)) return want;
  return f.w.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), f.w[0]);
}

// One `family=` parameter for the Google Fonts CSS2 API.
export function familyParam(f, weights = [400], italic = false) {
  const ws = [...new Set(weights.map((w) => nearestWeight(f, w)))].sort((a, b) => a - b);
  const name = encodeURIComponent(f.n).replace(/%20/g, "+");
  const itw = italic && Array.isArray(f.it) ? ws.filter((w) => f.it.includes(w) || (f.ax?.wght && f.it.length > 1)) : [];
  if (itw.length) return `family=${name}:ital,wght@${ws.map((w) => "0," + w).join(";")};${itw.map((w) => "1," + w).join(";")}`;
  return `family=${name}:wght@${ws.join(";")}`;
}
export const gfURL = (params) => `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;

// Lazy loader. Requests are batched; if a batch fails (one bad family breaks
// the whole request), each family in it is retried on its own.
const loaded = new Set();
const queue = [];
let timer = null;
export function useFont(f, weights = [400]) {
  if (!f) return;
  const need = [...new Set(weights.map((w) => nearestWeight(f, w)))].filter((w) => !loaded.has(f.n + "@" + w));
  if (!need.length) return;
  need.forEach((w) => loaded.add(f.n + "@" + w));
  queue.push(familyParam(f, need));
  if (!timer) timer = setTimeout(flush, 40);
}
function addLink(params, retry) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = gfURL(params);
  if (retry && params.length > 1) link.onerror = () => { link.remove(); params.forEach((p) => addLink([p], false)); };
  document.head.appendChild(link);
}
function flush() {
  timer = null;
  while (queue.length) addLink(queue.splice(0, 12), true);
}

/* ---------- sample text per script ---------- */
const PS = {
  Deva: "devanagari", Arab: "arabic", Hebr: "hebrew", Thai: "thai", Beng: "bengali", Taml: "tamil", Telu: "telugu",
  Knda: "kannada", Mlym: "malayalam", Gujr: "gujarati", Guru: "gurmukhi", Sinh: "sinhala", Khmr: "khmer", Laoo: "lao",
  Mymr: "myanmar", Orya: "oriya", Tibt: "tibetan", Jpan: "japanese", Hira: "japanese", Kore: "korean",
  Hans: "chinese-simplified", Hant: "chinese-traditional", Ethi: "ethiopic", Geor: "georgian", Armn: "armenian",
  Cyrl: "cyrillic", Grek: "greek",
};
export const SAMPLES = {
  latin: "Fonts and colors that go together",
  cyrillic: "Выбери голос и фон.",
  greek: "Διάλεξε φωνή και φόντο.",
  devanagari: "नमस्ते संसार, सुन्दर अक्षर",
  arabic: "مرحبا بالعالم",
  hebrew: "שלום עולם",
  thai: "สวัสดีชาวโลก",
  bengali: "হ্যালো বিশ্ব",
  tamil: "வணக்கம் உலகம்",
  telugu: "హలో ప్రపంచం",
  kannada: "ನಮಸ್ಕಾರ ಜಗತ್ತು",
  malayalam: "ഹലോ ലോകം",
  gujarati: "નમસ્તે દુનિયા",
  gurmukhi: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਦੁਨੀਆ",
  sinhala: "ආයුබෝවන් ලෝකය",
  khmer: "សួស្តីពិភពលោក",
  lao: "ສະບາຍດີໂລກ",
  myanmar: "မင်္ဂလာပါ ကမ္ဘာ",
  oriya: "ନମସ୍କାର ଦୁନିଆ",
  tibetan: "བཀྲ་ཤིས་བདེ་ལེགས།",
  japanese: "こんにちは世界",
  korean: "안녕하세요 세계",
  "chinese-simplified": "你好，世界",
  "chinese-traditional": "你好，世界",
  "chinese-hongkong": "你好，世界",
  ethiopic: "ሰላም ዓለም",
  georgian: "გამარჯობა სამყარო",
  armenian: "Բարեւ աշխարհ",
};
export function scriptOf(f) {
  if (f.ps && f.ps !== "Latn" && PS[f.ps]) return PS[f.ps];
  if (!f.sub.includes("latin")) return f.sub.find((s) => SAMPLES[s]) || "latin";
  return "latin";
}
export const sampleFor = (f) => SAMPLES[scriptOf(f)] || SAMPLES.latin;
export const isRTL = (script) => script === "arabic" || script === "hebrew";

/* ---------- CSS exports ---------- */
// A plain background is stored as a one-color gradient (so every background
// has the same shape). In copied output it is written as the color itself.
const plainBg = (t) => t.bg.replace(/\s/g, "").toLowerCase() === `linear-gradient(0deg,${t.bgHex},${t.bgHex})`.toLowerCase();
const bgValue = (t) => (plainBg(t) ? t.bgHex : t.bg);
export function voiceFonts(v, idx) {
  return { D: idx.get(v.d), B: idx.get(v.b), U: idx.get(v.u) };
}
export function voiceImportURL(v, idx) {
  const { D, B, U } = voiceFonts(v, idx);
  // One entry per family, so a voice that uses one family twice asks for it once.
  const fams = new Map();
  const add = (f, ws, it) => {
    if (!f) return;
    const e = fams.get(f.n) || { f, ws: new Set(), it: false };
    ws.forEach((w) => e.ws.add(w));
    e.it = e.it || it;
    fams.set(f.n, e);
  };
  add(D, [v.dw || 700, 400], false);
  add(B, [400, 500, 600, 700], true);
  add(U, [400, 700], false);
  return gfURL([...fams.values()].map((e) => familyParam(e.f, [...e.ws], e.it)));
}
export function voiceCSS(v, idx) {
  const { D, B, U } = voiceFonts(v, idx);
  return `/* ${v.id} · ${v.name} (FontHabibi) */
@import url('${voiceImportURL(v, idx)}');

:root{
  --font-display: ${cssStack(D, v.d)};
  --font-display-weight: ${v.dw || 700};
  --font-body:    ${cssStack(B, v.b)};
  --font-ui:      ${cssStack(U, v.u)};
}
`;
}
export function groundCSS(g) {
  const t = g.tokens;
  return `/* ${g.id} · ${g.name}: ${g.vibe} (FontHabibi) */
:root{
  --bg: ${bgValue(t)};
  --bg-solid: ${t.bgHex};
  --surface: ${t.surface};
  --ink: ${t.ink};
  --ink-muted: ${t.muted};
  --accent: ${t.accent};
  --accent-ink: ${t.accentInk};
  --border: ${t.border};
  --radius: ${t.radius}px;
}
`;
}
export function comboCSS(v, g, mediumLabel, idx) {
  const { D, B, U } = voiceFonts(v, idx);
  const t = g.tokens;
  return `/* ${v.id} × ${g.id} · "${v.name} on ${g.name}"${mediumLabel ? " · " + mediumLabel.toLowerCase() : ""} (FontHabibi) */
@import url('${voiceImportURL(v, idx)}');

:root{
  /* fonts: ${v.d} (headings), ${v.b} (text), ${v.u} (labels and numbers) */
  --font-display: ${cssStack(D, v.d)};
  --font-display-weight: ${v.dw || 700};
  --font-body:    ${cssStack(B, v.b)};
  --font-ui:      ${cssStack(U, v.u)};

  /* colors: ${g.name}, ${g.vibe} */
  --bg: ${bgValue(t)};
  --bg-solid: ${t.bgHex};
  --surface: ${t.surface};
  --ink: ${t.ink};
  --ink-muted: ${t.muted};
  --accent: ${t.accent};
  --accent-ink: ${t.accentInk};
  --border: ${t.border};
  --radius: ${t.radius}px;
}

body{
  background: var(--bg);
  background-attachment: fixed;
  color: var(--ink);
  font-family: var(--font-body);
}
h1,h2,h3{ font-family: var(--font-display); font-weight: var(--font-display-weight); }
code, kbd, .numeric{ font-family: var(--font-ui); }
.card{ background: var(--surface); border:1px solid var(--border); border-radius: var(--radius); }
.btn{ background: var(--accent); color: var(--accent-ink); border-radius: var(--radius); font-family: var(--font-ui); font-weight:700; }
a{ color: var(--accent); }
`;
}

/* ---------- prompt for AI builders ----------
   Plain words first (what each font and color is for), then the import
   line and CSS variables, so any AI tool can use it as is. */
export function kitPrompt(v, g, idx, label) {
  const t = g.tokens;
  const { D, B, U } = voiceFonts(v, idx);
  const contrastNote = g.grade === "AA large"
    ? "Contrast: body text passes WCAG AA; use the accent color for large text and buttons only."
    : `Contrast: every text color passes WCAG ${g.grade === "AAA" ? "AAA for main text and AA" : "AA"} (4.5:1 or better).`;
  return `Design system for this project${label ? ` (${label})` : ""}, from FontHabibi.
Use only these fonts and colors for everything you build. Do not add other fonts or colors.

FONTS (Google Fonts, free for commercial use)
- Headings: ${v.d}, weight ${v.dw || 700}
- Body text: ${v.b}
- Labels, buttons, numbers and code: ${v.u}
Load them in <head>:
<link href="${voiceImportURL(v, idx)}" rel="stylesheet">

COLORS
- Page background: ${t.bgHex}${plainBg(t) ? "" : ` (full background: ${t.bg})`}
- Cards and panels: ${t.surface}
- Main text: ${t.ink}
- Secondary text: ${t.muted}
- Accent for buttons and links: ${t.accent}
- Text on accent buttons: ${t.accentInk}
- Borders and dividers: ${t.border}
- Corner radius: ${t.radius}px
- ${t.dark ? "This is a dark theme." : "This is a light theme."}
${contrastNote}

CSS VARIABLES
:root{
  --font-display: ${cssStack(D, v.d)};
  --font-display-weight: ${v.dw || 700};
  --font-body: ${cssStack(B, v.b)};
  --font-ui: ${cssStack(U, v.u)};
  --bg: ${bgValue(t)};
  --bg-solid: ${t.bgHex};
  --surface: ${t.surface};
  --ink: ${t.ink};
  --ink-muted: ${t.muted};
  --accent: ${t.accent};
  --accent-ink: ${t.accentInk};
  --border: ${t.border};
  --radius: ${t.radius}px;
}
`;
}

/* ---------- small utilities ---------- */
export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  legacyCopy(text);
  return Promise.resolve();
}
function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* nothing else to try */ }
  ta.remove();
}
export function download(name, text, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
export function flash(btn, label, ms = 1400) {
  if (!btn) return;
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  btn.textContent = label;
  btn.classList.add("ok");
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.textContent = old; btn.classList.remove("ok"); }, ms);
}

// localStorage can be missing or blocked (private windows), so every call is guarded.
export const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not available */ } },
};
