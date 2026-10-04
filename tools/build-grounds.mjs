// Builds /data/grounds.json: the curated grounds plus generated ones.
//
// Every ground uses the same 7 tokens the mixer exports:
//   bg (CSS, may be a gradient), bgHex, surface, ink, muted, accent, accentInk,
//   border, radius, dark
// Generated grounds are built in OKLCH: a paper (or dark base) and an accent
// are paired by hue harmony, then muted text and the accent are moved in
// lightness until they reach WCAG AA (4.5:1) on both the background and the
// surface. Every generated ground passes AA for body text, small text, links
// and button labels. Curated grounds keep their look; only muted text is
// nudged darker/lighter where it fell under 4.5:1.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oklch, hexToOklch, contrast, solveL, rgba, hueFamily, contrastReport } from "./lib/color.mjs";
import { idRegistry } from "./lib/ids.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const curated = JSON.parse(fs.readFileSync(path.join(here, "src", "curated-grounds.json"), "utf8"));

// Deterministic pseudo-random from a string, so rebuilds give the same data.
function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/* ---------- palette ingredients ---------- */
// Light papers: [name, hue, chroma, lightness, description]
const PAPERS = [
  ["Linen", 75, 0.012, 0.972, "linen paper"], ["Oat", 80, 0.02, 0.962, "oat paper"],
  ["Cream", 95, 0.032, 0.975, "cream paper"], ["Butter", 100, 0.05, 0.968, "butter-yellow paper"],
  ["Bone", 85, 0.007, 0.982, "bone white"], ["Chalk", 260, 0.002, 0.988, "chalk white"],
  ["Mist", 250, 0.009, 0.972, "cool mist"], ["Ice", 225, 0.018, 0.975, "ice-blue wash"],
  ["Sky", 240, 0.026, 0.968, "pale sky"], ["Sage", 145, 0.022, 0.962, "sage wash"],
  ["Mint", 170, 0.028, 0.968, "mint wash"], ["Rose", 12, 0.02, 0.968, "rose paper"],
  ["Blush", 350, 0.022, 0.97, "blush paper"], ["Peach", 50, 0.032, 0.968, "peach paper"],
  ["Lilac", 300, 0.022, 0.968, "lilac wash"], ["Sand", 72, 0.03, 0.952, "sand"],
  ["Stone", 90, 0.006, 0.952, "warm stone"], ["Clay", 48, 0.036, 0.94, "clay"],
];
// Light accents: [name, hue, chroma, description]
const ACCENTS_LIGHT = [
  ["Crimson", 22, 0.19, "crimson"], ["Brick", 35, 0.13, "brick red"],
  ["Copper", 52, 0.17, "copper"], ["Rust", 45, 0.13, "rust"], ["Ochre", 75, 0.12, "ochre"],
  ["Mustard", 92, 0.12, "mustard"], ["Olive", 115, 0.1, "olive"], ["Moss", 132, 0.1, "moss green"],
  ["Forest", 150, 0.11, "forest green"], ["Emerald", 162, 0.13, "emerald"], ["Teal", 185, 0.1, "teal"],
  ["Lagoon", 205, 0.11, "lagoon blue"], ["Azure", 245, 0.15, "azure"], ["Cobalt", 262, 0.19, "cobalt"],
  ["Navy", 262, 0.1, "navy"], ["Indigo", 278, 0.17, "indigo"], ["Violet", 298, 0.17, "violet"],
  ["Plum", 332, 0.13, "plum"], ["Magenta", 345, 0.19, "magenta"], ["Raspberry", 5, 0.18, "raspberry"],
  ["Cocoa", 55, 0.05, "cocoa brown"], ["Graphite", 260, 0.012, "graphite"], ["Ink", 0, 0, "black ink"],
];
// Dark bases: [name, hue, chroma, lightness, description]
const BASES = [
  ["Charcoal", 260, 0.006, 0.19, "charcoal"], ["Onyx", 0, 0, 0.155, "onyx black"],
  ["Navy", 262, 0.045, 0.205, "deep navy"], ["Midnight", 272, 0.05, 0.165, "midnight"],
  ["Forest", 150, 0.03, 0.195, "dark forest"], ["Pine", 172, 0.03, 0.205, "pine"],
  ["Espresso", 55, 0.02, 0.185, "espresso"], ["Wine", 355, 0.045, 0.205, "wine"],
  ["Plum", 322, 0.04, 0.195, "dark plum"], ["Slate", 240, 0.02, 0.235, "slate"],
  ["Abyss", 212, 0.04, 0.215, "deep sea"], ["Graphite", 90, 0.005, 0.215, "graphite"],
];
// Dark accents: [name, hue, chroma, description]
const ACCENTS_DARK = [
  ["Volt", 125, 0.2, "volt lime"], ["Mint", 165, 0.13, "mint"], ["Aqua", 195, 0.12, "aqua"],
  ["Ice", 218, 0.1, "ice blue"], ["Sky", 240, 0.13, "sky blue"], ["Periwinkle", 275, 0.13, "periwinkle"],
  ["Lavender", 300, 0.12, "lavender"], ["Pink", 350, 0.15, "hot pink"], ["Coral", 32, 0.15, "coral"],
  ["Amber", 70, 0.14, "amber"], ["Gold", 86, 0.12, "gold"], ["Sun", 100, 0.16, "sunflower"],
  ["Rose", 10, 0.1, "dusty rose"], ["Lime", 135, 0.18, "lime"],
];

