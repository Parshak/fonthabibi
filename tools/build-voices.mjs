// Builds /data/voices.json: font pairings ("voices") = display + body + UI/mono.
//
// The 74 curated voices are kept exactly as designed. Generated voices pair a
// display face with a body face using the catalogue's style and mood data:
//   - contrast in structure (serif display over sans body, script over sans...)
//   - superfamilies get a bonus (IBM Plex Serif + IBM Plex Sans)
//   - two different fonts of the same style are avoided (two neo-grotesques)
//   - the body should be calm and competent, the display carries the mood
//   - quality scores from Google Fonts tags break ties
// Every voice is tagged with moods, industries, media and supported languages.
//
// Run after build-fonts.mjs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const FONTS = readJSON(path.join(ROOT, "data", "fonts.json")).fonts;
const byName = new Map(FONTS.map((f) => [f.n, f]));
const curated = readJSON(path.join(here, "src", "curated-voices.json"));

function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
const pickFrom = (list, seed) => list[Math.floor(hash(seed) * list.length)];

/* ---------- font helpers ---------- */
const SANS = ["Geometric sans", "Humanist sans", "Grotesque", "Neo-grotesque", "Rounded sans", "Superellipse sans", "Glyphic sans"];
const SERIF_TEXT = ["Transitional serif", "Old style serif", "Venetian serif", "Scotch serif", "Modern serif"];
const SLAB = ["Clarendon slab", "Geometric slab", "Humanist slab"];
const SCRIPT = ["Formal script", "Handwritten", "Casual script", "Upright script"];
const CONDENSED = /Condensed|Narrow|Compressed|Anton|Bebas|Oswald|Teko|Fjalla|Big Shoulders|League Gothic|Antonio|Pathway Gothic|Six Caps|Smooch Sans|Sofia Sans Extra Condensed/;

function kind(f) {
  const st = f.st || "";
  if (SCRIPT.includes(st) || f.c === "handwriting") return "script";
  if (SLAB.includes(st)) return "slab";
  if (st === "Didone" || st === "Fat face") return "serif-display";
  if (st === "Monospace" || f.c === "mono") return "mono";
  if (SERIF_TEXT.includes(st) || f.c === "serif") return "serif";
  if (SANS.includes(st) || f.c === "sans") return "sans";
  return "display";
}
const mood = (f, k) => (f.m && f.m[k]) || 0;
const topMoods = (f, n = 3, min = 40) => Object.entries(f.m || {}).filter(([, s]) => s >= min).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
const hasWeight = (f, w) => f.w.includes(w) || (f.ax?.wght && w >= f.ax.wght[0] && w <= f.ax.wght[1]);
const condensed = (f) => CONDENSED.test(f.n);
const shared = (a, b) => a.sub.filter((s) => b.sub.includes(s));
// Superfamily: same name once the generic words are removed.
const root = (n) => n.replace(/\b(Serif|Sans|Slab|Mono|Display|Text|Pro|Code|Condensed|SC|Round(ed)?|[0-9]+)\b/g, "").replace(/\s+/g, " ").trim();
const superfamily = (a, b) => root(a.n) && root(a.n) === root(b.n) && a.n !== b.n;

function displayWeight(f) {
  const k = kind(f);
  const prefer = k === "script" ? [400, 600, 700]
    : k === "serif-display" || f.st === "Old style serif" || f.st === "Transitional serif" || f.st === "Venetian serif" ? [600, 700, 500, 400]
    : [700, 800, 600, 900, 500, 400];
  for (const p of prefer) if (hasWeight(f, p)) return p;
  return f.w[f.w.length - 1];
}

const LABEL = (f) => {
  const k = kind(f);
  if (f.st && f.st !== "Monospace") return f.st.toLowerCase().replace("old style", "old-style");
  return { script: "script", display: "display face", mono: "mono", sans: "sans", serif: "serif" }[k] || "type";
};
const BODY_ADJ = (b) => {
  const best = ["calm", "competent", "business", "sincere"].map((k) => [k, mood(b, k)]).sort((x, y) => y[1] - x[1])[0][0];
  return { calm: "calm", competent: "clean", business: "crisp", sincere: "warm" }[best];
};
function vibe(d, b) {
  const m = topMoods(d, 1)[0];
  if (d.n === b.n) return `${m ? m + " " : ""}${LABEL(d)}, one family throughout`;
  return `${m ? m + " " : ""}${LABEL(d)} over a ${BODY_ADJ(b)} ${LABEL(b)}`;
}

