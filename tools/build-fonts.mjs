// Builds /data/fonts.json: every family on Google Fonts with the facts people
// filter by (category, style, weights, italics, variable axes, languages,
// designer, licence, date added) plus mood, theme and quality scores from the
// Google Fonts tag data.
//
// Sources
//   1. npm package google-font-metadata (the live Google Fonts API list)
//   2. A sparse clone of github.com/google/fonts (METADATA.pb files + tags/)
//      Fetch it once with:
//        git clone --depth 1 --filter=blob:none --no-checkout https://github.com/google/fonts .cache/google-fonts
//        cd .cache/google-fonts && git sparse-checkout init --no-cone
//        printf '/tags/\n/ofl/*/METADATA.pb\n/apache/*/METADATA.pb\n/ufl/*/METADATA.pb\n' > .git/info/sparse-checkout
//        git checkout
//      or point GF_REPO at an existing clone.
//
// Run: cd tools && npm install && node build-fonts.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const GF = process.env.GF_REPO || path.join(here, ".cache", "google-fonts");
const META = path.join(here, "node_modules", "google-font-metadata", "data");
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const v1 = readJSON(path.join(META, "google-fonts-v1.json"));
const variable = readJSON(path.join(META, "variable.json"));
const licenses = readJSON(path.join(META, "licenses.json"));
const featuredSrc = readJSON(path.join(here, "src", "featured.json")).families;
const curatedVoices = readJSON(path.join(here, "src", "curated-voices.json"));

/* ---------- METADATA.pb (textproto) ---------- */
function parsePb(txt) {
  const out = { subsets: [], classifications: [], axes: [] };
  let depth = 0, block = null, cur = null;
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.endsWith("{")) {
      depth++;
      if (depth === 1) { block = line.replace(/\s*\{$/, ""); cur = {}; }
      continue;
    }
    if (line === "}") {
      depth--;
      if (depth === 0) { if (block === "axes") out.axes.push(cur); block = null; cur = null; }
      continue;
    }
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith('"')) val = val.replace(/^"|"$/g, "").replace(/\\"/g, '"');
    else if (/^-?[\d.]+$/.test(val)) val = Number(val);
    if (depth === 0) {
      if (key === "subsets") out.subsets.push(val);
      else if (key === "classifications") out.classifications.push(val);
      else out[key] = val;
    } else if (depth === 1 && block === "axes") cur[key] = val;
  }
  return out;
}

const pbByName = new Map();
for (const lic of ["ofl", "apache", "ufl"]) {
  const dir = path.join(GF, lic);
  if (!fs.existsSync(dir)) continue;
  for (const fam of fs.readdirSync(dir)) {
    const p = path.join(dir, fam, "METADATA.pb");
    if (!fs.existsSync(p)) continue;
    const pb = parsePb(fs.readFileSync(p, "utf8"));
    if (pb.name) pbByName.set(pb.name, pb);
  }
}
if (!pbByName.size) {
  console.error(`No METADATA.pb files found under ${GF}. See the header of this file.`);
  process.exit(1);
}

/* ---------- tags/all/families.csv ---------- */
const tagRaw = new Map(); // family -> tag -> {fam, inst:[]}
for (const line of fs.readFileSync(path.join(GF, "tags", "all", "families.csv"), "utf8").split("\n")) {
  if (!line.trim()) continue;
  // Family names never contain commas; split from the right is safest anyway.
  const parts = line.split(",");
  const score = Number(parts.pop());
  const tag = parts.pop();
  const axis = parts.pop();
  const fam = parts.join(",");
  if (!tagRaw.has(fam)) tagRaw.set(fam, new Map());
  const t = tagRaw.get(fam);
  if (!t.has(tag)) t.set(tag, { fam: null, inst: [] });
  if (axis) t.get(tag).inst.push([axis, score]); else t.get(tag).fam = score;
}
// Variable fonts are tagged per instance (wght@100, wght@400, wght@900...).
// Most moods come from the design itself, so the average of the tagged
// instances is used. "Loud" mostly measures weight, so it uses the regular
// (400) instance only, otherwise every heavy variable font reads as loud.
function tagScores(fam) {
  const t = tagRaw.get(fam);
  const out = {};
  if (!t) return out;
  const has400 = [...t.values()].some((v) => v.inst.some(([ax]) => ax === "wght@400"));
  for (const [tag, v] of t) {
    let s;
    if (v.fam != null) s = v.fam;
    else if (tag === "/Expressive/Loud") {
      const r = v.inst.find(([ax]) => ax === "wght@400");
      s = r ? r[1] : has400 ? 0 : Math.min(...v.inst.map((x) => x[1]));
    } else s = v.inst.reduce((a, b) => a + b[1], 0) / v.inst.length;
    out[tag] = Math.round(s);
  }
  return out;
}