/* ---------- harmony ---------- */
function harmony(baseHue, baseChroma, accHue, accChroma) {
  if (accChroma < 0.02) return 0.8;           // monochrome accents suit any paper
  if (baseChroma < 0.013) return 0.85;        // neutral paper suits any accent
  const d = hueDist(baseHue, accHue);
  if (d <= 45) return 0.95;                   // analogous
  if (d >= 150) return 0.88;                  // complementary
  if (d >= 115) return 0.62;                  // split complementary
  return 0.35;                                // the muddy middle
}
function pickAccents(base, accents, k) {
  const scored = accents.map((a) => ({ a, s: harmony(base[1], base[2], a[1], a[2]) + hash(base[0] + a[0]) * 0.18 }))
    .sort((x, y) => y.s - x.s);
  const chosen = [], families = new Map();
  for (const { a, s } of scored) {
    if (chosen.length >= k || s < 0.6) break;
    const fam = a[2] < 0.02 ? "mono" : Math.round(a[1] / 40);
    if ((families.get(fam) || 0) >= 2) continue; // spread across hues
    families.set(fam, (families.get(fam) || 0) + 1);
    chosen.push(a);
  }
  return chosen;
}

/* ---------- build one ground ---------- */
function makeGround(id, base, acc, dark) {
  const [bName, bH, bC, bL, bDesc] = base;
  const [aName, aH, aC, aDesc] = acc;
  const r = hash(id + bName + aName);
  const bgHex = oklch(bL, bC, bH);
  let surface;
  if (dark) surface = oklch(bL + 0.045, bC * 1.1, bH);
  else surface = bL > 0.978 ? oklch(bL - 0.022, bC * 1.4 + 0.003, bH) : oklch(Math.min(bL + 0.024, 0.997), bC * 0.45, bH);
  const ink = dark ? oklch(0.945, Math.min(0.012, bC * 0.5 + 0.004), bH) : oklch(0.205, Math.min(0.025, bC * 0.9 + 0.006), bH);
  const muted = dark
    ? solveL({ C: bC * 0.9 + 0.012, H: bH, against: [bgHex, surface], target: 4.75, startL: 0.66, dir: +1 }).hex
    : solveL({ C: bC * 1.1 + 0.012, H: bH, against: [bgHex, surface], target: 4.75, startL: 0.56, dir: -1 }).hex;
  const accent = dark
    ? solveL({ C: aC, H: aH, against: [bgHex, surface], target: 4.9, startL: 0.72, dir: +1 }).hex
    : solveL({ C: aC, H: aH, against: [bgHex, surface], target: 4.9, startL: aName === "Ink" ? 0.2 : aName === "Graphite" ? 0.36 : 0.62, dir: -1 }).hex;
  // Button label: whichever of a near-white or a deep tint of the accent reads better.
  const light = oklch(0.985, Math.min(0.015, aC * 0.15), aH);
  const deep = oklch(0.2, Math.min(0.06, aC * 0.45), aH);
  const accentInk = contrast(light, accent) >= contrast(deep, accent) ? light : deep;
  const sharp = !dark && ["Ink", "Graphite", "Navy", "Brick", "Crimson"].includes(aName) && r < 0.22;
  const border = sharp ? ink : dark ? oklch(bL + 0.085, bC * 1.2 + 0.004, bH) : oklch(bL - 0.075, bC * 1.25 + 0.004, bH);

  // Radius: playful hues get rounder corners, serious ones stay tight.
  const playful = ["Coral", "Copper", "Magenta", "Raspberry", "Violet", "Mustard", "Pink", "Lavender", "Sun", "Volt", "Lime"].includes(aName);
  const serious = ["Ink", "Graphite", "Navy", "Brick", "Cocoa", "Forest", "Olive", "Ochre"].includes(aName);
  const radius = sharp ? [0, 2][Math.floor(r * 2)]
    : playful ? [14, 16, 18, 20, 24][Math.floor(r * 5)]
    : serious ? [2, 4, 6, 8][Math.floor(r * 4)]
    : [8, 10, 12, 14][Math.floor(r * 4)];

  // Background treatment: solid, soft gradient, accent glow or a faint pattern.
  const solid = `linear-gradient(0deg, ${bgHex}, ${bgHex})`;
  let bg, treatment;
  const pick = hash("bg" + id);
  if (pick < 0.38) { bg = solid; treatment = "solid"; }
  else if (pick < 0.58) {
    bg = `linear-gradient(180deg, ${oklch(bL + (dark ? 0.012 : 0.008), bC, bH)} 0%, ${oklch(bL - (dark ? 0.01 : 0.014), bC * 1.15, bH)} 100%)`;
    treatment = "gradient";
  } else if (pick < 0.9) {
    const spots = ["82% -10%", "50% -12%", "12% 108%", "100% 0%", "0% 0%", "88% 100%", "50% 110%"];
    const at = spots[Math.floor(hash("at" + id) * spots.length)];
    bg = `radial-gradient(900px 500px at ${at}, ${rgba(accent, dark ? 0.12 : 0.1)}, transparent 60%), ${solid}`;
    treatment = "glow";
  } else {
    const line = rgba(ink, dark ? 0.07 : 0.06);
    bg = hash("pt" + id) < 0.5
      ? `linear-gradient(${line} 1px, transparent 1px) 0 0/100% 32px, linear-gradient(90deg, ${line} 1px, transparent 1px) 0 0/32px 100%, ${solid}`
      : `radial-gradient(${rgba(ink, dark ? 0.14 : 0.12)} 1px, transparent 1.6px) 0 0/22px 22px, ${solid}`;
    treatment = "pattern";
  }

  const t = { bg, bgHex, surface, ink, muted, accent, accentInk, border, radius, dark };
  return {
    id,
    name: `${bName} & ${aName}`,
    vibe: dark ? `${bDesc} base, ${aDesc} accent` : `${bDesc}, ${aDesc} accent`,
    treatment,
    tokens: t,
  };
}