/* ---------- candidates ---------- */
// Latin pairings only use fonts whose main script is Latin (CJK and Arabic
// families carry Latin too, but are heavy and look wrong as Latin body text).
const latin = FONTS.filter((f) => !f.sp && f.sub.includes("latin") && (!f.ps || f.ps === "Latn"));
const bodyOK = (f) =>
  ["sans", "serif"].includes(kind(f)) && hasWeight(f, 400) && (f.w.length >= 3 || f.ax?.wght) && (f.q || 0) >= 72 &&
  mood(f, "loud") < 70 && !condensed(f) && !(f.th || []).length && !["Glyphic sans", "Modern serif"].includes(f.st) &&
  mood(f, "childlike") < 60;
const bodyScore = (f) =>
  (f.q || 70) / 100 + ((mood(f, "calm") + mood(f, "competent") + mood(f, "business") + mood(f, "sincere")) / 400) * 0.6 +
  (f.w.length >= 5 || f.ax?.wght ? 0.1 : 0) + (f.it ? 0.08 : 0) + (f.f ? 0.3 : 0) + ((f.pu || []).includes("easy reading") ? 0.1 : 0);

let bodies = latin.filter(bodyOK).sort((a, b) => bodyScore(b) - bodyScore(a));
const bodySans = bodies.filter((f) => kind(f) === "sans").slice(0, 95);
const bodySerif = bodies.filter((f) => kind(f) === "serif").slice(0, 50);
bodies = [...bodySans, ...bodySerif];

// "Guides" variants draw handwriting guide lines, so they are not display faces.
const displayOK = (f) => (f.q || 0) >= 68 && kind(f) !== "mono" && !/Guides$/.test(f.n);
const displayScore = (f) => (f.q || 70) / 100 + (f.f ? 0.45 : 0) + (Math.max(0, ...Object.values(f.m || { x: 0 })) / 100) * 0.3 + (f.st ? 0.05 : 0);
const buckets = new Map();
for (const f of latin.filter(displayOK)) {
  const key = kind(f) + ":" + (f.st || (f.th || [])[0] || topMoods(f, 1)[0] || "other");
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(f);
}
let displays = [];
for (const [, list] of buckets) {
  list.sort((a, b) => displayScore(b) - displayScore(a));
  const cap = Math.max(5, Math.round(list.length * 0.4));
  displays.push(...list.slice(0, cap));
}
displays.sort((a, b) => displayScore(b) - displayScore(a));
// Big novelty families (Playwrite, Rubik's effect fonts, Bitcount...) would
// flood the list, so at most 3 display faces per family name.
const perRoot = new Map();
displays = displays.filter((f) => {
  const r = f.n.split(" ")[0];
  const c = perRoot.get(r) || 0;
  if (c >= 3) return false;
  perRoot.set(r, c + 1);
  return true;
}).slice(0, 560);