/* ---------- vocabularies ---------- */
const MOOD = {
  Active: "energetic", Artistic: "artistic", Awkward: "quirky", Business: "business", Calm: "calm",
  Childlike: "childlike", Competent: "competent", Cute: "cute", Excited: "excited", Fancy: "fancy",
  Futuristic: "futuristic", Happy: "happy", Innovative: "innovative", Loud: "loud", Playful: "playful",
  Rugged: "rugged", Sincere: "sincere", Sophisticated: "sophisticated", Stiff: "structured", Vintage: "vintage",
};
const STYLE = {
  "/Sans/Geometric": "Geometric sans", "/Sans/Humanist": "Humanist sans", "/Sans/Grotesque": "Grotesque",
  "/Sans/Neo Grotesque": "Neo-grotesque", "/Sans/Rounded": "Rounded sans", "/Sans/Superellipse": "Superellipse sans",
  "/Sans/Glyphic": "Glyphic sans", "/Serif/Transitional": "Transitional serif", "/Serif/Old Style Garalde": "Old style serif",
  "/Serif/Humanist Venetian": "Venetian serif", "/Serif/Modern": "Modern serif", "/Serif/Didone": "Didone",
  "/Serif/Fat Face": "Fat face", "/Serif/Scotch": "Scotch serif", "/Slab/Clarendon": "Clarendon slab",
  "/Slab/Geometric": "Geometric slab", "/Slab/Humanist": "Humanist slab", "/Script/Formal": "Formal script",
  "/Script/Handwritten": "Handwritten", "/Script/Informal": "Casual script", "/Script/Upright Script": "Upright script",
  "/Monospace/Monospace": "Monospace",
};
const CATEGORY = { "sans-serif": "sans", serif: "serif", display: "display", handwriting: "handwriting", monospace: "mono" };
const LICENCE = (type = "") =>
  /open font/i.test(type) ? "OFL" : /apache/i.test(type) ? "Apache 2.0" : /ubuntu/i.test(type) ? "UFL" : type || "OFL";

// Featured rank: the order of featured.json, then fonts used by curated voices.
const featured = new Map();
for (const n of featuredSrc) if (!featured.has(n)) featured.set(n, featured.size + 1);
for (const v of curatedVoices) for (const n of [v.display, v.body, v.ui]) if (!featured.has(n)) featured.set(n, featured.size + 1);

/* ---------- build ---------- */
// Icon sets are not text fonts. Utility fonts (barcodes, redaction, emoji,
// waveforms) stay in the catalogue but are flagged so they can be hidden.
const EXCLUDE = new Set(["Material Symbols", "Material Icons"]);
const SPECIAL = /^(Libre Barcode|Redacted|Flow |Linefont|Wavefont|Noto (Color )?Emoji|Adobe Blank)/;

