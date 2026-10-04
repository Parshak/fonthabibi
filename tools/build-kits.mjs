// Builds /data/kits.json: ready-made kits = one font pairing (voice) on one
// color set (ground), picked for an industry. This is what most visitors
// want: "show me something good for a cafe website", not raw parts.
//
// For each industry, voices and grounds tagged with that industry are paired
// when their moods agree (vintage type on warm paper, futuristic type on a
// techy dark ground...). Each voice and each ground is used once per
// industry, so every list is varied. Run after the other builders.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { idRegistry } from "./lib/ids.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const { voices } = read("voices.json");
const { grounds } = read("grounds.json");
const { fonts } = read("fonts.json");
const fontIdx = new Map(fonts.map((f) => [f.n, f]));
// Kits are shown with English copy, so they only use pairings made for Latin
// text. Pairings built for another script (Arabic, Thai, Chinese...) stay in
// the Font pairings tab, behind the Language filter.
const LATIN_LIKE = new Set(["cyrillic", "greek", "vietnamese"]);
const latinOK = (v) => [v.d, v.b, v.u].every((n) => fontIdx.get(n)?.sub.includes("latin")) && (v.lang || []).every((l) => LATIN_LIKE.has(l));

const PER_INDUSTRY = 24;
const INDUSTRIES = ["restaurant", "bakery", "grocery", "barber", "beauty", "fitness", "medical", "finance", "realestate", "trades",
  "automotive", "tech", "education", "kids", "wedding", "fashion", "art", "nightlife", "travel", "community", "agency",
  "publishing", "gaming", "portfolio"];

// Which ground moods suit each voice mood.
const FIT = {
  vintage: ["warm", "natural", "editorial", "luxurious"], sincere: ["warm", "calm", "natural"],
  happy: ["warm", "playful", "fresh", "bold"], calm: ["calm", "minimal", "fresh", "cool"],
  competent: ["calm", "minimal", "cool", "editorial", "techy"], business: ["calm", "cool", "minimal", "editorial", "luxurious"],
  structured: ["minimal", "editorial", "cool"], futuristic: ["techy", "moody", "cool", "bold"],
  innovative: ["techy", "bold", "minimal"], loud: ["bold", "moody"], energetic: ["bold", "moody", "playful"],
  excited: ["bold", "playful"], rugged: ["moody", "bold", "warm"], playful: ["playful", "bold", "fresh"],
  childlike: ["playful", "fresh", "bold"], cute: ["playful", "warm", "fresh"], fancy: ["luxurious", "calm", "moody"],
  sophisticated: ["luxurious", "minimal", "calm", "moody"], artistic: ["bold", "minimal", "moody", "editorial"],
  quirky: ["playful", "bold"],
};
// Light or dark leanings per industry.
const TONE = {
  nightlife: "dark", gaming: "dark",
  medical: "light", education: "light", kids: "light", bakery: "light", wedding: "light", grocery: "light", community: "light",
};

function score(v, g, ind) {
  let s = v.curated ? 0.35 : ((v.score || 50) / 100) * 0.3;
  s += g.curated ? 0.25 : 0.15;
  s += g.grade === "AAA" ? 0.1 : g.grade === "AA" ? 0.05 : -0.25;
  for (const m of v.mood) for (const gm of FIT[m] || []) if (g.mood.includes(gm)) s += 0.08;
  s += v.media.filter((m) => g.media.includes(m)).length * 0.02;
  const tone = TONE[ind];
  if (tone === "dark") s += g.tokens.dark ? 0.2 : -0.1;
  if (tone === "light") s += g.tokens.dark ? -0.4 : 0.1;
  return s;
}

const ids = idRegistry("kits", "K", 1);
const byPair = new Map();
for (const ind of INDUSTRIES) {
  const vs = voices.filter((v) => v.ind.includes(ind) && latinOK(v));
  const gs = grounds.filter((g) => g.ind.includes(ind));
  const pairs = [];
  for (const v of vs) for (const g of gs) {
    if (!v.media.some((m) => g.media.includes(m))) continue;
    pairs.push([v, g, score(v, g, ind)]);
  }
  pairs.sort((a, b) => b[2] - a[2]);
  const usedV = new Set(), usedG = new Set();
  let n = 0;
  for (const [v, g, s] of pairs) {
    if (n >= PER_INDUSTRY) break;
    if (usedV.has(v.id) || usedG.has(g.id)) continue;
    usedV.add(v.id); usedG.add(g.id); n++;
    const key = `${v.id}|${g.id}`;
    if (byPair.has(key)) { byPair.get(key).ind.push(ind); continue; }
    byPair.set(key, {
      id: ids.take(key),
      v: v.id,
      g: g.id,
      ind: [ind],
      media: v.media.filter((m) => g.media.includes(m)),
      score: Math.round(s * 100),
    });
  }
}

// The six kits the home page wears, as staff picks.
const PICKS = [["F01", "G01"], ["F02", "G02"], ["F05", "G05"], ["F08", "G08"], ["F04", "G04"], ["F17", "G18"]];
for (const [vid, gid] of PICKS) {
  const key = `${vid}|${gid}`;
  const v = voices.find((x) => x.id === vid), g = grounds.find((x) => x.id === gid);
  if (!v || !g) continue;
  if (!byPair.has(key)) byPair.set(key, { id: ids.take(key), v: vid, g: gid, ind: v.ind.slice(0, 2), media: v.media.filter((m) => g.media.includes(m)), score: 100 });
  byPair.get(key).pick = 1;
}
ids.save();

const kits = [...byPair.values()];
fs.writeFileSync(path.join(ROOT, "data", "kits.json"), JSON.stringify({ v: 1, generated: new Date().toISOString().slice(0, 10), count: kits.length, kits }));
const per = Object.fromEntries(INDUSTRIES.map((i) => [i, kits.filter((k) => k.ind.includes(i)).length]));
console.log(`kits: ${kits.length} (picks ${kits.filter((k) => k.pick).length}, dark ${kits.filter((k) => grounds.find((g) => g.id === k.g).tokens.dark).length})`);
console.log("per industry:", per);
console.log(`size: ${(fs.statSync(path.join(ROOT, "data", "kits.json")).size / 1024).toFixed(0)} KB`);