/* ---------- pairing score ---------- */
function pairScore(D, B) {
  const kd = kind(D), kb = kind(B);
  const sf = superfamily(D, B);
  let s = sf ? 0.45 : 0;
  if (kd === "serif" && kb === "sans") s += 0.3;
  else if (kd === "serif-display" && kb === "sans") s += 0.32;
  else if (kd === "serif-display" && kb === "serif") s += ["Old style serif", "Transitional serif", "Venetian serif"].includes(B.st) ? 0.12 : -0.1;
  else if (kd === "sans" && kb === "serif") s += 0.18;
  else if (kd === "sans" && kb === "sans") s += D.st && B.st && D.st === B.st && !sf ? -0.35 : 0.12;
  else if (kd === "serif" && kb === "serif") s += sf ? 0.1 : -0.3;
  else if (kd === "slab" && kb === "sans") s += 0.25;
  else if (kd === "slab" && kb === "serif") s -= 0.15;
  else if (kd === "script" && kb === "sans") s += 0.28;
  else if (kd === "script" && kb === "serif") s += 0.1;
  else if (kd === "display") s += kb === "sans" ? 0.2 : 0.06;

  const dm = topMoods(D, 4, 35);
  const any = (...k) => k.some((x) => dm.includes(x));
  if (any("childlike", "cute", "playful")) s += (["Rounded sans", "Geometric sans"].includes(B.st) ? 0.15 : 0) - (kb === "serif" ? 0.15 : 0);
  if (any("sophisticated", "fancy")) s += ["Geometric sans", "Neo-grotesque", "Old style serif", "Transitional serif"].includes(B.st) ? 0.1 : 0;
  if (any("vintage")) s += (["Humanist sans", "Old style serif", "Grotesque", "Transitional serif"].includes(B.st) ? 0.1 : 0) - (B.st === "Geometric sans" ? 0.05 : 0);
  if (any("futuristic", "innovative")) s += (["Neo-grotesque", "Geometric sans", "Superellipse sans"].includes(B.st) ? 0.12 : 0) - (kb === "serif" ? 0.15 : 0);
  if (any("rugged", "loud")) s += ["Grotesque", "Neo-grotesque", "Humanist sans"].includes(B.st) ? 0.08 : 0;
  s += ((mood(B, "calm") + mood(B, "competent") + mood(B, "business")) / 300) * 0.25;
  s -= (mood(B, "loud") / 100) * 0.15;
  s += (((D.q || 70) + (B.q || 70)) / 200) * 0.4;
  s += (D.f ? 0.06 : 0) + (B.f ? 0.1 : 0);
  s += shared(D, B).filter((x) => ["cyrillic", "greek", "vietnamese"].includes(x)).length * 0.02;
  return s;
}

function pickMono(D, B) {
  const dm = topMoods(D, 3, 35), st = D.st || "", k = kind(D), seed = D.n + B.n;
  if (dm.includes("futuristic") || st.includes("Geometric") || st === "Superellipse sans" || st === "Glyphic sans")
    return pickFrom(["JetBrains Mono", "Space Mono", "DM Mono", "Azeret Mono", "Geist Mono"], seed);
  if (k === "serif" || k === "serif-display") return pickFrom(["IBM Plex Mono", "Source Code Pro", "Courier Prime", "Fira Code"], seed);
  if (k === "slab") return pickFrom(["Courier Prime", "IBM Plex Mono", "Roboto Mono"], seed);
  if (k === "script" || dm.includes("playful") || dm.includes("cute") || st === "Rounded sans") return pickFrom(["DM Mono", "Space Mono", "Red Hat Mono"], seed);
  return pickFrom(["JetBrains Mono", "IBM Plex Mono", "Fira Code", "Roboto Mono", "Spline Sans Mono"], seed);
}

/* ---------- tags ---------- */
function mediaFor(D, B) {
  const kd = kind(D), kb = kind(B);
  const media = new Set(["web"]);
  if (kb === "sans" && kd !== "serif-display" && kd !== "script") media.add("app");
  if (kd === "sans" && kb === "sans" && !condensed(D) && (mood(D, "competent") + mood(D, "business") >= 80 || ["Neo-grotesque", "Grotesque", "Humanist sans", "Superellipse sans"].includes(D.st))) media.add("tool");
  if (kb === "serif" || kd === "serif" || kd === "serif-display" || (kd === "script" && kb === "serif")) media.add("edit");
  const readableBody = (kb === "sans" && ["Humanist sans", "Neo-grotesque", "Grotesque", "Geometric sans"].includes(B.st)) ||
    (kb === "serif" && ["Transitional serif", "Old style serif", "Venetian serif"].includes(B.st));
  if (readableBody && kd !== "script" && kd !== "display" && mood(D, "loud") < 60 && !condensed(D)) media.add("docs");
  return [...media];
}

