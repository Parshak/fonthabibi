/* ============================================================
   Library page logic
   - one page, three tabs: fonts, pairings (voices), grounds
   - filters are chips; within a group they mean "any of", across
     groups they mean "all of"; counts show what each chip would give
   - everything lives in the URL, so any view can be shared
   - cards render in pages as you scroll; fonts load only when a
     card is about to be seen
   ============================================================ */
import {
  loadData, esc, fmt, cssStack, useFont, nearestWeight, familyParam, gfURL,
  sampleFor, scriptOf, isRTL, SAMPLES, voiceCSS, groundCSS, copyText, flash,
} from "./fh-core.js?v=20261005";

const $ = (s, el = document) => el.querySelector(s);
const PAGE = 36;
const MIXER = "/type-ground-mixer-pro";

const CAT = { sans: "Sans serif", serif: "Serif", display: "Display", handwriting: "Handwriting", mono: "Monospace" };
const TONE = { light: "Light", dark: "Dark" };
const HUE = { red: "Red", orange: "Orange", yellow: "Yellow and gold", green: "Green", teal: "Teal", blue: "Blue", violet: "Violet", pink: "Pink", mono: "Black and grey" };
const GRADE = { AAA: "AAA", AA: "AA", "AA large": "AA large text", Low: "Low" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Headline and body copy for pairing previews, chosen by the pairing's first industry.
const COPY = {
  restaurant: ["Dinner is ready at seven", "Seasonal plates, a short wine list and a table by the window."],
  bakery: ["Fresh out of the oven", "Sourdough at seven, croissants at eight and something sweet all day."],
  grocery: ["Picked this morning", "Local fruit, fresh bread and pantry staples at fair prices."],
  barber: ["Sharp cuts, no waiting", "Walk in, sit down and leave looking like yourself on a good day."],
  beauty: ["Slow down for an hour", "Facials, massage and quiet rooms made for doing nothing."],
  fitness: ["Train like it counts", "Strength classes at six, morning and evening, coached in small groups."],
  medical: ["Care that explains itself", "Same-week appointments, clear advice and follow-ups that happen."],
  finance: ["Plain advice, on time", "Tax returns, business accounts and straight answers in writing."],
  realestate: ["Homes worth slowing down for", "Three bedrooms, north light and a garden that gets the afternoon sun."],
  trades: ["Built right the first time", "Licensed builders for renovations, extensions and repairs."],
  automotive: ["Serviced and ready by five", "Logbook servicing, tyres and brakes with a fixed-price quote."],
  tech: ["Ship the update tonight", "Preview every change, then roll it out with one click."],
  education: ["Learn it properly", "Small classes, patient tutors and progress you can see each week."],
  kids: ["Big days for small people", "Play, paint and make a mess, then go home tired and happy."],
  wedding: ["Save the date", "A long lunch, a short ceremony and dancing until late."],
  fashion: ["The autumn edit", "Wool coats, soft knits and the trousers you will wear all season."],
  art: ["New work, opening Friday", "Twelve paintings about light, water and the hour before dark."],
  nightlife: ["Doors at nine", "Live sets all night, two rooms and one very loud speaker stack."],
  travel: ["Wake up near the water", "Rooms with sea views, slow breakfasts and bikes at the door."],
  community: ["Help is close by", "Free meals on Tuesdays, homework club on Thursdays, everyone welcome."],
  agency: ["We design the hard parts", "Brand, product and front-end for teams shipping their first big thing."],
  publishing: ["The long read", "A weekly letter about cities, food and the people who keep them running."],
  gaming: ["Season two is live", "New maps, a ranked ladder and a boss nobody has beaten yet."],
  portfolio: ["Hi, I make things", "Designer and developer, building tools for small businesses."],
  _: ["Every project starts with a voice", "Pick the type, pick the colours and paste them into your build."],
};

let META, FONTS, VOICES, GROUNDS, IDX, GIDX, IND, MEDIA, LANG;

/* ---------- state (mirrored in the URL) ---------- */
const state = {
  tab: "fonts",
  q: "",
  sel: {},          // facet key -> Set of values
  tog: {},          // toggle key -> true
  sort: "",
  font: "",         // pairings: only pairings using this font
  text: "",         // fonts: custom preview text
  size: 34,         // fonts: specimen size
  on: "G09",        // pairings: ground to paint previews with
  shown: 0,
  list: [],
};

/* ---------- tab definitions ---------- */
function defs() {
  const anyOf = (get) => (x, vals) => { const v = get(x); return [...vals].some((s) => (Array.isArray(v) ? v.includes(s) : v === s)); };
  return {
    fonts: {
      noun: ["font", "fonts"],
      items: () => FONTS,
      hay: (f) => [f.n, CAT[f.c], f.st, Object.keys(f.m || {}).join(" "), f.ds, (f.th || []).join(" ")].join(" ").toLowerCase(),
      facets: [
        { key: "c", label: "Category", opts: META.fontCategories.map((o) => [o.id, CAT[o.id] || o.id]), test: anyOf((f) => f.c) },
        { key: "st", label: "Style", opts: META.fontStyles.map((o) => [o.id, o.id]), test: anyOf((f) => f.st), fold: 10 },
        { key: "m", label: "Mood", opts: META.fontMoods.map((o) => [o.id, cap(o.id)]), test: (f, vals) => [...vals].some((m) => (f.m?.[m] || 0) >= 40), fold: 12 },
        { key: "lang", label: "Language", opts: LANG.map((l) => [l.id, l.label]), test: (f, vals) => [...vals].every((l) => f.sub.includes(l)), fold: 8, note: "Shows fonts that support every language you pick." },
      ],
      toggles: [
        { key: "var", label: "Variable fonts only", test: (f) => !!f.ax },
        { key: "it", label: "Has true italics", test: (f) => !!f.it },
        { key: "feat", label: "Featured only", test: (f) => !!f.f },
        { key: "sp", label: "Include novelty and utility fonts", include: true },
      ],
      sorts: [["featured", "Featured first"], ["quality", "Highest quality"], ["new", "Newest"], ["az", "A to Z"]],
      sortFn: {
        featured: (a, b) => (a.f || 9999) - (b.f || 9999) || (b.q || 0) - (a.q || 0) || a.n.localeCompare(b.n),
        quality: (a, b) => (b.q || 0) - (a.q || 0) || a.n.localeCompare(b.n),
        new: (a, b) => (b.add || "").localeCompare(a.add || "") || a.n.localeCompare(b.n),
        az: (a, b) => a.n.localeCompare(b.n),
      },
      base: (f) => state.tog.sp || !f.sp,
    },
    voices: {
      noun: ["pairing", "pairings"],
      items: () => VOICES,
      hay: (v) => [v.name, v.d, v.b, v.u, v.vibe, v.mood.join(" "), v.ind.map((i) => IND[i] || i).join(" ")].join(" ").toLowerCase(),
      facets: [
        { key: "ind", label: "Industry", opts: META.industries.map((i) => [i.id, i.label]), test: anyOf((v) => v.ind), fold: 12 },
        { key: "m", label: "Mood", opts: META.voiceMoods.map((o) => [o.id, cap(o.id)]), test: anyOf((v) => v.mood), fold: 12 },
        { key: "media", label: "Made for", opts: META.media.map((m) => [m.id, m.label]), test: anyOf((v) => v.media) },
        { key: "lang", label: "Language", opts: langOptions(VOICES), test: anyOf((v) => v.lang), fold: 8 },
      ],
      toggles: [{ key: "cur", label: "Curated only", test: (v) => !!v.curated }],
      sorts: [["best", "Curated first"], ["score", "Best match"], ["az", "A to Z"]],
      sortFn: {
        best: (a, b) => (b.curated || 0) - (a.curated || 0) || (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name),
        score: (a, b) => (b.score ?? 101) - (a.score ?? 101) || a.name.localeCompare(b.name),
        az: (a, b) => a.name.localeCompare(b.name),
      },
      base: (v) => !state.font || v.d === state.font || v.b === state.font,
    },
    grounds: {
      noun: ["ground", "grounds"],
      items: () => GROUNDS,
      hay: (g) => [g.name, g.vibe, g.hue, g.mood.join(" "), g.ind.map((i) => IND[i] || i).join(" "), g.grade].join(" ").toLowerCase(),
      facets: [
        { key: "tone", label: "Light or dark", opts: [["light", "Light"], ["dark", "Dark"]], test: (g, vals) => vals.has(g.tokens.dark ? "dark" : "light") },
        { key: "hue", label: "Accent colour", opts: META.hues.map((h) => [h.id, HUE[h.id] || h.id]), test: anyOf((g) => g.hue) },
        { key: "m", label: "Mood", opts: META.groundMoods.map((o) => [o.id, cap(o.id)]), test: anyOf((g) => g.mood) },
        { key: "ind", label: "Industry", opts: META.industries.map((i) => [i.id, i.label]), test: anyOf((g) => g.ind), fold: 12 },
        { key: "media", label: "Made for", opts: META.media.map((m) => [m.id, m.label]), test: anyOf((g) => g.media) },
        { key: "grade", label: "Contrast", opts: [["AAA", "AAA"], ["AA", "AA"], ["AA large", "AA large text"]], test: anyOf((g) => g.grade) },
      ],
      toggles: [{ key: "cur", label: "Curated only", test: (g) => !!g.curated }],
      sorts: [["best", "Curated first"], ["light", "Lightest first"], ["dark", "Darkest first"], ["hue", "By colour"]],
      sortFn: {
        best: (a, b) => (b.curated || 0) - (a.curated || 0) || a.id.localeCompare(b.id, undefined, { numeric: true }),
        light: (a, b) => lum(b.tokens.bgHex) - lum(a.tokens.bgHex),
        dark: (a, b) => lum(a.tokens.bgHex) - lum(b.tokens.bgHex),
        hue: (a, b) => HUE_ORDER.indexOf(a.hue) - HUE_ORDER.indexOf(b.hue) || lum(b.tokens.bgHex) - lum(a.tokens.bgHex),
      },
      base: () => true,
    },
  };
}
const HUE_ORDER = ["red", "orange", "yellow", "green", "teal", "blue", "violet", "pink", "mono"];
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function langOptions(list) {
  const counts = {};
  for (const x of list) for (const l of x.lang || []) counts[l] = (counts[l] || 0) + 1;
  const label = Object.fromEntries(LANG.map((l) => [l.id, l.label]));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => [id, label[id] || cap(id)]);
}
let D;