/* ---------- tagging (moods, media, industries) ---------- */
function describe(g) {
  const t = g.tokens;
  const [bL, bC, bH] = hexToOklch(t.bgHex);
  const [, aC, aH] = hexToOklch(t.accent);
  const fam = hueFamily(t.accent);
  const warm = bC > 0.01 && (bH < 110 || bH > 330);
  const cool = bC > 0.008 && bH >= 180 && bH <= 300;
  const vivid = aC > 0.14;
  const mood = new Set();
  if (t.dark) mood.add("moody");
  if (vivid) mood.add("bold"); else if (aC < 0.09) mood.add("calm");
  if (warm) mood.add("warm");
  if (cool) mood.add("cool");
  if (aC < 0.03 || (bC < 0.006 && aC < 0.08)) mood.add("minimal");
  if (t.radius >= 16 && vivid) mood.add("playful");
  if ((t.dark && fam === "yellow") || (!t.dark && warm && ["red", "pink"].includes(fam) && t.radius <= 6 && aC < 0.15)) mood.add("luxurious");
  if ((t.dark && ["teal", "blue", "green"].includes(fam) && vivid) || (!t.dark && cool && fam === "blue" && t.radius <= 10)) mood.add("techy");
  // Neon limes and mints are not "natural", however green they are.
  if ((["green", "teal"].includes(fam) && aC < 0.15) || (fam === "orange" && aC < 0.08)) mood.add("natural");
  if (!t.dark && t.radius <= 6 && (["red", "blue", "mono"].includes(fam))) mood.add("editorial");
  if (!t.dark && bL > 0.96 && ["green", "teal", "blue"].includes(fam) && !warm) mood.add("fresh");

  const media = new Set(["web"]);
  if (t.radius >= 10 || t.dark) media.add("app");
  if ((t.radius <= 12 && aC < 0.16) || mood.has("techy")) media.add("tool");
  if ((!t.dark && t.radius <= 12 && !mood.has("playful")) || (t.dark && aC < 0.13)) media.add("edit");
  if (!t.dark ? bC < 0.03 && t.radius <= 12 : mood.has("techy") || aC < 0.12) media.add("docs");

  // Which kinds of business a color set suits. Each rule describes the color
  // worlds that business usually lives in; the kit builder then picks a spread
  // of them, so a rule should be generous rather than narrow.
  const ind = new Set();
  const m = (x) => mood.has(x);
  const is = (...fams) => fams.includes(fam);
  const light = !t.dark;
  const soft = aC < 0.14;          // an accent that does not shout
  const plainPaper = bC < 0.012;   // white, bone, chalk, mist, stone
  if (m("warm") && (is("red", "orange", "yellow") || m("natural"))) ind.add("restaurant");
  if (light && m("warm") && is("pink", "orange", "yellow", "red")) ind.add("bakery");
  if ((t.dark && is("red", "blue", "yellow", "mono")) || (m("editorial") && is("red", "mono", "blue"))) ind.add("barber");
  if ((light && is("pink", "violet") && aC < 0.185 && !m("playful"))
    || (light && soft && is("green", "teal", "orange", "yellow") && (m("calm") || m("natural") || m("warm")))
    || (t.dark && m("luxurious"))) ind.add("beauty");
  if (m("bold") && (t.dark || is("green", "orange", "red", "blue", "yellow"))) ind.add("fitness");
  if (light && is("blue", "teal", "green") && (m("fresh") || m("cool") || (soft && plainPaper))) ind.add("medical");
  if (((m("calm") || m("editorial") || m("minimal")) && is("blue", "green", "red", "mono", "teal") && t.radius <= 10)
    || (light && is("blue", "teal", "green") && aC < 0.16 && t.radius <= 12 && !m("playful"))
    || (t.dark && cool && is("blue", "teal", "yellow") && aC < 0.135)) ind.add("finance");
  if (((m("luxurious") || m("calm")) && is("blue", "green", "yellow", "mono", "teal", "orange") && t.radius <= 12)
    || (light && is("blue", "green", "teal") && aC < 0.15 && t.radius <= 12)) ind.add("realestate");
  if (is("orange", "yellow") || (is("blue", "mono") && t.radius <= 8) || (light && is("green") && soft && t.radius <= 8) || (is("red") && t.radius <= 6)) ind.add("trades");
  if (m("techy") || (is("blue", "violet", "teal") && (m("cool") || t.dark))
    || (light && plainPaper && is("blue", "violet", "teal", "green", "mono") && t.radius >= 6 && t.radius <= 14)) ind.add("tech");
  if (light && t.radius >= 10 && is("blue", "green", "orange", "yellow", "teal")) ind.add("education");
  if (light && (m("playful") || (vivid && t.radius >= 12))) ind.add("kids");   // bright accents, round corners
  if (light && aC < 0.16 && !m("playful")
    && (m("luxurious") || (m("warm") && is("pink", "yellow", "orange")) || is("pink") || (is("green") && aC < 0.125) || (is("violet") && aC < 0.13))) ind.add("wedding");
  if (m("minimal") || m("editorial") || (m("luxurious") && t.dark) || (light && is("pink", "orange", "red") && aC < 0.15 && t.radius <= 10)) ind.add("fashion");
  if (m("minimal") || (t.dark && aC < 0.12) || (light && plainPaper)) ind.add("art");   // gallery-white walls take any accent
  if (t.dark && (m("bold") || (is("violet", "blue", "pink", "teal") && aC > 0.105))) ind.add("nightlife");
  if (light && (m("fresh") || m("warm") || m("natural")) && is("teal", "blue", "orange", "yellow", "green")) ind.add("travel");
  if (light && (m("warm") || m("natural")) && is("green", "orange", "blue", "teal")) ind.add("community");
  if (light && (((m("fresh") || m("natural")) && is("green", "orange", "yellow", "teal")) || (m("warm") && is("red", "orange", "yellow")))) ind.add("grocery");
  if ((t.dark && is("red", "orange", "blue", "mono", "yellow"))
    || (light && is("red", "blue", "mono") && t.radius <= 8 && (plainPaper || cool))) ind.add("automotive");
  if (m("bold") || m("minimal")) ind.add("agency");
  if (m("editorial") || (light && t.radius <= 4) || (t.dark && aC < 0.11)) ind.add("publishing");
  if (t.dark && (m("bold") || (is("violet", "blue", "teal", "green") && aC > 0.105))) ind.add("gaming");
  if (m("minimal") || m("editorial") || m("calm") || (t.dark && soft) || (light && vivid && plainPaper)) ind.add("portfolio");

  return { hue: fam, mood: [...mood], media: [...media], ind: [...ind] };
}

