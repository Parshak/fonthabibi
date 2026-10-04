// Builds /data/kits.json: ready-made kits = one font pairing (voice) on one
// color set (ground), picked for a kind of business. This is what most
// visitors want: "show me something good for a cafe website", not raw parts.
//
// For each kind of business, pairings and color sets tagged with it are
// matched when their moods agree (vintage type on warm paper, futuristic type
// on a techy dark ground...). The list is then chosen one kit at a time, and
// every pick makes similar kits less likely, so each list ends up as a spread
// of colors, light and dark, and type styles instead of 24 look-alikes.
// Run after the other builders.

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
// Share of dark kits each list should end up with: [at least, at most].
// A club night is mostly dark, a bakery almost never.
const DARK = {
  nightlife: [0.7, 0.88], gaming: [0.7, 0.88],
  tech: [0.25, 0.4], fitness: [0.3, 0.45], automotive: [0.3, 0.45],
  agency: [0.2, 0.34], barber: [0.2, 0.34], art: [0.16, 0.3], fashion: [0.16, 0.3],
  restaurant: [0.12, 0.25], portfolio: [0.12, 0.25], trades: [0.08, 0.2],
  finance: [0.04, 0.13], beauty: [0.04, 0.13], realestate: [0, 0.13], publishing: [0, 0.13], travel: [0, 0.09],
};
const DEFAULT_DARK = [0, 0.05]; // bakery, grocery, medical, education, kids, wedding, community
// The accent colors each kind of business is known for. They get a head start,
// so a list opens with its most characteristic looks before it branches out.
const SIGNATURE = {
  restaurant: ["red", "orange", "green", "yellow"], bakery: ["pink", "orange", "yellow", "red"], grocery: ["green", "orange", "yellow", "red"],
  barber: ["red", "blue", "mono", "yellow"], beauty: ["pink", "green", "violet", "orange"], fitness: ["red", "orange", "yellow", "blue"],
  medical: ["blue", "teal", "green"], finance: ["blue", "green", "mono", "teal"], realestate: ["blue", "green", "mono", "orange"],
  trades: ["orange", "yellow", "blue", "red"], automotive: ["red", "blue", "mono", "orange"], tech: ["blue", "violet", "teal", "green"],
  education: ["blue", "green", "yellow", "orange"], kids: ["yellow", "pink", "blue", "orange"], wedding: ["pink", "yellow", "green", "red"],
  fashion: ["mono", "pink", "red", "orange"], art: ["mono", "red", "blue", "violet"], nightlife: ["pink", "violet", "blue", "green"],
  travel: ["teal", "blue", "orange", "yellow"], community: ["green", "orange", "teal", "blue"], agency: ["violet", "blue", "mono", "pink"],
  publishing: ["mono", "red", "blue"], gaming: ["green", "violet", "pink", "blue"], portfolio: ["mono", "blue", "orange", "green"],
};

// How well one pairing sits on one color set, before variety is considered.
function score(v, g) {
  let s = v.curated ? 0.35 : ((v.score || 50) / 100) * 0.3;
  s += g.curated ? 0.25 : 0.15;
  s += g.grade === "AAA" ? 0.1 : g.grade === "AA" ? 0.05 : -0.25;
  let fit = 0;
  for (const m of v.mood) for (const gm of FIT[m] || []) if (g.mood.includes(gm)) fit += 0.08;
  s += Math.min(fit, 0.4);
  s += v.media.filter((m) => g.media.includes(m)).length * 0.02;
  return s;
}

// What makes two kits look alike.
const tone = (g) => (g.tokens.dark ? "dark" : "light");
const paper = (g) => (g.curated ? g.id : g.name.split(" & ")[0]);   // generated sets are "Paper & Accent"
const faceKind = (v) => fontIdx.get(v.d)?.c || "sans";

// The six kits the home page wears open the lists they belong to, as our picks.
const PICKS = [
  ["F01", "G01", ["restaurant", "publishing"]], ["F02", "G02", ["tech", "agency"]], ["F05", "G05", ["agency", "trades"]],
  ["F08", "G08", ["fitness", "automotive"]], ["F04", "G04", ["wedding", "restaurant"]], ["F17", "G18", ["agency", "art"]],
];

// How often each color set has been used by the lists built so far. A
// favorite loses a little each time, so the same few do not open every list
// and more of the library gets shown.
const usedBefore = {};