const IND = {
  restaurant: (D, m, k) => (m.vintage + m.happy + m.sincere) / 150 + (["Casual script", "Handwritten", "Humanist slab", "Clarendon slab", "Old style serif", "Fat face"].includes(D.st) ? 0.4 : 0),
  bakery: (D, m, k) => (m.cute + m.happy + m.childlike + m.playful) / 160 + (["Casual script", "Handwritten", "Rounded sans", "Upright script"].includes(D.st) ? 0.35 : 0),
  barber: (D, m, k) => (m.vintage + m.rugged) / 120 + (["Clarendon slab", "Fat face"].includes(D.st) || condensed(D) || (D.th || []).some((t) => ["blackletter", "woodtype", "tuscan"].includes(t)) ? 0.4 : 0),
  beauty: (D, m, k) => (m.sophisticated + m.fancy + m.calm) / 150 + (["Didone", "Modern serif", "Formal script"].includes(D.st) ? 0.45 : 0),
  fitness: (D, m, k) => (m.energetic + m.loud + m.excited + m.rugged) / 180 + (condensed(D) ? 0.45 : 0) + ((D.th || []).includes("techno") ? 0.2 : 0),
  medical: (D, m, k) => (m.calm + m.competent + m.sincere) / 160 + (["Humanist sans", "Rounded sans", "Geometric sans"].includes(D.st) ? 0.25 : 0) - (k === "script" ? 1 : 0),
  finance: (D, m, k) => (m.business + m.competent + m.structured) / 160 + (["Transitional serif", "Scotch serif", "Modern serif", "Neo-grotesque", "Grotesque"].includes(D.st) ? 0.3 : 0) - (k === "script" ? 1 : 0),
  realestate: (D, m, k) => (m.sophisticated + m.business + m.calm) / 160 + (["Didone", "Transitional serif", "Modern serif", "Geometric sans"].includes(D.st) ? 0.3 : 0),
  trades: (D, m, k) => (m.rugged + m.structured + m.loud) / 160 + (k === "slab" || condensed(D) || D.st === "Grotesque" || (D.th || []).includes("stencil") ? 0.4 : 0),
  tech: (D, m, k) => (m.futuristic + m.innovative + m.competent) / 160 + (["Geometric sans", "Neo-grotesque", "Superellipse sans", "Glyphic sans"].includes(D.st) ? 0.3 : 0) + ((D.th || []).includes("techno") ? 0.3 : 0),
  education: (D, m, k) => (m.sincere + m.happy + m.calm) / 160 + ((D.pu || []).length ? 0.4 : 0) + (["Rounded sans", "Humanist sans"].includes(D.st) ? 0.2 : 0),
  kids: (D, m, k) => (m.childlike + m.cute + m.playful) / 120 + (["Rounded sans", "Handwritten", "Casual script"].includes(D.st) || (D.th || []).includes("blobby") ? 0.3 : 0),
  wedding: (D, m, k) => (m.fancy + m.sophisticated) / 100 + (["Formal script", "Didone", "Upright script", "Modern serif"].includes(D.st) ? 0.45 : 0),
  fashion: (D, m, k) => (m.sophisticated + m.fancy + m.artistic) / 150 + (["Didone", "Modern serif"].includes(D.st) || (D.th || []).includes("art deco") ? 0.45 : 0),
  art: (D, m, k) => (m.artistic + m.innovative + m.quirky) / 130 + (k === "display" || ["Glyphic sans"].includes(D.st) || (D.th || []).some((t) => ["art deco", "art nouveau", "inline"].includes(t)) ? 0.3 : 0),
  nightlife: (D, m, k) => (m.loud + m.excited + m.futuristic + m.quirky) / 180 + ((D.th || []).some((t) => ["techno", "inline", "shaded", "pixel", "wacky"].includes(t)) ? 0.4 : 0),
  travel: (D, m, k) => (m.happy + m.calm + m.sincere + m.vintage) / 200 + (["Casual script", "Humanist sans", "Geometric sans"].includes(D.st) ? 0.2 : 0),
  community: (D, m, k) => (m.sincere + m.happy + m.calm) / 150 + (["Humanist sans", "Rounded sans", "Old style serif"].includes(D.st) ? 0.25 : 0),
  grocery: (D, m, k) => (m.happy + m.sincere + m.vintage) / 160 + (["Humanist slab", "Clarendon slab", "Rounded sans", "Casual script"].includes(D.st) ? 0.35 : 0),
  automotive: (D, m, k) => (m.energetic + m.futuristic + m.loud) / 160 + (condensed(D) || (D.th || []).includes("techno") || D.st === "Glyphic sans" ? 0.4 : 0),
  agency: (D, m, k) => (m.innovative + m.artistic + m.competent) / 160 + (["Grotesque", "Neo-grotesque", "Geometric sans"].includes(D.st) || k === "display" ? 0.2 : 0),
  publishing: (D, m, k) => (m.competent + m.business + m.vintage) / 160 + (["Transitional serif", "Old style serif", "Scotch serif", "Modern serif", "Venetian serif"].includes(D.st) ? 0.35 : 0) + (condensed(D) ? 0.15 : 0),
  gaming: (D, m, k) => (m.futuristic + m.loud + m.quirky + m.excited) / 180 + ((D.th || []).some((t) => ["pixel", "techno", "wacky"].includes(t)) ? 0.5 : 0),
  portfolio: (D, m, k) => (m.innovative + m.artistic + m.sincere + m.competent) / 200 + (k !== "script" && (D.q || 0) >= 75 ? 0.2 : 0),
};
const MOODS = ["energetic", "artistic", "quirky", "business", "calm", "childlike", "competent", "cute", "excited", "fancy", "futuristic", "happy", "innovative", "loud", "playful", "rugged", "sincere", "sophisticated", "structured", "vintage"];
function industries(D) {
  const m = Object.fromEntries(MOODS.map((k) => [k, mood(D, k)]));
  const k = kind(D);
  const scored = Object.entries(IND).map(([id, fn]) => [id, fn(D, m, k)]).sort((a, b) => b[1] - a[1]);
  const picked = scored.filter(([, s]) => s >= 0.55).slice(0, 5).map(([id]) => id);
  return picked.length ? picked : scored.filter(([, s]) => s >= 0.3).slice(0, 2).map(([id]) => id);
}
const LANG_TAGS = ["cyrillic", "greek", "vietnamese"];
const langs = (fonts) => {
  const all = fonts.filter(Boolean);
  return LANG_TAGS.filter((l) => all.every((f) => f.sub.includes(l)));
};

