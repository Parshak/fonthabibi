// Checks the generated data for mistakes and writes /data/meta.json
// (counts and the label lists the pages use for filters).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contrastReport } from "./lib/color.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const { fonts } = read("fonts.json");
const { voices } = read("voices.json");
const { grounds } = read("grounds.json");
const media = JSON.parse(fs.readFileSync(path.join(here, "src", "media.json"), "utf8"));

const problems = [];
const names = new Set(fonts.map((f) => f.n));
const ids = new Set();
for (const v of voices) {
  for (const k of ["d", "b", "u"]) if (!names.has(v[k])) problems.push(`voice ${v.id}: unknown font ${v[k]}`);
  if (ids.has(v.id)) problems.push(`duplicate id ${v.id}`);
  ids.add(v.id);
  if (!v.media?.length) problems.push(`voice ${v.id}: no media`);
}
for (const g of grounds) {
  if (ids.has(g.id)) problems.push(`duplicate id ${g.id}`);
  ids.add(g.id);
  for (const k of ["bgHex", "surface", "ink", "muted", "accent", "accentInk", "border"])
    if (!/^#[0-9A-F]{6}$/i.test(g.tokens[k])) problems.push(`ground ${g.id}: bad ${k} ${g.tokens[k]}`);
  const r = contrastReport(g.tokens);
  if (r.grade !== g.grade) problems.push(`ground ${g.id}: grade mismatch ${r.grade} vs ${g.grade}`);
  if (!g.curated && !["AA", "AAA"].includes(g.grade)) problems.push(`ground ${g.id}: generated ground below AA`);
}

const LANG_LABEL = {
  latin: "Latin", "latin-ext": "Latin Extended", cyrillic: "Cyrillic", greek: "Greek", vietnamese: "Vietnamese",
  devanagari: "Devanagari (Hindi, Nepali, Marathi)", arabic: "Arabic", hebrew: "Hebrew", thai: "Thai", bengali: "Bengali",
  tamil: "Tamil", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam", gujarati: "Gujarati", gurmukhi: "Gurmukhi (Punjabi)",
  sinhala: "Sinhala", khmer: "Khmer", lao: "Lao", myanmar: "Myanmar", oriya: "Odia", tibetan: "Tibetan", japanese: "Japanese",
  korean: "Korean", "chinese-simplified": "Chinese (Simplified)", "chinese-traditional": "Chinese (Traditional)",
  "chinese-hongkong": "Chinese (Hong Kong)", ethiopic: "Ethiopic (Amharic)", georgian: "Georgian", armenian: "Armenian",
};
const INDUSTRIES = [
  ["restaurant", "Restaurant & café"], ["bakery", "Bakery & sweets"], ["grocery", "Grocery & market"], ["barber", "Barber & salon"],
  ["beauty", "Beauty & spa"], ["fitness", "Fitness & sport"], ["medical", "Medical & dental"], ["finance", "Law & finance"],
  ["realestate", "Real estate"], ["trades", "Construction & trades"], ["automotive", "Automotive"], ["tech", "Tech & SaaS"],
  ["education", "Education & tutoring"], ["kids", "Kids & family"], ["wedding", "Wedding & events"], ["fashion", "Fashion & boutique"],
  ["art", "Art & photography"], ["nightlife", "Music & nightlife"], ["travel", "Travel & hospitality"], ["community", "Nonprofit & community"],
  ["agency", "Agency & studio"], ["publishing", "Publishing & news"], ["gaming", "Gaming"], ["portfolio", "Personal portfolio"],
].map(([id, label]) => ({ id, label, voices: voices.filter((v) => v.ind.includes(id)).length, grounds: grounds.filter((g) => g.ind.includes(id)).length }));

const count = (list, key) => {
  const m = {};
  for (const x of list) for (const v of [].concat(x[key] ?? [])) m[v] = (m[v] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }));
};
const langs = count(fonts, "sub").filter((l) => LANG_LABEL[l.id]).map((l) => ({ ...l, label: LANG_LABEL[l.id] }));

const meta = {
  v: 1,
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    fonts: fonts.filter((f) => !f.sp).length,
    voices: voices.length,
    curatedVoices: voices.filter((v) => v.curated).length,
    grounds: grounds.length,
    curatedGrounds: grounds.filter((g) => g.curated).length,
    combos: voices.length * grounds.length,
  },
  media: media.map((m) => ({ id: m.id, label: m.label, note: m.note })),
  industries: INDUSTRIES,
  languages: langs,
  fontCategories: count(fonts, "c"),
  fontStyles: count(fonts, "st"),
  fontMoods: count(fonts.map((f) => ({ m: Object.keys(f.m || {}) })), "m"),
  voiceMoods: count(voices, "mood"),
  groundMoods: count(grounds, "mood"),
  hues: count(grounds, "hue"),
  grades: count(grounds, "grade"),
};
fs.writeFileSync(path.join(ROOT, "data", "meta.json"), JSON.stringify(meta, null, 1));

console.log("counts:", meta.counts);
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.log(" -", p);
  process.exit(1);
}
console.log("all checks passed");
