/* ============================================================
   Library page logic
   - four tabs: kits (the default), font pairings, colors, fonts
   - a kit is one font pairing on one color set, picked for a kind
     of business and shown as a small website
   - the Kits tab is a full-width gallery: one question on top
     ("What are you building?") and two small filters in the toolbar
   - the other tabs have a filter column; within a group the chips
     mean "any of", across groups "all of", and the counts show what
     each chip would give
   - everything lives in the URL, so any view can be shared
   - cards render in pages as you scroll; fonts load only when a
     card is about to be seen
   - sample text is English. Another script is shown only when the
     visitor picks that language in the filters.
   ============================================================ */
import {
  loadData, esc, fmt, cssStack, useFont, nearestWeight, familyParam, gfURL,
  isRTL, SAMPLES, voiceCSS, groundCSS, comboCSS, kitPrompt, copyText, flash,
} from "./fh-core.js?v=20261005c";

const $ = (s, el = document) => el.querySelector(s);
const TABS = ["kits", "voices", "grounds", "fonts"];
const PAGE = { kits: 24, voices: 36, grounds: 36, fonts: 36 };
const MIXER = "/type-ground-mixer-pro";
const DEFAULT_ON = "G09"; // Paper Ledger: a quiet off-white, so the fonts do the talking

const CAT = { sans: "Sans serif", serif: "Serif", display: "Display", handwriting: "Handwriting", mono: "Monospace" };
const HUE = { red: "Red", orange: "Orange", yellow: "Yellow and gold", green: "Green", teal: "Teal", blue: "Blue", violet: "Violet", pink: "Pink", mono: "Black and gray" };
const HUE_ORDER = ["red", "orange", "yellow", "green", "teal", "blue", "violet", "pink", "mono"];
const GRADE = { AAA: "AAA contrast", AA: "AA contrast", "AA large": "AA for large text", Low: "Low contrast" };
const LATIN_LIKE = new Set(["cyrillic", "greek", "vietnamese"]);
const HUE_DOT = { red: "#D64545", orange: "#E8782A", yellow: "#E2B33C", green: "#3E9A5B", teal: "#1E9E94", blue: "#2F6FE4", violet: "#7A55D9", pink: "#D9479A", mono: "#2B2B2E" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The line under the page title, per tab.
const LEDE = {
  kits: "Pick what you're building and get a ready-made kit of fonts and colors, shown as a real website. Copy it into Claude, Cursor or your own CSS in one click.",
  voices: "Fonts for headings, text and labels that work well together. Filter by industry or mood, then add colors in the mixer.",
  grounds: "Background, text and accent colors, every set checked for readable contrast. Filter by mood or accent color, then add fonts in the mixer.",
  fonts: "Every Google font, free for commercial use. Type your own text, filter by style or mood, then see what each font pairs well with.",
};

// What a font card says until the visitor types their own text.
const SPECIMEN = {
  sans: "Book your first class today",
  serif: "A long lunch by the water",
  display: "Doors open at nine",
  handwriting: "Thank you for coming",
  mono: "total = price * 12",
};

// The small website each kit and pairing is shown as, by kind of business.
const SITE = {
  restaurant: { name: "Olive & Ember", links: ["Menu", "Hours", "Find us"], h: "Dinner is ready at seven", p: "Seasonal plates, a short wine list and a table by the window.", cta: "Book a table", alt: "See the menu", note: "Open tonight until 10 pm", link: "Get directions" },
  bakery: { name: "Crumb & Co", links: ["Bakes", "Cakes", "Visit"], h: "Fresh out of the oven", p: "Sourdough at seven, croissants at eight and something sweet all day.", cta: "Order a cake", alt: "Today's bakes", note: "Baking from 5 am, every day", link: "Find the shop" },
  grocery: { name: "Green Basket", links: ["Shop", "Specials", "Delivery"], h: "Picked this morning", p: "Local fruit, fresh bread and pantry staples at fair prices.", cta: "Start your order", alt: "This week's specials", note: "Free delivery over $60", link: "Check your area" },
  barber: { name: "North Street Barbers", links: ["Cuts", "Prices", "Book"], h: "Sharp cuts, no waiting", p: "Walk in, sit down and leave looking like yourself on a good day.", cta: "Book a chair", alt: "See prices", note: "Walk-ins welcome until 6 pm", link: "Meet the barbers" },
  beauty: { name: "Still Water Spa", links: ["Treatments", "Gift cards", "Book"], h: "Slow down for an hour", p: "Facials, massage and quiet rooms made for doing nothing.", cta: "Book a treatment", alt: "See treatments", note: "20% off your first visit", link: "How it works" },
  fitness: { name: "Ironworks Gym", links: ["Classes", "Coaches", "Join"], h: "Train like it counts", p: "Strength classes at six, morning and evening, coached in small groups.", cta: "Start a free week", alt: "See the timetable", note: "Next class starts at 6 pm", link: "Save a spot" },
  medical: { name: "Harbour Dental", links: ["Services", "Our team", "Contact"], h: "Care that explains itself", p: "Same-week appointments, clear advice and follow-ups that happen.", cta: "Book an appointment", alt: "Our services", note: "New patients welcome", link: "Call the clinic" },
  finance: { name: "Marlow & Finch", links: ["Services", "About", "Contact"], h: "Plain advice, on time", p: "Tax returns, business accounts and straight answers in writing.", cta: "Book a call", alt: "What we do", note: "Tax returns from $180", link: "See all fees" },
  realestate: { name: "Fernhill Property", links: ["Buy", "Rent", "Sell"], h: "Homes worth slowing down for", p: "Three bedrooms, north light and a garden that gets the afternoon sun.", cta: "View listings", alt: "Get an appraisal", note: "Open home Saturday at 11 am", link: "See the address" },
  trades: { name: "Redgum Builders", links: ["Services", "Projects", "Quote"], h: "Built right the first time", p: "Licensed builders for renovations, extensions and repairs.", cta: "Get a free quote", alt: "Recent projects", note: "Fully licensed and insured", link: "Read our reviews" },
  automotive: { name: "Apex Auto Care", links: ["Servicing", "Tires", "Book"], h: "Serviced and ready by five", p: "Scheduled servicing, tires and brakes with a fixed-price quote.", cta: "Book a service", alt: "Get a quote", note: "Loan car available", link: "Ask about it" },
  tech: { name: "Relay", links: ["Product", "Pricing", "Docs"], h: "Ship the update tonight", p: "Preview every change, then roll it out with one click.", cta: "Start free", alt: "Read the docs", note: "New: instant rollbacks", link: "See the changelog" },
  education: { name: "Brightside Tutoring", links: ["Subjects", "Tutors", "Pricing"], h: "Learn it properly", p: "Small classes, patient tutors and progress you can see each week.", cta: "Book a trial lesson", alt: "See subjects", note: "Enrollments open for next term", link: "Check availability" },
  kids: { name: "Little Acorns", links: ["Playgroups", "Parties", "Visit"], h: "Big days for small people", p: "Play, paint and make a mess, then go home tired and happy.", cta: "Book a visit", alt: "Party packages", note: "Open 9 to 3 on weekdays", link: "Plan your visit" },
  wedding: { name: "Hazel & June", links: ["Weddings", "Gallery", "Enquire"], h: "Save the date", p: "A long lunch, a short ceremony and dancing until late.", cta: "Check your date", alt: "See the gallery", note: "Booking now for next spring", link: "Send an enquiry" },
  fashion: { name: "Atelier Wren", links: ["New in", "Clothing", "Sale"], h: "The autumn edit", p: "Wool coats, soft knits and the trousers you will wear all season.", cta: "Shop new arrivals", alt: "View the lookbook", note: "Free returns for 30 days", link: "How returns work" },
  art: { name: "Tidewater Gallery", links: ["Exhibitions", "Artists", "Visit"], h: "New work, opening Friday", p: "Twelve paintings about light, water and the hour before dark.", cta: "Plan your visit", alt: "See the artists", note: "Free entry, Wednesday to Sunday", link: "Opening hours" },
  nightlife: { name: "The Low End", links: ["Line-up", "Tickets", "Venue"], h: "Doors at nine", p: "Live sets all night, two rooms and one very loud speaker stack.", cta: "Get tickets", alt: "See the line-up", note: "This Saturday is almost sold out", link: "Join the waitlist" },
  travel: { name: "Saltwater Stays", links: ["Rooms", "Things to do", "Book"], h: "Wake up near the water", p: "Rooms with sea views, slow breakfasts and bikes at the door.", cta: "Check availability", alt: "See the rooms", note: "Stay three nights, pay for two", link: "View the offer" },
  community: { name: "Open Table", links: ["What we do", "Volunteer", "Donate"], h: "Help is close by", p: "Free meals on Tuesdays, homework club on Thursdays, everyone welcome.", cta: "Volunteer with us", alt: "Make a donation", note: "Next community dinner is Tuesday at 6 pm", link: "Find the hall" },
  agency: { name: "Northbeam Studio", links: ["Work", "Services", "Contact"], h: "We design the hard parts", p: "Brand, product and front-end for teams shipping their first big thing.", cta: "Start a project", alt: "See our work", note: "Booking projects for March", link: "Check our availability" },
  publishing: { name: "The Weekender", links: ["Latest", "Essays", "Subscribe"], h: "The long read", p: "A weekly letter about cities, food and the people who keep them running.", cta: "Subscribe free", alt: "Read this week's issue", note: "12,000 readers every Sunday", link: "Read past issues" },
  gaming: { name: "Emberfall", links: ["Game", "News", "Play"], h: "Season two is live", p: "New maps, a ranked ladder and a boss nobody has beaten yet.", cta: "Play free", alt: "Watch the trailer", note: "Patch 2.1 is out now", link: "Read the notes" },
  portfolio: { name: "Sam Rivera", links: ["Work", "About", "Contact"], h: "Hi, I make things", p: "Designer and developer, building tools for small businesses.", cta: "See my work", alt: "Get in touch", note: "Available for projects from June", link: "Email me" },
  _: { name: "Northbeam", links: ["Work", "About", "Contact"], h: "Make something people remember", p: "A clear headline, text that is easy to read and one button that stands out.", cta: "Get started", alt: "Learn more", note: "New this week", link: "See what changed" },
};
// When no kind of business is picked, kits are dealt out in this order so the
// first screen shows the range instead of 24 restaurants.
const DEAL = ["restaurant", "finance", "wedding", "publishing", "beauty", "tech", "travel", "bakery", "realestate", "fashion", "gaming", "fitness",
  "education", "community", "grocery", "trades", "art", "portfolio", "medical", "kids", "agency", "barber", "automotive", "nightlife"];

let META, FONTS, VOICES, GROUNDS, KITS, IDX, GIDX, KIDX, IND, LANG, D;

/* ---------- state (mirrored in the URL) ---------- */
const state = {
  tab: "kits",
  q: "",
  sel: {},          // facet key -> Set of values
  tog: {},          // toggle key -> true
  sort: "",
  font: "",         // pairings: only pairings using this font
  text: "",         // fonts: custom preview text
  size: 34,         // fonts: specimen size
  on: DEFAULT_ON,   // pairings: color set to paint previews with
  shown: 0,
  list: [],
};
const hasSel = (key) => !!state.sel[key]?.size;
const pickedIndustry = (list) => [...(state.sel.ind || [])].find((i) => list.includes(i)) || list[0] || "_";
const pickedScript = (list) => [...(state.sel.lang || [])].find((l) => SAMPLES[l] && list.includes(l));
const scriptOnly = (v) => (v.lang || []).some((l) => !LATIN_LIKE.has(l));

/* ---------- tab definitions ---------- */
function defs() {
  const anyOf = (get) => (x, vals) => { const v = get(x); return [...vals].some((s) => (Array.isArray(v) ? v.includes(s) : v === s)); };
  const industries = META.industries.map((i) => [i.id, i.label]);
  const media = META.media.map((m) => [m.id, m.label]);
  const tone = [["light", "Light"], ["dark", "Dark"]];
  const hues = HUE_ORDER.filter((h) => META.hues.some((x) => x.id === h)).map((h) => [h, HUE[h]]);
  // Every kit knows its place in each list it belongs to (k.r, in the same
  // order as k.ind). With nothing picked, its first list decides.
  const place = (k) => k.r?.[Math.max(0, k.ind.indexOf([...(state.sel.ind || [])][0]))] ?? 99;
  const best = (a, b) => place(a) - place(b) || (b.pick || 0) - (a.pick || 0) || a.n - b.n;
  return {
    kits: {
      noun: ["kit", "kits"],
      items: () => KITS,
      wide: true, // no filter column: the gallery gets the full width
      hay: () => "",
      facets: [
        { key: "ind", label: "What are you building?", opts: industries, test: anyOf((k) => k.ind), top: true, single: true },
        { key: "tone", label: "Light or dark", opts: tone, test: (k, vals) => vals.has(k.G.tokens.dark ? "dark" : "light"), bar: true, single: true },
        { key: "hue", label: "Accent color", short: "Accent", opts: hues, test: anyOf((k) => k.G.hue), bar: true, dots: true },
      ],
      toggles: [],
      sorts: [["best", "Best match"]],
      sortFn: { best },
      // With nothing picked, deal one kit per kind of business in turn and
      // keep dark kits apart, so the first screen shows the range.
      arrange: (list, key) => (key === "best" && !hasSel("ind") ? spaceDark(deal(list)) : list),
      base: () => true,
    },
    voices: {
      noun: ["font pairing", "font pairings"],
      items: () => VOICES,
      hay: (v) => [v.name, v.d, v.b, v.u, v.vibe, v.mood.join(" "), v.ind.map((i) => IND[i] || i).join(" ")].join(" ").toLowerCase(),
      facets: [
        { key: "ind", label: "Industry", opts: industries, test: anyOf((v) => v.ind), fold: 12 },
        { key: "m", label: "Mood", opts: META.voiceMoods.map((o) => [o.id, cap(o.id)]), test: anyOf((v) => v.mood), fold: 12 },
        { key: "media", label: "Made for", opts: media, test: anyOf((v) => v.media) },
        { key: "lang", label: "Language", opts: langOptions(VOICES), test: anyOf((v) => v.lang), fold: 8, note: "Pairings made for another script show sample text in that script." },
      ],
      toggles: [{ key: "cur", label: "Hand-picked only", test: (v) => !!v.curated }],
      sorts: [["best", "Hand-picked first"], ["score", "Best match"], ["az", "A to Z"]],
      sortFn: {
        best: (a, b) => (b.curated || 0) - (a.curated || 0) || (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name),
        score: (a, b) => (b.score ?? 101) - (a.score ?? 101) || a.name.localeCompare(b.name),
        az: (a, b) => a.name.localeCompare(b.name),
      },
      // Pairings made for another script stay out of the way until that
      // language is picked (or a font that only they use is being followed).
      base: (v, skip) => (!state.font || v.d === state.font || v.b === state.font)
        && (!scriptOnly(v) || skip === "lang" || hasSel("lang") || !!state.font),
    },
    grounds: {
      noun: ["color set", "color sets"],
      items: () => GROUNDS,
      hay: (g) => [g.name, g.vibe, HUE[g.hue] || g.hue, g.mood.join(" "), g.ind.map((i) => IND[i] || i).join(" "), g.grade, g.tokens.dark ? "dark" : "light"].join(" ").toLowerCase(),
      facets: [
        { key: "tone", label: "Light or dark", opts: tone, test: (g, vals) => vals.has(g.tokens.dark ? "dark" : "light") },
        { key: "hue", label: "Accent color", opts: hues, test: anyOf((g) => g.hue) },
        { key: "m", label: "Mood", opts: META.groundMoods.map((o) => [o.id, cap(o.id)]), test: anyOf((g) => g.mood) },
        { key: "ind", label: "Industry", opts: industries, test: anyOf((g) => g.ind), fold: 12 },
        { key: "media", label: "Made for", opts: media, test: anyOf((g) => g.media) },
        { key: "grade", label: "Contrast", opts: [["AAA", "AAA"], ["AA", "AA"], ["AA large", "AA for large text"]], test: anyOf((g) => g.grade) },
      ],
      toggles: [{ key: "cur", label: "Hand-picked only", test: (g) => !!g.curated }],
      sorts: [["best", "Hand-picked first"], ["light", "Lightest first"], ["dark", "Darkest first"], ["hue", "By color"]],
      sortFn: {
        best: (a, b) => (b.curated || 0) - (a.curated || 0) || a.id.localeCompare(b.id, undefined, { numeric: true }),
        light: (a, b) => lum(b.tokens.bgHex) - lum(a.tokens.bgHex),
        dark: (a, b) => lum(a.tokens.bgHex) - lum(b.tokens.bgHex),
        hue: (a, b) => HUE_ORDER.indexOf(a.hue) - HUE_ORDER.indexOf(b.hue) || lum(b.tokens.bgHex) - lum(a.tokens.bgHex),
      },
      base: () => true,
    },
    fonts: {
      noun: ["font", "fonts"],
      items: () => FONTS,
      hay: (f) => [f.n, CAT[f.c], f.st, Object.keys(f.m || {}).join(" "), f.ds, (f.th || []).join(" ")].join(" ").toLowerCase(),
      facets: [
        { key: "c", label: "Category", opts: META.fontCategories.map((o) => [o.id, CAT[o.id] || o.id]), test: anyOf((f) => f.c) },
        { key: "st", label: "Style", opts: META.fontStyles.map((o) => [o.id, o.id]), test: anyOf((f) => f.st), fold: 10 },
        { key: "m", label: "Mood", opts: META.fontMoods.map((o) => [o.id, cap(o.id)]), test: (f, vals) => [...vals].some((m) => (f.m?.[m] || 0) >= 40), fold: 12 },
        { key: "lang", label: "Language", opts: LANG.map((l) => [l.id, l.label]), test: (f, vals) => [...vals].every((l) => f.sub.includes(l)), fold: 8, note: "Shows fonts that support every language you pick, with sample text in that language." },
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
      // A font with no Latin letters cannot show English sample text, so it
      // waits until its language is picked.
      base: (f, skip) => (state.tog.sp || !f.sp) && (f.sub.includes("latin") || skip === "lang" || hasSel("lang")),
    },
  };
}
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
// One kit per kind of business in turn.
function deal(list) {
  const groups = new Map();
  for (const k of list) {
    if (!groups.has(k.ind[0])) groups.set(k.ind[0], []);
    groups.get(k.ind[0]).push(k);
  }
  const order = [...DEAL.filter((id) => groups.has(id)), ...[...groups.keys()].filter((id) => !DEAL.includes(id))];
  // Skip a kit whose colors were shown a moment ago, so neighbours differ.
  const out = [], recent = [];
  while (out.length < list.length) {
    for (const id of order) {
      const group = groups.get(id);
      if (!group.length) continue;
      // Look a few places down the list, but do not swap a light kit for a dark one.
      const i = Math.max(0, group.slice(0, 4).findIndex((k) => !recent.includes(k.g) && (!k.G.tokens.dark || group[0].G.tokens.dark)));
      const [k] = group.splice(i, 1);
      out.push(k);
      recent.push(k.g);
      if (recent.length > 12) recent.shift();
    }
  }
  return out;
}
// At most one dark kit in every four, for as long as there are light ones left.
function spaceDark(list) {
  const out = [], held = [];
  let since = 0;
  for (const k of list) {
    if (k.G.tokens.dark) held.push(k);
    else { out.push(k); since++; }
    if (held.length && since >= 3) { out.push(held.shift()); since = 0; }
  }
  return out.concat(held);
}

/* ---------- URL <-> state ---------- */
function readURL() {
  const p = new URLSearchParams(location.search);
  state.tab = TABS.includes(p.get("tab")) ? p.get("tab") : "kits";
  state.q = D[state.tab].wide ? "" : p.get("q") || "";
  state.sort = p.get("sort") || "";
  state.font = p.get("font") || "";
  state.text = p.get("text") || "";
  state.size = Math.min(72, Math.max(16, Number(p.get("size")) || 34));
  state.on = GIDX.has(p.get("on")) ? p.get("on") : DEFAULT_ON;
  state.sel = {};
  state.tog = {};
  for (const f of D[state.tab].facets) {
    if (!p.get(f.key)) continue;
    const known = new Set(f.opts.map(([id]) => id));
    const vals = p.get(f.key).split(",").filter((v) => known.has(v));
    if (vals.length) state.sel[f.key] = new Set(f.single ? vals.slice(0, 1) : vals);
  }
  for (const t of D[state.tab].toggles) if (p.get(t.key) === "1") state.tog[t.key] = true;
}
function writeURL() {
  const p = new URLSearchParams();
  if (state.tab !== "kits") p.set("tab", state.tab);
  if (state.q) p.set("q", state.q);
  for (const [k, v] of Object.entries(state.sel)) if (v.size) p.set(k, [...v].join(","));
  for (const [k, v] of Object.entries(state.tog)) if (v) p.set(k, "1");
  if (state.sort) p.set("sort", state.sort);
  if (state.tab === "voices" && state.font) p.set("font", state.font);
  if (state.tab === "voices" && state.on !== DEFAULT_ON) p.set("on", state.on);
  if (state.tab === "fonts" && state.text) p.set("text", state.text);
  if (state.tab === "fonts" && state.size !== 34) p.set("size", state.size);
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

/* ---------- filtering ---------- */
const hayCache = new WeakMap();
function matches(x, def, skipFacet) {
  if (!def.base(x, skipFacet)) return false;
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
const sortKeyOf = (def) => (state.sort && def.sortFn[state.sort] ? state.sort : def.sorts[0][0]);
function compute() {
  const def = D[state.tab];
  const key = sortKeyOf(def);
  const list = def.items().filter((x) => matches(x, def)).sort(def.sortFn[key]);
  state.list = def.arrange ? def.arrange(list, key) : list;
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
const chipHTML = (f, id, label, on, count) =>
  `<button class="chip" type="button" aria-pressed="${on}" data-facet="${f.key}" data-val="${esc(id)}">${esc(label)}${count == null ? "" : ` <span class="c">${fmt(count)}</span>`}</button>`;
// Toolbar filters: plain chips, or color dots for the accent color.
function barGroup(f) {
  const counts = facetCounts(f);
  const sel = state.sel[f.key] || new Set();
  const items = f.opts.map(([id, label]) => {
    const on = sel.has(id);
    const off = !on && !counts.get(id) ? "disabled" : "";
    return f.dots
      ? `<button class="dot" type="button" style="--dot:${HUE_DOT[id] || "#888"}" aria-label="${esc(label)}" title="${esc(label)}" aria-pressed="${on}" data-facet="${f.key}" data-val="${esc(id)}" ${off}></button>`
      : `<button class="chip" type="button" aria-pressed="${on}" data-facet="${f.key}" data-val="${esc(id)}" ${off}>${esc(label)}</button>`;
  }).join("");
  return `<div class="bar-group${f.dots ? " dots" : ""}" role="group" aria-label="${esc(f.label)}">${f.dots ? `<span class="bar-label">${esc(f.short || f.label)}</span>` : ""}${items}</div>`;
}

function renderFilters() {
  const def = D[state.tab];

  // The first question on the Kits tab sits above the results, not in the side column.
  const top = def.facets.find((f) => f.top);
  const box = $("#building");
  box.hidden = !top;
  if (top) {
    const sel = state.sel[top.key] || new Set();
    const keep = $(".chips", box)?.scrollLeft || 0;
    box.innerHTML = `<h2>${esc(top.label)}</h2><div class="chips">${top.opts.map(([id, label]) => chipHTML(top, id, label, sel.has(id))).join("")}</div>`;
    // On a phone the chips are one row that scrolls sideways: stay where the
    // visitor was, and make sure the chosen chip is in view.
    const row = $(".chips", box), on = $('.chip[aria-pressed="true"]', row);
    row.scrollLeft = keep;
    if (on && row.scrollWidth > row.clientWidth) {
      const a = on.getBoundingClientRect(), b = row.getBoundingClientRect();
      if (a.left < b.left + 16 || a.right > b.right - 16) row.scrollLeft += a.left - b.left - (b.width - a.width) / 2;
    }
  } else box.innerHTML = "";

  $("#bar").innerHTML = def.facets.filter((f) => f.bar).map(barGroup).join("");

  const html = [];
  for (const f of def.facets) {
    if (f.top || f.bar) continue;
    const counts = facetCounts(f);
    const sel = state.sel[f.key] || new Set();
    const opts = f.opts.filter(([id]) => counts.get(id) > 0 || sel.has(id));
    if (!opts.length) continue;
    const folded = f.fold && !unfolded.has(state.tab + f.key) && opts.length > f.fold + 2;
    const visible = folded ? opts.filter(([id], i) => i < f.fold || sel.has(id)) : opts;
    html.push(`<section class="facet"><h2>${esc(f.label)}</h2><div class="chips">${visible.map(([id, label]) => chipHTML(f, id, label, sel.has(id), counts.get(id) || 0)).join("")}</div>${
      folded ? `<button class="show-all" type="button" data-unfold="${f.key}">Show all ${opts.length}</button>` : ""}${
      f.note && sel.size ? `<p class="facts facet-note">${esc(f.note)}</p>` : ""}</section>`);
  }
  if (def.toggles.length) {
    html.push(`<div class="toggles">${def.toggles.map((t) =>
      `<label class="toggle"><input type="checkbox" data-tog="${t.key}" ${state.tog[t.key] ? "checked" : ""}> ${esc(t.label)}</label>`).join("")}</div>`);
  }
  $("#facets").innerHTML = html.join("");

  const inDrawer = def.facets.filter((f) => !f.top && !f.bar).reduce((n, f) => n + (state.sel[f.key]?.size || 0), 0) + Object.values(state.tog).filter(Boolean).length;
  $("#active-count").textContent = inDrawer ? `(${inDrawer})` : "";
  $("#clear").hidden = !inDrawer && !state.font && !state.q;
}

/* ---------- rendering: toolbar ---------- */
function renderTools() {
  const def = D[state.tab];
  const key = sortKeyOf(def);
  let html = def.sorts.length < 2 ? "" : `<label class="field">Sort <select id="sort">${def.sorts.map(([k, l]) => `<option value="${k}" ${k === key ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  if (state.tab === "fonts") {
    html = `<label class="field"><span class="sr">Your own sample text</span><input type="text" id="ptext" placeholder="Type your own text" value="${esc(state.text)}"></label>
      <label class="field">Size <input type="range" id="psize" min="16" max="72" step="2" value="${state.size}"></label>` + html;
  }
  if (state.tab === "voices") {
    const opts = GROUNDS.filter((g) => g.curated).sort((a, b) => lum(b.tokens.bgHex) - lum(a.tokens.bgHex));
    html = `<label class="field">Show on <select id="pground">${opts.map((g) => `<option value="${g.id}" ${g.id === state.on ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>` + html;
  }
  $("#tools").innerHTML = html;
}

function renderResultLine() {
  const def = D[state.tab];
  const n = state.list.length;
  let line = `<b>${fmt(n)}</b> ${n === 1 ? def.noun[0] : def.noun[1]}`;
  const ind = state.tab === "kits" && [...(state.sel.ind || [])][0];
  if (ind) line += ` for ${esc(IND[ind] || ind)}`;
  if (state.tab === "kits" && def.facets.some((f) => hasSel(f.key))) line += ` <button class="clear-font" type="button" id="clear-all">Show all kits</button>`;
  if (state.tab === "voices" && state.font) line += ` using ${esc(state.font)} <button class="clear-font" type="button" id="clear-font">Show all font pairings</button>`;
  // Items made for another script wait behind the Language filter; say so.
  const waiting = hasSel("lang") ? 0 : def.items().filter((x) => !def.base(x) && matches(x, def, "lang")).length;
  if (waiting) line += `. <span class="more-note">${fmt(waiting)} more for other scripts under Language.</span>`;
  $("#result-line").innerHTML = line;
}

/* ---------- rendering: cards ---------- */
const fontObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    fontObserver.unobserve(e.target);
    for (const [f, ws] of e.target._fonts || []) useFont(f, ws);
  }
}, { rootMargin: "600px 0px" });

const stack = (f, name) => esc(cssStack(f, name));
const swatches = (t) => [["Background", t.bgHex], ["Cards", t.surface], ["Text", t.ink], ["Secondary text", t.muted], ["Accent", t.accent], ["Borders", t.border]]
  .map(([k, v]) => `<span style="background:${v}" title="${k} ${v}"></span>`).join("");
function gradeBadge(g) {
  const lowest = Math.min(g.cr.ink, g.cr.muted, g.cr.accent, g.cr.button);
  const weak = g.grade === "Low" || g.grade === "AA large";
  return `<span class="grade ${weak ? "low" : ""}" title="Lowest text contrast is ${lowest}:1. AA needs 4.5:1.">${esc(GRADE[g.grade] || g.grade)}</span>`;
}
function fontsLine(v) {
  const parts = v.d === v.b ? [`<b>${esc(v.d)}</b> for headings and text`] : [`<b>${esc(v.d)}</b> headings`, `<b>${esc(v.b)}</b> text`];
  if (v.u !== v.d && v.u !== v.b) parts.push(`<b>${esc(v.u)}</b> labels`);
  return parts.join(", ");
}
const mixerURL = (v, g, medium) => `${MIXER}?${new URLSearchParams({ medium: medium || "web", ...(v ? { voice: v.id } : {}), ...(g ? { ground: g.id } : {}) })}`;

function kitCard(k) {
  const v = k.V, g = k.G, t = g.tokens;
  const Df = IDX.get(v.d), Bf = IDX.get(v.b), Uf = IDX.get(v.u);
  const s = SITE[pickedIndustry(k.ind)] || SITE._;
  const dw = nearestWeight(Df, v.dw || 700);
  const r = Math.min(t.radius, 14);
  const el = document.createElement("article");
  el.className = "card kit-card";
  el.innerHTML = `
    <div class="site" aria-hidden="true" style="background:${t.bg};color:${t.ink};font-family:${stack(Bf, v.b)}">
      <div class="site-nav" style="border-color:${t.border}">
        <span class="site-logo" style="font-family:${stack(Df, v.d)};font-weight:${dw}">${esc(s.name)}</span>
        <span class="site-links" style="font-family:${stack(Uf, v.u)};color:${t.muted}">${s.links.map((l) => `<span>${esc(l)}</span>`).join("")}</span>
      </div>
      <div class="site-hero">
        <p class="site-h" style="font-family:${stack(Df, v.d)};font-weight:${dw}">${esc(s.h)}</p>
        <p class="site-p" style="color:${t.muted}">${esc(s.p)}</p>
        <div class="site-btns" style="font-family:${stack(Uf, v.u)}">
          <span class="site-btn" style="background:${t.accent};color:${t.accentInk};border-radius:${t.radius}px">${esc(s.cta)}</span>
          <span class="site-btn" style="border-color:${t.border};border-radius:${t.radius}px">${esc(s.alt)}</span>
        </div>
      </div>
      <div class="site-strip" style="background:${t.surface};border-color:${t.border};border-radius:${r}px">
        <span>${esc(s.note)}</span>
        <span class="site-a" style="color:${t.accent}">${esc(s.link)}</span>
      </div>
    </div>
    <div class="meta">
      <div class="row"><h3 class="nm">${esc(v.name)} on ${esc(g.name)}</h3>${k.pick ? '<span class="pick">Our pick</span>' : ""}</div>
      <p class="fonts-used">${fontsLine(v)}</p>
      <div class="row mid"><div class="swatches">${swatches(t)}</div>${gradeBadge(g)}</div>
      <ul class="tags">${k.ind.slice(0, 3).map((i) => `<li class="ind">${esc(IND[i] || i)}</li>`).join("")}<li>${t.dark ? "Dark" : "Light"}</li></ul>
    </div>
    <div class="acts">
      <button class="act primary" type="button" data-act="kit-ai" data-id="${esc(k.id)}">Copy for AI</button>
      <button class="act" type="button" data-act="kit-css" data-id="${esc(k.id)}">Copy CSS</button>
      <a class="act" href="${esc(mixerURL(v, g, k.media[0]))}">Customize</a>
    </div>`;
  el._fonts = [[Df, [dw]], [Bf, [400]], [Uf, [400, 700]]];
  return el;
}

function voiceCard(v) {
  const Df = IDX.get(v.d), Bf = IDX.get(v.b), Uf = IDX.get(v.u);
  const g = GIDX.get(state.on) || GIDX.get(DEFAULT_ON) || GROUNDS[0];
  const t = g.tokens;
  const dw = nearestWeight(Df, v.dw || 700);
  // English copy unless the visitor asked for a language this pairing was made for.
  const script = pickedScript(v.lang || []);
  const s = SITE[pickedIndustry(v.ind)] || SITE._;
  const small = script ? (LANG.find((l) => l.id === script) || {}).label || cap(script) : s.note;
  const head = script ? SAMPLES[script] : s.h;
  const body = script ? `${SAMPLES[script]} ${SAMPLES[script]}` : s.p;
  const el = document.createElement("article");
  el.className = "card voice-card";
  el.innerHTML = `
    <div class="pv" aria-hidden="true" style="background:${t.bg};color:${t.ink}">
      <p class="pv-k" style="font-family:${stack(Uf, v.u)};color:${t.accent}">${esc(small)}</p>
      <p class="pv-h" ${script ? 'dir="auto"' : ""} style="font-family:${stack(Df, v.d)};font-weight:${dw}">${esc(head)}</p>
      <p class="pv-b" ${script ? 'dir="auto"' : ""} style="font-family:${stack(Bf, v.b)};color:${t.muted}">${esc(body)}</p>
      ${script ? "" : `<span class="pv-btn" style="background:${t.accent};color:${t.accentInk};border-radius:${t.radius}px;font-family:${stack(Uf, v.u)}">${esc(s.cta)}</span>`}
    </div>
    <div class="meta">
      <div class="row"><h3 class="nm">${esc(v.name)}</h3>${v.curated ? '<span class="pick">Hand-picked</span>' : ""}</div>
      <p class="vibe">${esc(cap(v.vibe))}</p>
      <p class="fonts-used">${fontsLine(v)}</p>
      <ul class="tags">${v.ind.slice(0, 3).map((i) => `<li class="ind">${esc(IND[i] || i)}</li>`).join("")}${v.mood.slice(0, 2).map((m) => `<li>${esc(cap(m))}</li>`).join("")}</ul>
    </div>
    <div class="acts">
      <a class="act primary" href="${esc(mixerURL(v, g, v.media[0]))}">Add colors</a>
      <button class="act" type="button" data-act="copy-voice" data-id="${esc(v.id)}">Copy CSS</button>
    </div>`;
  el._fonts = [[Df, [dw]], [Bf, [400]], [Uf, [400, 700]]];
  return el;
}

function groundCard(g) {
  const t = g.tokens;
  const el = document.createElement("article");
  el.className = "card ground-card";
  el.innerHTML = `
    <div class="gv" aria-hidden="true" style="background:${t.bg}">
      <div class="gv-card" style="background:${t.surface};border-color:${t.border};border-radius:${t.radius}px;color:${t.ink}">
        <p class="gv-h">Main text looks like this</p>
        <p class="gv-m" style="color:${t.muted}">Secondary text, for details and captions.</p>
        <div class="gv-row"><span class="gv-btn" style="background:${t.accent};color:${t.accentInk};border-radius:${Math.min(t.radius, 12)}px">Button</span><span class="gv-a" style="color:${t.accent}">A link</span></div>
      </div>
    </div>
    <div class="meta">
      <div class="row"><h3 class="nm">${esc(g.name)}</h3>${gradeBadge(g)}</div>
      <p class="vibe">${esc(cap(g.vibe))}. ${t.dark ? "Dark" : "Light"}, ${t.radius ? t.radius + "px corners" : "square corners"}.</p>
      <div class="swatches">${swatches(t)}</div>
      <ul class="tags">${g.ind.slice(0, 3).map((i) => `<li class="ind">${esc(IND[i] || i)}</li>`).join("")}${g.mood.slice(0, 2).map((m) => `<li>${esc(cap(m))}</li>`).join("")}</ul>
    </div>
    <div class="acts">
      <a class="act primary" href="${esc(mixerURL(null, g, g.media[0]))}">Add fonts</a>
      <button class="act" type="button" data-act="copy-ground" data-id="${esc(g.id)}">Copy CSS</button>
    </div>`;
  return el;
}

// English unless the visitor typed their own text or picked a language.
function fontSample(f) {
  if (state.text) return state.text;
  const script = pickedScript(f.sub);
  return script ? SAMPLES[script] : SPECIMEN[f.c] || SPECIMEN.sans;
}
function fontCard(f) {
  const weights = f.ax?.wght ? "variable weight" : `${f.w.length} weight${f.w.length > 1 ? "s" : ""}`;
  const facts = [f.st && f.st !== "Monospace" ? f.st : CAT[f.c] || f.c, weights, f.it ? "italics" : ""].filter(Boolean).join(", ");
  const langs = f.sub.filter((s) => LANG.some((l) => l.id === s));
  const names = [f.sub.includes("latin") ? "Latin" : "", ...langs.map((s) => LANG.find((l) => l.id === s).label)].filter(Boolean);
  const langLabel = names.length > 4 ? `${names[0]} and ${names.length - 1} more scripts` : names.join(", ") || "Latin";
  const moods = Object.keys(f.m || {}).slice(0, 3);
  const el = document.createElement("article");
  el.className = "card font-card";
  el.innerHTML = `
    <div class="spec" aria-hidden="true"><p dir="auto" style="font-family:${stack(f)};font-weight:${nearestWeight(f, 400)}">${esc(fontSample(f))}</p></div>
    <div class="meta">
      <div class="row"><h3 class="nm">${esc(f.n)}</h3>${f.f ? '<span class="featured">Featured</span>' : ""}</div>
      <p class="facts">${esc(cap(facts))}</p>
      <p class="langs">${esc(langLabel)}${f.ds ? `. By ${esc(f.ds.split(",").slice(0, 2).join(","))}` : ""}</p>
      ${moods.length ? `<ul class="tags">${moods.map((m) => `<li>${esc(cap(m))}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="acts">
      <button class="act primary" type="button" data-act="pair" data-font="${esc(f.n)}">See pairings</button>
      <button class="act" type="button" data-act="copy-font" data-font="${esc(f.n)}">Copy CSS</button>
      <a class="act" href="https://fonts.google.com/specimen/${encodeURIComponent(f.n).replace(/%20/g, "+")}" target="_blank" rel="noopener">Google Fonts</a>
    </div>`;
  el._font = f;
  el._fonts = [[f, [400]]];
  return el;
}

const CARD = { kits: kitCard, voices: voiceCard, grounds: groundCard, fonts: fontCard };
function renderPage() {
  const frag = document.createDocumentFragment();
  const next = state.list.slice(state.shown, state.shown + PAGE[state.tab]);
  for (const x of next) {
    const el = CARD[state.tab](x);
    frag.appendChild(el);
    if (el._fonts) fontObserver.observe(el);
  }
  $("#results").appendChild(frag);
  state.shown += next.length;
}
function renderResults() {
  const box = $("#results");
  box.className = "results " + state.tab;
  box.style.setProperty("--spec-size", state.size + "px");
  box.innerHTML = "";
  state.shown = 0;
  const empty = $("#empty");
  if (state.list.length) {
    empty.hidden = true;
    renderPage();
    return;
  }
  const noun = D[state.tab].noun[1];
  empty.innerHTML = state.tab === "voices" && state.font
    ? `<b>No ready-made font pairings use ${esc(state.font)} yet.</b>Try a similar font, or open the mixer and build your own.<br><button type="button" id="empty-clear">Show all font pairings</button>`
    : `<b>No ${noun} match these filters.</b>Remove a filter or try a shorter search.<br><button type="button" id="empty-clear">Clear filters</button>`;
  empty.hidden = false;
}

function renderTabs() {
  for (const b of document.querySelectorAll(".tab")) {
    const on = b.dataset.tab === state.tab;
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;
  }
  $("#results").setAttribute("aria-labelledby", "tab-" + state.tab);
  $("#lede").textContent = LEDE[state.tab];
  $(".lib").classList.toggle("wide", !!D[state.tab].wide);
  $("#q").placeholder = { kits: "Search kits", voices: "Search font pairings", grounds: "Search colors", fonts: "Search fonts" }[state.tab];
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
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}
function clearAll() {
  state.sel = {}; state.tog = {}; state.q = ""; state.font = "";
  $("#q").value = "";
  render();
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
  // Coming from far down a list (a font card's "See pairings"), go back up to the tabs.
  const top = $(".tabs").getBoundingClientRect().top + window.scrollY - 76;
  if (window.scrollY > top) window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
function onChip(e) {
  const chip = e.target.closest("[data-facet][data-val]");
  if (!chip || chip.disabled) return false;
  const { facet, val } = chip.dataset;
  const def = D[state.tab].facets.find((f) => f.key === facet);
  const set = state.sel[facet] || (state.sel[facet] = new Set());
  if (def?.single) { const had = set.has(val); set.clear(); if (!had) set.add(val); }
  else if (set.has(val)) set.delete(val);
  else set.add(val);
  render({ tools: false });
  // The chips were redrawn, so hand keyboard focus back to the one that was pressed.
  [...document.querySelectorAll(`[data-facet="${facet}"]`)].find((c) => c.dataset.val === val)?.focus({ preventScroll: true });
  return true;
}

function bind() {
  $(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b && b.dataset.tab !== state.tab) switchTab(b.dataset.tab);
  });
  $(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = (TABS.indexOf(state.tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    switchTab(TABS[i]);
    $(`.tab[data-tab="${TABS[i]}"]`).focus();
  });

  let qTimer;
  $("#q").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value.trim(); render({ tools: false }); }, 160);
  });

  $("#building").addEventListener("click", onChip);
  $("#bar").addEventListener("click", onChip);
  $("#facets").addEventListener("click", (e) => {
    if (onChip(e)) return;
    const more = e.target.closest("[data-unfold]");
    if (more) { unfolded.add(state.tab + more.dataset.unfold); renderFilters(); }
  });
  $("#facets").addEventListener("change", (e) => {
    const t = e.target.closest("[data-tog]");
    if (!t) return;
    state.tog[t.dataset.tog] = t.checked;
    render({ tools: false });
  });
  $("#clear").addEventListener("click", clearAll);

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
        for (const card of document.querySelectorAll(".font-card")) $(".spec p", card).textContent = fontSample(card._font);
        writeURL();
      }, 120);
    }
  });

  $("#result-line").addEventListener("click", (e) => {
    if (e.target.id === "clear-font") { state.font = ""; render(); }
    if (e.target.id === "clear-all") clearAll();
  });
  $("#empty").addEventListener("click", (e) => { if (e.target.id === "empty-clear") clearAll(); });

  $("#results").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "pair") { switchTab("voices", { font: b.dataset.font }); return; }
    let text = "";
    let said = "CSS copied. Paste it into your stylesheet.";
    if (act === "kit-ai" || act === "kit-css") {
      const k = KIDX.get(b.dataset.id);
      const label = IND[pickedIndustry(k.ind)] || "";
      if (act === "kit-ai") {
        text = kitPrompt(k.V, k.G, IDX, label);
        said = "Copied. Paste it at the top of your prompt in Claude, Cursor or v0.";
      } else text = comboCSS(k.V, k.G, label, IDX);
    }
    if (act === "copy-font") {
      const f = IDX.get(b.dataset.font);
      text = `/* ${f.n} (FontHabibi) */\n@import url('${gfURL([familyParam(f, f.ax?.wght ? [400, 700] : f.w.slice(0, 6), true)])}');\n\nfont-family: ${cssStack(f)};\n`;
    }
    if (act === "copy-voice") text = voiceCSS(VOICES.find((v) => v.id === b.dataset.id), IDX);
    if (act === "copy-ground") text = groundCSS(GIDX.get(b.dataset.id));
    await copyText(text);
    flash(b, "Copied");
    toast(said);
  });

  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && state.shown < state.list.length) renderPage();
  }, { rootMargin: "900px 0px" }).observe($("#more"));
}

/* ---------- start ---------- */
async function start() {
  let kits;
  try {
    const [meta, fonts, voices, grounds, k] = await Promise.all(["meta", "fonts", "voices", "grounds", "kits"].map(loadData));
    META = meta;
    FONTS = fonts.fonts;
    VOICES = voices.voices;
    GROUNDS = grounds.grounds;
    kits = k.kits;
  } catch (err) {
    $("#results").innerHTML = `<div class="empty"><b>The library could not load.</b>Check your connection and reload the page.</div>`;
    return;
  }
  IDX = new Map(FONTS.map((f) => [f.n, f]));
  GIDX = new Map(GROUNDS.map((g) => [g.id, g]));
  const vIdx = new Map(VOICES.map((v) => [v.id, v]));
  KITS = kits.map((k, n) => ({ ...k, n, V: vIdx.get(k.v), G: GIDX.get(k.g) })).filter((k) => k.V && k.G);
  KIDX = new Map(KITS.map((k) => [k.id, k]));
  IND = Object.fromEntries(META.industries.map((i) => [i.id, i.label]));
  LANG = META.languages.filter((l) => l.id !== "latin" && l.id !== "latin-ext");
  D = defs();

  const c = META.counts;
  const counts = { kits: KITS.length, voices: c.voices, grounds: c.grounds, fonts: c.fonts };
  for (const [tab, n] of Object.entries(counts)) $(`[data-count="${tab}"]`).textContent = fmt(n);

  if (window.matchMedia("(max-width: 900px)").matches) $("#drawer").open = false;
  readURL();
  $("#q").value = state.q;
  bind();
  render();
}
start();