function makeVoice(id, D, B, extra = {}) {
  const U = byName.get(extra.ui || pickMono(D, B));
  const moodTags = topMoods(D, 3, 40);
  if (moodTags.length < 2) for (const k of ["calm", "competent", "sincere"]) if (!moodTags.includes(k) && mood(B, k) >= 55 && moodTags.length < 2) moodTags.push(k);
  return {
    id,
    name: extra.name || (D.n === B.n ? `${D.n} solo` : `${D.n} + ${B.n}`),
    vibe: extra.vibe || vibe(D, B),
    d: D.n, b: B.n, u: U ? U.n : B.n,
    dw: displayWeight(D),
    media: extra.media || mediaFor(D, B),
    mood: moodTags,
    ind: industries(D),
    lang: extra.lang || langs([D, B]),
    ...(extra.score != null ? { score: extra.score } : {}),
  };
}

/* ---------- curated ---------- */
const voices = [];
for (const v of curated) {
  const D = byName.get(v.display), B = byName.get(v.body), U = byName.get(v.ui);
  if (!D || !B || !U) { console.warn("curated font missing", v.id); continue; }
  const rec = makeVoice(v.id, D, B, { name: v.name, vibe: v.vibe, media: v.media, ui: v.ui });
  rec.dw = v.displayWeight;
  rec.curated = 1;
  voices.push(rec);
}
const seen = new Set(voices.map((v) => v.d + "|" + v.b));

/* ---------- generated Latin pairings ---------- */
const generated = [];
const bodyUse = new Map();
const BODY_CAP = 26;
for (const D of displays) {
  const ranked = bodies.filter((B) => B.n !== D.n).map((B) => [B, pairScore(D, B)]).sort((a, b) => b[1] - a[1]);
  const styles = new Set();
  let taken = 0;
  for (const [B, s] of ranked) {
    if (taken >= 3 || s < 0.78) break;
    if (seen.has(D.n + "|" + B.n)) continue;
    if ((bodyUse.get(B.n) || 0) >= BODY_CAP) continue;
    if (styles.has(B.st)) continue; // three different kinds of body per display
    styles.add(B.st);
    bodyUse.set(B.n, (bodyUse.get(B.n) || 0) + 1);
    seen.add(D.n + "|" + B.n);
    generated.push([D, B, s]);
    taken++;
  }
}
// One-family voices for versatile families.
const solos = latin
  .filter((f) => ["sans", "serif"].includes(kind(f)) && (f.w.length >= 6 || (f.ax?.wght && f.ax.wght[1] - f.ax.wght[0] >= 400)) && (f.q || 0) >= 76 && !condensed(f))
  .sort((a, b) => bodyScore(b) - bodyScore(a))
  .slice(0, 90)
  .filter((f) => !seen.has(f.n + "|" + f.n));