const fonts = [];
const missingPb = [];
for (const [id, f] of Object.entries(v1)) {
  if (EXCLUDE.has(f.family)) continue;
  const pb = pbByName.get(f.family);
  if (!pb) missingPb.push(f.family);
  const tags = tagScores(f.family);

  const moods = Object.entries(tags)
    .filter(([t, s]) => t.startsWith("/Expressive/") && s >= 35)
    .map(([t, s]) => [MOOD[t.split("/")[2]], s])
    .filter(([m]) => m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let style = null, best = 29;
  for (const [t, s] of Object.entries(tags)) if (STYLE[t] && s > best) { best = s; style = STYLE[t]; }
  if (!style && f.category === "monospace") style = "Monospace";

  const themes = Object.entries(tags).filter(([t, s]) => t.startsWith("/Theme/") && s >= 50).map(([t]) => t.split("/")[2].toLowerCase());
  const seasons = Object.entries(tags).filter(([t, s]) => t.startsWith("/Seasonal/") && s >= 60).map(([t]) => t.split("/")[2]);
  const purposes = Object.entries(tags).filter(([t, s]) => t.startsWith("/Purpose/") && s >= 50).map(([t]) => t.split("/")[2].toLowerCase());
  const q = ["Concept", "Drawing", "Spacing", "Wordspace"].map((k) => tags["/Quality/" + k]).filter((x) => x != null);

  const axes = {};
  const va = variable[id]?.axes;
  if (va) for (const [tag, a] of Object.entries(va)) if (tag !== "ital") axes[tag] = [Number(a.min), Number(a.max)];

  const rec = {
    id,
    n: f.family,
    c: CATEGORY[f.category] || f.category,
    w: [...new Set(f.weights.map(Number))].sort((a, b) => a - b),
    sub: f.subsets.filter((s) => s !== "menu"),
  };
  if (style) rec.st = style;
  // Weights that have a true italic (used to request italics from Google Fonts).
  const itw = Object.entries(f.variants || {}).filter(([, v]) => v.italic).map(([w]) => Number(w)).sort((a, b) => a - b);
  if (itw.length) rec.it = itw;
  if (Object.keys(axes).length) rec.ax = axes;
  if (pb?.primary_script) rec.ps = pb.primary_script;
  if (pb?.designer) rec.ds = pb.designer;
  rec.lic = LICENCE(licenses[id]?.license?.type);
  if (pb?.date_added) rec.add = pb.date_added;
  if (moods.length) rec.m = Object.fromEntries(moods);
  if (themes.length) rec.th = themes;
  if (seasons.length) rec.se = seasons;
  if (purposes.length) rec.pu = purposes;
  if (q.length) rec.q = Math.round(q.reduce((a, b) => a + b, 0) / q.length);
  if (featured.has(f.family)) rec.f = featured.get(f.family);
  if (SPECIAL.test(f.family) || Object.entries(tags).some(([t, s]) => t.startsWith("/Special use/") && s >= 50)) rec.sp = 1;
  fonts.push(rec);
}
fonts.sort((a, b) => a.n.localeCompare(b.n));

const missingFeatured = [...featured.keys()].filter((n) => !fonts.some((f) => f.n === n));
const out = {
  v: 1,
  generated: new Date().toISOString().slice(0, 10),
  source: "Google Fonts (fonts.google.com) metadata and tags, github.com/google/fonts",
  count: fonts.length,
  fonts,
};
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "fonts.json"), JSON.stringify(out));

const by = (k) => fonts.reduce((m, f) => ((m[f[k]] = (m[f[k]] || 0) + 1), m), {});
console.log(`fonts: ${fonts.length}  featured: ${fonts.filter((f) => f.f).length}  variable: ${fonts.filter((f) => f.ax).length}`);
console.log("categories:", by("c"));
console.log(`special-use (hidden by default): ${fonts.filter((f) => f.sp).length}`);
console.log(`with style: ${fonts.filter((f) => f.st).length}  with moods: ${fonts.filter((f) => f.m).length}  with quality: ${fonts.filter((f) => f.q).length}`);
if (missingPb.length) console.log(`no METADATA.pb for ${missingPb.length}:`, missingPb.slice(0, 12).join(", "));
if (missingFeatured.length) console.log("featured names not found:", missingFeatured.join(", "));
console.log(`size: ${(fs.statSync(path.join(ROOT, "data", "fonts.json")).size / 1024).toFixed(0)} KB`);