/* ---------- URL <-> state ---------- */
function readURL() {
  const p = new URLSearchParams(location.search);
  state.tab = ["fonts", "voices", "grounds"].includes(p.get("tab")) ? p.get("tab") : "fonts";
  state.q = p.get("q") || "";
  state.sort = p.get("sort") || "";
  state.font = p.get("font") || "";
  state.text = p.get("text") || "";
  state.size = Math.min(72, Math.max(16, Number(p.get("size")) || 34));
  state.on = p.get("on") || "G09";
  state.sel = {};
  state.tog = {};
  for (const f of D[state.tab].facets) if (p.get(f.key)) state.sel[f.key] = new Set(p.get(f.key).split(","));
  for (const t of D[state.tab].toggles) if (p.get(t.key) === "1") state.tog[t.key] = true;
}
function writeURL() {
  const p = new URLSearchParams();
  if (state.tab !== "fonts") p.set("tab", state.tab);
  if (state.q) p.set("q", state.q);
  for (const [k, v] of Object.entries(state.sel)) if (v.size) p.set(k, [...v].join(","));
  for (const [k, v] of Object.entries(state.tog)) if (v) p.set(k, "1");
  if (state.sort) p.set("sort", state.sort);
  if (state.tab === "voices" && state.font) p.set("font", state.font);
  if (state.tab === "voices" && state.on !== "G09") p.set("on", state.on);
  if (state.tab === "fonts" && state.text) p.set("text", state.text);
  if (state.tab === "fonts" && state.size !== 34) p.set("size", state.size);
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

/* ---------- filtering ---------- */
let hayCache = new WeakMap();
function matches(x, def, skipFacet) {
  if (!def.base(x)) return false;
  if (state.q) {
    let h = hayCache.get(x);
    if (!h) { h = def.hay(x); hayCache.set(x, h); }
    for (const word of state.q.toLowerCase().split(/\s+/).filter(Boolean)) if (!h.includes(word)) return false;
  }
  for (const t of def.toggles) if (!t.include && state.tog[t.key] && !t.test(x)) return false;
  for (const f of def.facets) {
    if (f.key === skipFacet) continue;
    const vals = state.sel[f.key];
    if (vals && vals.size && !f.test(x, vals)) return false;
  }
  return true;
}
function compute() {
  const def = D[state.tab];
  const sortKey = state.sort && def.sortFn[state.sort] ? state.sort : def.sorts[0][0];
  state.list = def.items().filter((x) => matches(x, def)).sort(def.sortFn[sortKey]);
}
// For each chip: how many results it would give with the other filters as they are.
function facetCounts(facet) {
  const def = D[state.tab];
  const pool = def.items().filter((x) => matches(x, def, facet.key));
  const counts = new Map();
  for (const [id] of facet.opts) counts.set(id, 0);
  for (const x of pool) for (const [id] of facet.opts) if (facet.test(x, new Set([id]))) counts.set(id, counts.get(id) + 1);
  return counts;
}

/* ---------- rendering: filters ---------- */
const unfolded = new Set();
function renderFilters() {
  const def = D[state.tab];
  const html = [];
  for (const f of def.facets) {
    const counts = facetCounts(f);
    const sel = state.sel[f.key] || new Set();
    let opts = f.opts.filter(([id]) => counts.get(id) > 0 || sel.has(id));
    const folded = f.fold && !unfolded.has(state.tab + f.key) && opts.length > f.fold + 2;
    const visible = folded ? opts.filter(([id], i) => i < f.fold || sel.has(id)) : opts;
    html.push(`<section class="facet"><h2>${esc(f.label)}</h2><div class="chips">${visible.map(([id, label]) =>
      `<button class="chip" type="button" aria-pressed="${sel.has(id)}" data-facet="${f.key}" data-val="${esc(id)}">${esc(label)} <span class="c">${fmt(counts.get(id) || 0)}</span></button>`).join("")}</div>${
      folded ? `<button class="show-all" type="button" data-unfold="${f.key}">Show all ${opts.length}</button>` : ""}${
      f.note && sel.size > 1 ? `<p class="facts" style="margin-top:8px">${esc(f.note)}</p>` : ""}</section>`);
  }
  html.push(`<div class="toggles">${def.toggles.map((t) =>
    `<label class="toggle"><input type="checkbox" data-tog="${t.key}" ${state.tog[t.key] ? "checked" : ""}> ${esc(t.label)}</label>`).join("")}</div>`);
  $("#facets").innerHTML = html.join("");
  const active = Object.values(state.sel).reduce((n, s) => n + s.size, 0) + Object.values(state.tog).filter(Boolean).length + (state.font ? 1 : 0);
  $("#active-count").textContent = active ? `(${active})` : "";
  $("#clear").hidden = !active && !state.q;
}

/* ---------- rendering: toolbar ---------- */
function renderTools() {
  const def = D[state.tab];
  const sortKey = state.sort && def.sortFn[state.sort] ? state.sort : def.sorts[0][0];
  let html = `<label class="field">Sort <select id="sort">${def.sorts.map(([k, l]) => `<option value="${k}" ${k === sortKey ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  if (state.tab === "fonts") {
    html = `<label class="field"><span class="sr">Preview text</span><input type="text" id="ptext" placeholder="Type to preview" value="${esc(state.text)}"></label>
      <label class="field">Size <input type="range" id="psize" min="16" max="72" step="2" value="${state.size}"></label>` + html;
  }
  if (state.tab === "voices") {
    const opts = GROUNDS.filter((g) => g.curated).sort((a, b) => lum(b.tokens.bgHex) - lum(a.tokens.bgHex));
    html = `<label class="field">Preview on <select id="pground">${opts.map((g) => `<option value="${g.id}" ${g.id === state.on ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>` + html;
  }
  $("#tools").innerHTML = html;
}

function renderResultLine() {
  const def = D[state.tab];
  const n = state.list.length;
  let line = `<b>${fmt(n)}</b> ${n === 1 ? def.noun[0] : def.noun[1]}`;
  if (state.tab === "voices" && state.font) line += ` using ${esc(state.font)} <button class="clear-font" type="button" id="clear-font">Show all pairings</button>`;
  $("#result-line").innerHTML = line;
}

/* ---------- rendering: cards ---------- */
const fontObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    fontObserver.unobserve(e.target);
    const need = e.target._fonts || [];
    for (const [f, ws] of need) useFont(f, ws);
  }
}, { rootMargin: "600px 0px" });

function fontCard(f) {
  const script = scriptOf(f);
  const latinish = script === "latin" || script === "cyrillic" || script === "greek";
  const text = state.text && latinish ? state.text : sampleFor(f);
  const weights = f.ax?.wght ? "variable weight" : `${f.w.length} weight${f.w.length > 1 ? "s" : ""}`;
  const facts = [f.st && f.st !== "Monospace" ? f.st : CAT[f.c] || f.c, weights, f.it ? "italics" : ""].filter(Boolean).join(", ");
  const langs = f.sub.filter((s) => s !== "latin-ext" && LANG.some((l) => l.id === s));
  const langLabel = !langs.length ? "Latin" : langs.length > 4 ? `Latin and ${langs.length} more scripts` : [f.sub.includes("latin") ? "Latin" : "", ...langs.map((s) => (LANG.find((l) => l.id === s) || {}).label || s)].filter(Boolean).join(", ");
  const moods = Object.keys(f.m || {}).slice(0, 3);
  const el = document.createElement("article");
  el.className = "card font-card";
  el.innerHTML = `
    <div class="spec" ${isRTL(script) ? 'dir="rtl"' : ""}><p style="font-family:${esc(cssStack(f))};font-weight:${nearestWeight(f, 400)}" lang="${script === "latin" ? "en" : ""}">${esc(text)}</p></div>
    <div class="meta">
      <div class="row"><h2 class="nm">${esc(f.n)}</h2>${f.f ? '<span class="featured">Featured</span>' : ""}</div>
      <p class="facts">${esc(facts)}</p>
      <p class="langs">${esc(langLabel)}${f.ds ? `. By ${esc(f.ds.split(",").slice(0, 2).join(","))}` : ""}</p>
      ${moods.length ? `<ul class="tags">${moods.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="acts">
      <button class="act primary" type="button" data-act="pair" data-font="${esc(f.n)}">Pairings</button>
      <button class="act" type="button" data-act="copy-font" data-font="${esc(f.n)}">Copy CSS</button>
      <a class="act" href="https://fonts.google.com/specimen/${encodeURIComponent(f.n).replace(/%20/g, "+")}" target="_blank" rel="noopener">Google Fonts</a>
    </div>`;
  el._fonts = [[f, [400]]];
  return el;
}

function voiceCard(v) {
  const Df = IDX.get(v.d), Bf = IDX.get(v.b), Uf = IDX.get(v.u);
  const g = GIDX.get(state.on) || GROUNDS[0];
  const t = g.tokens;
  const script = v.lang.find((l) => SAMPLES[l] && !["cyrillic", "greek", "vietnamese"].includes(l));
  // When an industry filter is on, preview the pairing with that industry's copy.
  const picked = [...(state.sel.ind || [])].find((i) => v.ind.includes(i));
  const ind = picked || v.ind[0];
  const [head, body] = script ? [SAMPLES[script], SAMPLES[script] + " " + SAMPLES[script]] : COPY[ind] || COPY._;
  const kicker = script ? (LANG.find((l) => l.id === script) || {}).label || script : (IND[ind] || "FontHabibi");
  const media = v.media.map((m) => (MEDIA[m] || m)).join(", ");
  const el = document.createElement("article");
  el.className = "card voice-card";
  el.innerHTML = `
    <div class="pv" style="background:${t.bg};color:${t.ink}" ${script && isRTL(script) ? 'dir="rtl"' : ""}>
      <p class="pv-k" style="font-family:${esc(cssStack(Uf, v.u))};color:${t.accent}">${esc(kicker)}</p>
      <h2 class="pv-h" style="font-family:${esc(cssStack(Df, v.d))};font-weight:${v.dw}">${esc(head)}</h2>
      <p class="pv-b" style="font-family:${esc(cssStack(Bf, v.b))};color:${t.muted}">${esc(body)}</p>
      <span class="pv-btn" style="background:${t.accent};color:${t.accentInk};border-radius:${t.radius}px;font-family:${esc(cssStack(Uf, v.u))}">${script ? "OK" : "Book now"}</span>
    </div>
    <div class="meta">
      <div class="row"><h3 class="nm">${esc(v.name)}</h3><span class="id">${esc(v.id)}${v.curated ? " · curated" : ""}</span></div>
      <p class="vibe">${esc(cap(v.vibe))}</p>
      <p class="fonts-used"><b>Display</b> ${esc(v.d)} · <b>Body</b> ${esc(v.b)} · <b>UI</b> ${esc(v.u)}</p>
      <ul class="tags">${v.ind.slice(0, 3).map((i) => `<li class="ind">${esc(IND[i] || i)}</li>`).join("")}${v.mood.slice(0, 2).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
      <p class="facts">Made for ${esc(media.toLowerCase())}</p>
    </div>
    <div class="acts">
      <a class="act primary" href="${MIXER}?voice=${encodeURIComponent(v.id)}&ground=${encodeURIComponent(g.id)}&medium=${encodeURIComponent(v.media[0] || "web")}">Open in mixer</a>
      <button class="act" type="button" data-act="copy-voice" data-id="${esc(v.id)}">Copy CSS</button>
    </div>`;
  el._fonts = [[Df, [v.dw]], [Bf, [400]], [Uf, [400]]];
  return el;
}

function groundCard(g) {
  const t = g.tokens;
  const el = document.createElement("article");
  el.className = "card ground-card";
  const sw = [["bg", t.bgHex], ["surface", t.surface], ["ink", t.ink], ["muted", t.muted], ["accent", t.accent], ["border", t.border]];
  el.innerHTML = `
    <div class="gv" style="background:${t.bg}">
      <div class="gv-card" style="background:${t.surface};border-color:${t.border};border-radius:${t.radius}px;color:${t.ink}">
        <p class="gv-h">${esc(g.name)}</p>
        <p class="gv-m" style="color:${t.muted}">Body text and captions sit in the muted colour.</p>
        <div class="gv-row"><span class="gv-btn" style="background:${t.accent};color:${t.accentInk};border-radius:${Math.min(t.radius, 12)}px">Button</span><span class="gv-a" style="color:${t.accent}">A link</span></div>
      </div>
    </div>
    <div class="meta">
      <div class="row"><h3 class="nm">${esc(g.name)}</h3><span class="grade ${g.grade === "Low" || g.grade === "AA large" ? "low" : g.grade}" title="Lowest text contrast ${Math.min(g.cr.ink, g.cr.muted, g.cr.accent, g.cr.button)}:1">${esc(GRADE[g.grade] || g.grade)}</span></div>
      <p class="vibe">${esc(cap(g.vibe))}. ${t.dark ? "Dark" : "Light"}, radius ${t.radius}px${g.curated ? ", curated" : ""}</p>
      <div class="swatches">${sw.map(([k, v]) => `<span style="background:${v}" title="${k} ${v}"></span>`).join("")}</div>
      <ul class="tags">${g.ind.slice(0, 3).map((i) => `<li class="ind">${esc(IND[i] || i)}</li>`).join("")}${g.mood.slice(0, 2).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    </div>
    <div class="acts">
      <a class="act primary" href="${MIXER}?ground=${encodeURIComponent(g.id)}&medium=${encodeURIComponent(g.media[0] || "web")}">Open in mixer</a>
      <button class="act" type="button" data-act="copy-ground" data-id="${esc(g.id)}">Copy CSS</button>
    </div>`;
  return el;
}

const CARD = { fonts: fontCard, voices: voiceCard, grounds: groundCard };
function renderPage() {
  const box = $("#results");
  const frag = document.createDocumentFragment();
  const next = state.list.slice(state.shown, state.shown + PAGE);
  for (const x of next) {
    const el = CARD[state.tab](x);
    frag.appendChild(el);
    if (el._fonts) fontObserver.observe(el);
  }
  box.appendChild(frag);
  state.shown += next.length;
}
function renderResults() {
  const box = $("#results");
  box.className = "results " + state.tab;
  box.style.setProperty("--spec-size", state.size + "px");
  box.innerHTML = "";
  state.shown = 0;
  const empty = $("#empty");
  if (!state.list.length) {
    const noun = D[state.tab].noun[1];
    empty.innerHTML = state.font
      ? `<b>No ready-made pairings use ${esc(state.font)} yet.</b>Try a similar font, or open the mixer and pick a voice close to it.<br><button type="button" id="empty-clear">Show all pairings</button>`
      : `<b>No ${noun} match these filters.</b>Remove a filter or try a shorter search.<br><button type="button" id="empty-clear">Clear filters</button>`;
    empty.hidden = false;
  } else {
    empty.hidden = true;
    renderPage();
  }
}

function renderTabs() {
  for (const b of document.querySelectorAll(".tab")) {
    const on = b.dataset.tab === state.tab;
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;
  }
  $("#results").setAttribute("aria-labelledby", "tab-" + state.tab);
}

function render({ filters = true, tools = true } = {}) {
  compute();
  renderTabs();
  if (filters) renderFilters();
  if (tools) renderTools();
  renderResultLine();
  renderResults();
  writeURL();
}

/* ---------- events ---------- */
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1600);
}
function switchTab(tab, extra = {}) {
  state.tab = tab;
  state.sel = {};
  state.tog = {};
  state.sort = "";
  state.q = "";
  state.font = "";
  Object.assign(state, extra);
  $("#q").value = state.q;
  render();
  window.scrollTo({ top: $(".lib-head").offsetTop + $(".lib-head").offsetHeight - 70, behavior: "smooth" });
}

function bind() {
  $(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b && b.dataset.tab !== state.tab) switchTab(b.dataset.tab);
  });
  $(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const order = ["fonts", "voices", "grounds"];
    const i = (order.indexOf(state.tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    switchTab(order[i]);
    document.querySelector(`.tab[data-tab="${order[i]}"]`).focus();
  });

  let qTimer;
  $("#q").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value.trim(); render({ tools: false }); }, 160);
  });

  $("#facets").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) {
      const { facet, val } = chip.dataset;
      const set = state.sel[facet] || (state.sel[facet] = new Set());
      set.has(val) ? set.delete(val) : set.add(val);
      render({ tools: false });
      return;
    }
    const more = e.target.closest("[data-unfold]");
    if (more) { unfolded.add(state.tab + more.dataset.unfold); renderFilters(); }
  });
  $("#facets").addEventListener("change", (e) => {
    const t = e.target.closest("[data-tog]");
    if (!t) return;
    state.tog[t.dataset.tog] = t.checked;
    render({ tools: false });
  });
  $("#clear").addEventListener("click", () => {
    state.sel = {}; state.tog = {}; state.q = ""; state.font = "";
    $("#q").value = "";
    render();
  });

  $("#tools").addEventListener("change", (e) => {
    if (e.target.id === "sort") { state.sort = e.target.value; render({ filters: false, tools: false }); }
    if (e.target.id === "pground") { state.on = e.target.value; render({ filters: false, tools: false }); }
  });
  let tTimer;
  $("#tools").addEventListener("input", (e) => {
    if (e.target.id === "psize") {
      state.size = Number(e.target.value);
      $("#results").style.setProperty("--spec-size", state.size + "px");
      writeURL();
    }
    if (e.target.id === "ptext") {
      clearTimeout(tTimer);
      tTimer = setTimeout(() => {
        state.text = e.target.value;
        for (const card of document.querySelectorAll(".font-card")) {
          const p = card.querySelector(".spec p");
          const f = IDX.get(card.querySelector(".nm").textContent);
          const s = scriptOf(f);
          if (s === "latin" || s === "cyrillic" || s === "greek") p.textContent = state.text || sampleFor(f);
        }
        writeURL();
      }, 120);
    }
  });

  $("#result-line").addEventListener("click", (e) => { if (e.target.id === "clear-font") { state.font = ""; render(); } });
  $("#empty").addEventListener("click", (e) => {
    if (e.target.id !== "empty-clear") return;
    state.sel = {}; state.tog = {}; state.q = ""; state.font = "";
    $("#q").value = "";
    render();
  });

  $("#results").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "pair") { switchTab("voices", { font: b.dataset.font }); return; }
    let css = "";
    if (act === "copy-font") {
      const f = IDX.get(b.dataset.font);
      css = `/* ${f.n} (FontHabibi) */\n@import url('${gfURL([familyParam(f, f.ax?.wght ? [400, 700] : f.w.slice(0, 6), true)])}');\n\nfont-family: ${cssStack(f)};\n`;
    }
    if (act === "copy-voice") css = voiceCSS(VOICES.find((v) => v.id === b.dataset.id), IDX);
    if (act === "copy-ground") css = groundCSS(GIDX.get(b.dataset.id));
    await copyText(css);
    flash(b, "Copied");
    toast("CSS copied. Paste it into your project or your prompt.");
  });

  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && state.shown < state.list.length) renderPage();
  }, { rootMargin: "900px 0px" }).observe($("#more"));
}