function choose(ind) {
  const vs = voices.filter((v) => v.ind.includes(ind) && latinOK(v));
  const gs = grounds.filter((g) => g.ind.includes(ind));
  const cands = [];
  for (const v of vs) for (const g of gs) {
    if (!v.media.some((m) => g.media.includes(m))) continue;
    const sig = (SIGNATURE[ind] || []).indexOf(g.hue);
    cands.push({ v, g, s: score(v, g) + (sig < 0 ? 0 : sig < 2 ? 0.12 : 0.07) });
  }
  cands.sort((a, b) => b.s - a.s);

  const n = Math.min(PER_INDUSTRY, vs.length, gs.length);
  const [lo, hi] = DARK[ind] || DEFAULT_DARK;
  const minDark = Math.round(lo * n), maxDark = Math.round(hi * n);
  const picked = [], usedV = new Set(), usedG = new Set();
  const seen = { look: {}, hue: {}, paper: {}, kind: {}, face: {}, body: {} };
  const count = (map, key) => map[key] || 0;
  const take = (c) => {
    picked.push(c);
    usedV.add(c.v.id); usedG.add(c.g.id);
    for (const [map, key] of [[seen.look, tone(c.g) + c.g.hue], [seen.hue, c.g.hue], [seen.paper, paper(c.g)],
      [seen.kind, faceKind(c.v)], [seen.face, c.v.d], [seen.body, c.v.b]]) map[key] = count(map, key) + 1;
  };
  // Our picks go in first, so the rest of the list is chosen around them.
  for (const [vid, gid, inds] of PICKS) {
    if (!inds.includes(ind)) continue;
    const v = voices.find((x) => x.id === vid), g = grounds.find((x) => x.id === gid);
    if (v && g) take({ v, g, s: 1, pick: 1 });
  }
  let strict = true;
  while (picked.length < n) {
    const dark = picked.filter((p) => p.g.tokens.dark).length;
    // A list opens in the tone its business is known for: light for most,
    // dark for club nights and games. Mixed ones (tech, gyms) open either way.
    const opening = picked.length < 3;
    const onlyDark = strict && (minDark - dark >= n - picked.length || (opening && lo >= 0.5));
    const noDark = strict && (dark >= maxDark || (opening && hi < 0.3));
    let best = null, bestS = -Infinity;
    for (const c of cands) {
      if (usedV.has(c.v.id) || usedG.has(c.g.id)) continue;
      if ((noDark && c.g.tokens.dark) || (onlyDark && !c.g.tokens.dark)) continue;
      const s = c.s
        - 0.16 * count(seen.look, tone(c.g) + c.g.hue)   // same accent color and tone again
        - 0.05 * count(seen.hue, c.g.hue)
        - 0.1 * count(seen.paper, paper(c.g))            // same background again
        - 0.04 * count(seen.kind, faceKind(c.v))         // serif after serif after serif
        - 0.35 * count(seen.face, c.v.d)                 // the same heading font again
        - 0.08 * count(seen.body, c.v.b)
        - Math.min(0.3, 0.04 * count(usedBefore, c.g.id));   // already in other lists
      if (s > bestS) { best = c; bestS = s; }
    }
    if (!best) {
      if (!strict) break;
      strict = false;   // not enough light (or dark) sets for this business: take what there is
      continue;
    }
    take(best);
  }
  for (const c of picked) usedBefore[c.g.id] = count(usedBefore, c.g.id) + 1;
  return picked;
}

const ids = idRegistry("kits", "K", 1);
const byPair = new Map();
// "r" is the kit's place in each of its lists (same order as "ind"), so the
// site can show every list in the order it was chosen: best first, varied.
for (const ind of INDUSTRIES) {
  choose(ind).forEach((c, i) => {
    const key = `${c.v.id}|${c.g.id}`;
    if (!byPair.has(key)) {
      byPair.set(key, { id: ids.take(key), v: c.v.id, g: c.g.id, ind: [], r: [], media: c.v.media.filter((m) => c.g.media.includes(m)), score: Math.round(c.s * 100) });
    }
    const kit = byPair.get(key);
    kit.ind.push(ind);
    kit.r.push(i + 1);
    if (c.pick) kit.pick = 1;
  });
}
ids.save();

const kits = [...byPair.values()];
fs.writeFileSync(path.join(ROOT, "data", "kits.json"), JSON.stringify({ v: 1, generated: new Date().toISOString().slice(0, 10), count: kits.length, kits }));

const gIdx = new Map(grounds.map((g) => [g.id, g]));
console.log(`kits: ${kits.length} (picks ${kits.filter((k) => k.pick).length}, dark ${kits.filter((k) => gIdx.get(k.g).tokens.dark).length})`);
for (const ind of INDUSTRIES) {
  const list = kits.filter((k) => k.ind.includes(ind));
  const looks = {};
  for (const k of list) { const g = gIdx.get(k.g); const key = (g.tokens.dark ? "D-" : "L-") + g.hue; looks[key] = (looks[key] || 0) + 1; }
  console.log(` ${ind.padEnd(11)} ${String(list.length).padStart(2)}  ${Object.entries(looks).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}:${c}`).join(" ")}`);
}
console.log(`size: ${(fs.statSync(path.join(ROOT, "data", "kits.json")).size / 1024).toFixed(0)} KB`);