/* ---------- assemble ---------- */
const grounds = [];
let muteFixes = 0;
for (const g of curated) {
  const t = { ...g.tokens };
  const fixes = [];
  // Nudge muted text to reach 4.5:1 without changing its hue or chroma.
  let rep = contrastReport(t);
  if (rep.cr.muted < 4.5) {
    const [, C, H] = hexToOklch(t.muted);
    t.muted = solveL({ C, H, against: [t.bgHex, t.surface], target: 4.55, startL: hexToOklch(t.muted)[0], dir: t.dark ? +1 : -1 }).hex;
    fixes.push("muted");
    muteFixes++;
  }
  const rec = { id: g.id, name: g.name, vibe: g.vibe, curated: 1, tokens: t };
  const d = describe(rec);
  rec.media = g.media; // curated media choices are kept as designed
  Object.assign(rec, { hue: d.hue, mood: d.mood, ind: d.ind });
  const r = contrastReport(t);
  rec.cr = r.cr; rec.grade = r.grade;
  if (fixes.length) rec.adjusted = fixes;
  grounds.push(rec);
}

const ids = idRegistry("grounds", "G", 100);
const recipes = []; // [base, accent, dark]
for (const p of PAPERS) for (const a of pickAccents(p, ACCENTS_LIGHT, p[2] < 0.013 ? 11 : 9)) recipes.push([p, a, false]);
for (const b of BASES) for (const a of pickAccents(b, ACCENTS_DARK, b[2] < 0.013 ? 10 : 8)) recipes.push([b, a, true]);
const failures = [];
for (const [b, a, dark] of recipes) {
  const key = `${dark ? "dark" : "light"}:${b[0]}:${a[0]}`;
  const g = makeGround(ids.peek(key), b, a, dark);
  const r = contrastReport(g.tokens);
  if (r.grade !== "AA" && r.grade !== "AAA") { failures.push(g.name + " " + JSON.stringify(r.cr)); continue; }
  g.id = ids.take(key);
  const d = describe(g);
  grounds.push({ id: g.id, name: g.name, vibe: g.vibe, tokens: g.tokens, media: d.media, hue: d.hue, mood: d.mood, ind: d.ind, cr: r.cr, grade: r.grade, treatment: g.treatment });
}

ids.save();
const out = { v: 1, generated: new Date().toISOString().slice(0, 10), count: grounds.length, grounds };
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "grounds.json"), JSON.stringify(out));

const tally = (k) => grounds.reduce((m, g) => { for (const v of [].concat(g[k])) m[v] = (m[v] || 0) + 1; return m; }, {});
console.log(`grounds: ${grounds.length} (curated ${curated.length}, generated ${grounds.length - curated.length}; light ${grounds.filter((g) => !g.tokens.dark).length}, dark ${grounds.filter((g) => g.tokens.dark).length})`);
console.log("grades:", tally("grade"), ` curated muted nudged: ${muteFixes}`);
console.log("hues:", tally("hue"));
console.log("moods:", tally("mood"));
console.log("media:", tally("media"));
console.log("industries:", tally("ind"));
if (failures.length) console.log(`dropped ${failures.length} that could not reach AA:`, failures.slice(0, 5));
console.log(`size: ${(fs.statSync(path.join(ROOT, "data", "grounds.json")).size / 1024).toFixed(0)} KB`);