/* ---------- start ---------- */
async function start() {
  try {
    const [meta, fonts, voices, grounds] = await Promise.all(["meta", "fonts", "voices", "grounds"].map(loadData));
    META = meta;
    FONTS = fonts.fonts;
    VOICES = voices.voices;
    GROUNDS = grounds.grounds;
  } catch (err) {
    $("#results").innerHTML = `<div class="empty"><b>The library could not load.</b>Check your connection and reload the page.</div>`;
    return;
  }
  IDX = new Map(FONTS.map((f) => [f.n, f]));
  GIDX = new Map(GROUNDS.map((g) => [g.id, g]));
  IND = Object.fromEntries(META.industries.map((i) => [i.id, i.label]));
  MEDIA = Object.fromEntries(META.media.map((m) => [m.id, m.label]));
  LANG = META.languages.filter((l) => l.id !== "latin" && l.id !== "latin-ext");
  D = defs();

  const c = META.counts;
  document.querySelector('[data-count="fonts"]').textContent = fmt(c.fonts);
  document.querySelector('[data-count="voices"]').textContent = fmt(c.voices);
  document.querySelector('[data-count="grounds"]').textContent = fmt(c.grounds);
  $("#lede").textContent = `All ${fmt(c.fonts)} Google fonts, ${fmt(c.voices)} ready-made pairings and ${fmt(c.grounds)} colour grounds, every one checked for readable contrast. Filter by mood, industry or language, then open anything in the mixer.`;

  if (window.matchMedia("(max-width: 900px)").matches) $("#drawer").open = false;
  readURL();
  $("#q").value = state.q;
  bind();
  render();
}
start();