for (const f of solos) { seen.add(f.n + "|" + f.n); generated.push([f, f, 1]); }

/* ---------- generated non-Latin pairings ---------- */
const SCRIPTS = ["devanagari", "arabic", "hebrew", "thai", "bengali", "tamil", "telugu", "kannada", "malayalam", "gujarati", "gurmukhi", "sinhala", "khmer", "japanese", "korean", "chinese-simplified", "chinese-traditional", "ethiopic", "georgian", "armenian", "lao", "myanmar", "oriya", "tibetan"];
const scriptVoices = [];
for (const s of SCRIPTS) {
  const pool = FONTS.filter((f) => !f.sp && f.sub.includes(s) && (f.q || 70) >= 60 && kind(f) !== "mono" && !/Guides$/.test(f.n));
  const bodyPool = pool.filter((f) => ["sans", "serif"].includes(kind(f)) && hasWeight(f, 400) && f.w.length >= 2)
    .sort((a, b) => bodyScore(b) - bodyScore(a)).slice(0, 4);
  if (!bodyPool.length) continue;
  const dispPool = pool.sort((a, b) => displayScore(b) + (kind(b) !== "sans" ? 0.2 : 0) - (displayScore(a) + (kind(a) !== "sans" ? 0.2 : 0))).slice(0, 14);
  let count = 0;
  for (const D of dispPool) {
    for (const B of bodyPool) {
      if (count >= 24) break;
      if (D.n === B.n || seen.has(D.n + "|" + B.n)) continue;
      if (kind(D) === kind(B) && D.st && D.st === B.st) continue;
      seen.add(D.n + "|" + B.n);
      scriptVoices.push([D, B, s]);
      count++;
      break; // one body per display keeps the list varied
    }
  }
  for (const B of bodyPool.slice(0, 2)) if (!seen.has(B.n + "|" + B.n)) { seen.add(B.n + "|" + B.n); scriptVoices.push([B, B, s]); }
}

/* ---------- assemble with stable ids ---------- */
generated.sort((a, b) => (a[0].n + a[1].n).localeCompare(b[0].n + b[1].n));
let n = 100;
for (const [D, B, s] of generated) voices.push(makeVoice("F" + n++, D, B, { score: Math.round(Math.min(1, s / 1.6) * 100) }));
scriptVoices.sort((a, b) => (a[2] + a[0].n + a[1].n).localeCompare(b[2] + b[0].n + b[1].n));
for (const [D, B, s] of scriptVoices) {
  const media = ["web", "app"];
  if (kind(B) === "serif" || kind(D) === "serif") media.push("edit");
  if (kind(B) === "sans") media.push("docs");
  voices.push(makeVoice("F" + n++, D, B, { lang: [s], ui: B.n, media }));
}

const out = { v: 1, generated: new Date().toISOString().slice(0, 10), count: voices.length, voices };
fs.writeFileSync(path.join(ROOT, "data", "voices.json"), JSON.stringify(out));

const tally = (k) => voices.reduce((m, v) => { for (const x of [].concat(v[k])) m[x] = (m[x] || 0) + 1; return m; }, {});
console.log(`voices: ${voices.length} (curated ${curated.length}, latin pairs ${generated.length - solos.length}, solos ${solos.length}, other scripts ${scriptVoices.length})`);
console.log(`display candidates ${displays.length}, body candidates ${bodies.length} (sans ${bodySans.length}, serif ${bodySerif.length})`);
console.log("media:", tally("media"));
console.log("industries:", tally("ind"));
console.log("moods:", tally("mood"));
console.log("languages:", tally("lang"));
const topBodies = [...bodyUse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log("most used bodies:", topBodies.map(([n, c]) => `${n} ${c}`).join(", "));
console.log(`size: ${(fs.statSync(path.join(ROOT, "data", "voices.json")).size / 1024).toFixed(0)} KB`);
