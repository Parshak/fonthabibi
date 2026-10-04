/* ============================================================
   The mixer
   Any font pairing on any color set, previewed as a real page.
   - the hand-picked pairings and color sets for each kind of page
   - anything from the library can be opened here with
     ?voice=F123&ground=G150&medium=web
   - fonts load only when they are needed
   - saved combinations are kept in this browser
   In the code a font pairing is a "voice" and a color set is a
   "ground"; those are the names used in the data files.
   ============================================================ */
import { loadData, esc, fmt, cssStack, useFont, comboCSS, kitPrompt, copyText, download, flash, store, slug } from "./fh-core.js?v=20261005b";

const $ = (id) => document.getElementById(id);
const px = (n) => n + "px";
const SAVE_KEY = "fh-saved-v1";

let IDX, CATS, TYPES, GROUNDS, VALL, GALL, META;
let curCat = "web";
const SEL = {};
let gFilter = "all";
let SAVED = [];
const EXTRA = { voice: null, ground: null }; // items opened from the library

const F = (name) => IDX.get(name);
const css = (name) => cssStack(F(name), name);
const isExtra = (x) => x && (x === EXTRA.voice || x === EXTRA.ground);
const typesFor = (c) => {
  const list = TYPES.filter((t) => t.media.includes(c));
  return EXTRA.voice && !list.includes(EXTRA.voice) ? [EXTRA.voice, ...list] : list;
};
const groundsFor = (c) => {
  const list = GROUNDS.filter((g) => g.media.includes(c));
  return EXTRA.ground && !list.includes(EXTRA.ground) ? [EXTRA.ground, ...list] : list;
};
const curType = () => VALL.get(SEL[curCat].f);
const curGround = () => GALL.get(SEL[curCat].g);
const catLabel = (id) => (CATS.find((c) => c.id === id) || {}).label || id;

function loadVoiceFonts(v, full) {
  useFont(F(v.d), full ? [v.dw, 400] : [v.dw]);
  if (full) { useFont(F(v.b), [400, 600, 700]); useFont(F(v.u), [400, 700]); }
}

/* ═══════════════ Preview builders ═══════════════ */
function ctx(ty, gr) {
  const t = gr.tokens;
  return { t, D: css(ty.d), B: css(ty.b), U: css(ty.u), DWt: ty.dw, r: t.radius, dim: t.dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.045)" };
}
function btn(c, label, ghost) {
  const s = ghost ? `background:transparent;color:${c.t.ink};border:1px solid ${c.t.border};`
    : `background:${c.t.accent};color:${c.t.accentInk};border:1px solid transparent;`;
  return `<span style="display:inline-block;${s}font-family:${c.U};font-size:12.5px;font-weight:700;letter-spacing:.03em;padding:10px 18px;border-radius:${px(c.r)};">${label}</span>`;
}

function pWeb(ty, gr) { const c = ctx(ty, gr), { t, D, B, U, r, DWt } = c; return `
<div style="background:${t.bg};color:${t.ink};font-family:${B};min-height:520px;padding:26px clamp(20px,4vw,54px) 40px;display:flex;flex-direction:column;">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
    <span style="font-family:${U};font-weight:700;font-size:13.5px;letter-spacing:.10em;text-transform:uppercase;">Northbeam</span>
    <div style="display:flex;gap:20px;align-items:center;font-size:13.5px;color:${t.muted};flex-wrap:wrap;"><span>Work</span><span>About</span><span>Journal</span>${btn(c, "Start a project")}</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:52px 0 40px;max-width:780px;">
    <span style="font-family:${U};font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:${t.accent};">Design &amp; build studio</span>
    <h2 style="font-family:${D};font-weight:${DWt};font-size:clamp(34px,4.6vw,58px);line-height:1.06;letter-spacing:-0.01em;">We make small products feel inevitable.</h2>
    <p style="font-size:16px;line-height:1.65;color:${t.muted};max-width:52ch;">Strategy, identity and front-end for teams shipping their first real thing. Four projects a year, done properly.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">${btn(c, "See the work")}${btn(c, "How we price", true)}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
    ${["Identity", "Product sites", "Front-end"].map((s, i) => `
    <div style="background:${t.surface};border:1px solid ${t.border};border-radius:${px(r)};padding:16px 18px;">
      <div style="font-family:${U};font-size:11px;color:${t.muted};letter-spacing:.08em;">0${i + 1}</div>
      <div style="font-weight:600;font-size:14.5px;margin-top:6px;">${s}</div>
    </div>`).join("")}
  </div>
</div>`; }

function pApp(ty, gr) { const c = ctx(ty, gr), { t, D, B, U, r, dim, DWt } = c;
  const card = (k, v, s) => `<div style="background:${t.surface};border:1px solid ${t.border};border-radius:${px(Math.max(r, 10))};padding:14px 16px;">
    <div style="font-size:12px;color:${t.muted};">${k}</div>
    <div style="font-family:${D};font-weight:${DWt};font-size:26px;line-height:1.1;margin-top:4px;">${v}</div>
    <div style="font-family:${U};font-size:11px;color:${t.accent};margin-top:4px;">${s}</div></div>`;
  return `
<div style="min-height:520px;display:flex;align-items:center;justify-content:center;padding:30px;background:${t.dark ? "#0A0A0C" : "#E4E4E7"};">
  <div style="width:320px;max-width:100%;background:${t.bg};color:${t.ink};font-family:${B};border-radius:38px;border:1px solid ${t.border};box-shadow:0 24px 60px rgba(0,0,0,.28);overflow:hidden;">
    <div style="display:flex;justify-content:space-between;padding:12px 22px 0;font-family:${U};font-size:11px;color:${t.muted};"><span>9:41</span><span>●●●</span></div>
    <div style="padding:18px 20px 22px;display:flex;flex-direction:column;gap:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <h2 style="font-family:${D};font-weight:${DWt};font-size:24px;">Today</h2>
        <span style="font-family:${U};font-size:11px;color:${t.muted};">Tue 14</span>
      </div>
      ${card("Morning session", "24 min", "+6 vs last week")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${card("Streak", "12", "days")}${card("Focus", "86%", "on plan")}</div>
      <div style="background:${dim};border-radius:${px(Math.max(r, 10))};padding:13px 16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:${t.muted};">Evening wind-down</span>
        <span style="font-family:${U};font-size:11px;font-weight:700;color:${t.accent};">SET UP</span>
      </div>
      <div style="text-align:center;padding-top:2px;">${btn(c, "Start next session")}</div>
    </div>
    <div style="display:flex;justify-content:space-around;padding:12px 8px 16px;border-top:1px solid ${t.border};font-family:${U};font-size:10.5px;color:${t.muted};">
      <span style="color:${t.accent};font-weight:700;">Home</span><span>Plan</span><span>Stats</span><span>You</span>
    </div>
  </div>
</div>`; }

function pTool(ty, gr) { const c = ctx(ty, gr), { t, D, B, U, r, dim, DWt } = c;
  const rows = [["deploy-web-7f2", "Running", "2m 14s", "us-east"], ["batch-export", "Queued", "—", "eu-west"], ["nightly-sync", "Done", "41s", "us-east"], ["index-rebuild", "Failed", "1m 03s", "ap-south"]];
  const stC = (s) => s === "Running" ? t.accent : s === "Failed" ? "#D9534F" : s === "Done" ? (t.dark ? "#6FCF97" : "#2E7D4F") : t.muted;
  return `
<div style="background:${t.bg};color:${t.ink};font-family:${B};min-height:520px;display:grid;grid-template-columns:minmax(120px,190px) 1fr;">
  <div style="border-right:1px solid ${t.border};padding:16px 14px;display:flex;flex-direction:column;gap:4px;">
    <div style="font-family:${D};font-weight:${DWt};font-size:15px;padding:4px 8px 14px;">Relay<span style="color:${t.accent};">.</span></div>
    ${["Overview", "Jobs", "Pipelines", "Logs", "Settings"].map((s, i) => `
      <div style="padding:8px 10px;border-radius:${px(Math.max(r - 2, 4))};font-size:13px;${i === 1 ? `background:${dim};font-weight:600;color:${t.ink};` : `color:${t.muted};`}">${s}</div>`).join("")}
    <div style="margin-top:auto;font-family:${U};font-size:10.5px;color:${t.muted};padding:8px 10px;">v2.8.1 · connected</div>
  </div>
  <div style="padding:18px 22px;display:flex;flex-direction:column;gap:14px;min-width:0;overflow:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <h2 style="font-family:${D};font-weight:${DWt};font-size:19px;">Jobs</h2>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="font-family:${U};font-size:11px;color:${t.muted};border:1px solid ${t.border};border-radius:${px(Math.max(r - 2, 4))};padding:7px 12px;">Last 24h ▾</span>${btn(c, "New job")}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      ${[["Active", "7"], ["Queued", "12"], ["Failed · 24h", "1"]].map(([k, v]) => `
      <div style="background:${t.surface};border:1px solid ${t.border};border-radius:${px(r)};padding:12px 14px;">
        <div style="font-size:11.5px;color:${t.muted};">${k}</div>
        <div style="font-family:${U};font-weight:700;font-size:22px;margin-top:3px;">${v}</div>
      </div>`).join("")}
    </div>
    <div style="background:${t.surface};border:1px solid ${t.border};border-radius:${px(r)};overflow:hidden;min-width:420px;">
      <div style="display:grid;grid-template-columns:1.6fr 1fr .8fr .8fr;padding:9px 14px;font-family:${U};font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${t.muted};border-bottom:1px solid ${t.border};">
        <span>Job</span><span>Status</span><span>Duration</span><span>Region</span>
      </div>
      ${rows.map((rw) => `
      <div style="display:grid;grid-template-columns:1.6fr 1fr .8fr .8fr;padding:11px 14px;font-size:13px;border-bottom:1px solid ${t.border};align-items:center;">
        <span style="font-family:${U};font-size:12.5px;">${rw[0]}</span>
        <span style="color:${stC(rw[1])};font-weight:600;">${rw[1]}</span>
        <span style="font-family:${U};font-size:12px;color:${t.muted};">${rw[2]}</span>
        <span style="color:${t.muted};">${rw[3]}</span>
      </div>`).join("")}
    </div>
  </div>
</div>`; }

function pEdit(ty, gr) { const c = ctx(ty, gr), { t, D, B, U, r, DWt } = c; return `
<div style="background:${t.bg};color:${t.ink};font-family:${B};min-height:520px;padding:40px clamp(20px,6vw,80px) 48px;">
  <div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:20px;">
    <span style="font-family:${U};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${t.accent};">Field Notes · No. 14</span>
    <h2 style="font-family:${D};font-weight:${DWt};font-size:clamp(30px,4vw,44px);line-height:1.14;">The slow craft of naming things well</h2>
    <div style="display:flex;gap:14px;align-items:baseline;font-size:13px;color:${t.muted};flex-wrap:wrap;">
      <span style="font-weight:600;color:${t.ink};">Mara Ellison</span><span>·</span><span>11 min read</span><span>·</span><span>June 14</span>
    </div>
    <p style="font-size:17px;line-height:1.75;">A good name is the smallest possible design. It carries the whole idea in a breath, and when it lands, everything downstream — the interface, the docs, the way people talk about the work — gets easier to build.</p>
    <blockquote style="border-left:3px solid ${t.accent};padding:6px 0 6px 20px;font-family:${D};font-style:italic;font-size:20px;line-height:1.5;">“Naming is the first interface. Everything else is commentary.”</blockquote>
    <p style="font-size:17px;line-height:1.75;color:${t.muted};">The teams that struggle are rarely short on cleverness. They are short on patience — the willingness to sit with a bad name long enough to hear what the thing is actually <a style="color:${t.accent};text-decoration:underline;text-underline-offset:3px;">asking to be called</a>.</p>
    <div style="display:flex;gap:8px;padding-top:6px;flex-wrap:wrap;">
      ${["Craft", "Language", "Process"].map((s) => `<span style="font-family:${U};font-size:11px;color:${t.muted};border:1px solid ${t.border};border-radius:${px(Math.max(r, 4))};padding:6px 12px;">${s}</span>`).join("")}
    </div>
  </div>
</div>`; }

function pDocs(ty, gr) { const c = ctx(ty, gr), { t, D, B, U, r, dim, DWt } = c; return `
<div style="background:${t.bg};color:${t.ink};font-family:${B};min-height:520px;display:grid;grid-template-columns:minmax(130px,200px) 1fr;">
  <div style="border-right:1px solid ${t.border};padding:18px 16px;font-size:13px;">
    <div style="font-family:${U};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${t.muted};margin-bottom:10px;">Getting started</div>
    ${["Installation", "Authentication", "Your first request", "Rate limits"].map((s, i) => `
    <div style="padding:7px 10px;border-radius:${px(Math.max(r - 2, 4))};${i === 2 ? `background:${dim};color:${t.accent};font-weight:600;` : `color:${t.muted};`}">${s}</div>`).join("")}
    <div style="font-family:${U};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${t.muted};margin:16px 0 10px;">Reference</div>
    ${["Projects", "Events", "Webhooks"].map((s) => `<div style="padding:7px 10px;color:${t.muted};">${s}</div>`).join("")}
  </div>
  <div style="padding:26px 32px;max-width:640px;display:flex;flex-direction:column;gap:16px;min-width:0;">
    <span style="font-family:${U};font-size:11px;color:${t.muted};">Docs / Getting started</span>
    <h2 style="font-family:${D};font-weight:${DWt};font-size:27px;">Your first request</h2>
    <p style="font-size:15px;line-height:1.7;color:${t.muted};">Every request is authenticated with your project key. Create one from the dashboard, then send your first event:</p>
    <div style="background:${t.surface};border:1px solid ${t.border};border-radius:${px(r)};padding:14px 16px;font-family:${U};font-size:12.5px;line-height:1.7;overflow:auto;">
<span style="color:${t.muted};"># send one event</span><br>
curl -X POST api.relay.dev/v1/events \\<br>
&nbsp;&nbsp;-H <span style="color:${t.accent};">"Authorization: Bearer $KEY"</span> \\<br>
&nbsp;&nbsp;-d <span style="color:${t.accent};">'{"type":"signup","user":"u_812"}'</span>
    </div>
    <div style="border:1px solid ${t.border};border-left:3px solid ${t.accent};border-radius:${px(Math.max(r - 2, 4))};background:${t.surface};padding:12px 16px;font-size:13.5px;line-height:1.6;">
      <b style="font-family:${U};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${t.accent};">Note</b><br>
      Keys are scoped per environment. A test key never writes to production data.
    </div>
    <p style="font-size:15px;line-height:1.7;color:${t.muted};">A <code style="font-family:${U};font-size:13px;background:${t.surface};border:1px solid ${t.border};border-radius:5px;padding:2px 6px;">201</code> response confirms the event was stored. Next: <a style="color:${t.accent};text-decoration:underline;text-underline-offset:3px;">rate limits</a>.</p>
  </div>
</div>`; }

const BUILDERS = { web: pWeb, app: pApp, tool: pTool, edit: pEdit, docs: pDocs };

/* ═══════════════ Starter page ═══════════════ */
function starterHTML(ty, gr, catId) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ty.name} on ${gr.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
${comboCSS(ty, gr, catLabel(catId), IDX)}
main{min-height:100vh;padding:8vh clamp(20px,6vw,80px);display:flex;flex-direction:column;gap:22px;max-width:900px}
.eyebrow{font-family:var(--font-ui);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(34px,5vw,58px);line-height:1.06}
p{font-size:16.5px;line-height:1.7;color:var(--ink-muted);max-width:56ch}
.btn{display:inline-block;padding:12px 22px;font-size:13.5px;text-decoration:none}
.card{padding:20px 22px;max-width:420px}
.card code{font-size:13px}
</style></head><body><main>
<span class="eyebrow">Starter page from FontHabibi</span>
<h1>Your fonts and colors are ready.</h1>
<p>This page uses ${ty.d} for headings, ${ty.b} for text and ${ty.u} for labels, on the "${gr.name}" colors. Replace this copy and keep the variables at the top of the stylesheet.</p>
<a class="btn" href="#">Main button</a>
<div class="card"><strong>Variables in use</strong><br><code>--accent: ${gr.tokens.accent}</code><br><code>--radius: ${gr.tokens.radius}px</code></div>
</main></body></html>`;
}

/* ═══════════════ Render ═══════════════ */
const railObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    railObserver.unobserve(e.target);
    const v = VALL.get(e.target.dataset.t);
    if (v) loadVoiceFonts(v, false);
  }
}, { rootMargin: "200px 0px" });

function syncURL() {
  const p = new URLSearchParams({ medium: curCat, voice: SEL[curCat].f, ground: SEL[curCat].g });
  history.replaceState(null, "", location.pathname + "?" + p.toString());
}

function renderTabs() {
  $("tabs").innerHTML = CATS.map((c) =>
    `<button class="tab ${c.id === curCat ? "on" : ""}" type="button" data-cat="${c.id}" aria-pressed="${c.id === curCat}">${esc(c.label)}</button>`).join("");
  $("cat-note").textContent = (CATS.find((c) => c.id === curCat) || {}).note || "";
  $("tabs").querySelectorAll(".tab").forEach((b) => (b.onclick = () => { curCat = b.dataset.cat; renderAll(); }));
}

function renderTypes() {
  const list = typesFor(curCat), sel = SEL[curCat].f;
  const keep = $("t-grid").scrollTop;
  $("t-count").textContent = list.length + " pairings";
  $("t-grid").innerHTML = list.map((ty) => `
  <button class="card ${ty.id === sel ? "on" : ""}" type="button" data-t="${esc(ty.id)}" aria-pressed="${ty.id === sel}" title="${esc(ty.vibe)}">
    <span class="t-ag" style="font-family:${esc(css(ty.d))};font-weight:${ty.dw};">Ag</span>
    <span class="body">
      <span class="nm">${esc(ty.name)}</span>
      <span class="sub">${esc([...new Set([ty.d, ty.b, ty.u])].join(", "))}</span>
    </span>
    ${isExtra(ty) ? '<span class="from">From the library</span>' : "<span></span>"}
  </button>`).join("");
  $("t-grid").scrollTop = keep;
  $("t-grid").querySelectorAll(".card").forEach((b) => {
    railObserver.observe(b);
    b.onclick = () => { SEL[curCat].f = b.dataset.t; renderTypes(); renderStage(); };
  });
}

function renderGrounds() {
  let list = groundsFor(curCat);
  if (gFilter !== "all") list = list.filter((g) => (gFilter === "dark" ? g.tokens.dark : !g.tokens.dark));
  const sel = SEL[curCat].g, all = groundsFor(curCat);
  const keep = $("g-grid").scrollTop;
  $("g-count").textContent = all.length + " color sets";
  $("g-chips").innerHTML = [["all", "All"], ["light", "Light"], ["dark", "Dark"]].map(([f, label]) => `<button class="chip ${gFilter === f ? "on" : ""}" type="button" data-f="${f}" aria-pressed="${gFilter === f}">${label}</button>`).join("");
  $("g-chips").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { gFilter = b.dataset.f; renderGrounds(); }));
  $("g-grid").innerHTML = list.map((g) => { const t = g.tokens; return `
  <button class="card ${g.id === sel ? "on" : ""}" type="button" data-g="${esc(g.id)}" aria-pressed="${g.id === sel}" title="${esc(g.vibe)}">
    <span class="g-sw" style="background:${t.bg};">
      <span class="aa" style="color:${t.ink};">Aa</span>
      <span class="dot" style="background:${t.accent};"></span>
    </span>
    <span class="body">
      <span class="nm">${esc(g.name)}</span>
      <span class="sub">${t.dark ? "Dark" : "Light"}, ${esc(g.vibe)}</span>
    </span>
    ${isExtra(g) ? '<span class="from">From the library</span>' : "<span></span>"}
  </button>`; }).join("");
  $("g-grid").scrollTop = keep;
  $("g-grid").querySelectorAll(".card").forEach((b) => (b.onclick = () => { SEL[curCat].g = b.dataset.g; renderGrounds(); renderStage(); }));
}

function renderStage() {
  const ty = curType(), gr = curGround(), t = gr.tokens;
  loadVoiceFonts(ty, true);
  $("c-name").textContent = ty.name + " on " + gr.name;
  const pv = $("preview");
  const paint = () => { pv.innerHTML = BUILDERS[curCat](ty, gr); pv.classList.remove("fade"); };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) paint();
  else { pv.classList.add("fade"); setTimeout(paint, 80); }
  const chips = [["Background", t.bgHex], ["Cards", t.surface], ["Text", t.ink], ["Secondary text", t.muted], ["Accent", t.accent], ["Borders", t.border]];
  $("token-row").innerHTML = chips.map(([k, v]) => `<span class="tk"><i style="background:${v}"></i>${k} <b>${v}</b></span>`).join("") + `<span class="tk">Corners <b>${t.radius}px</b></span>`;
  const grade = gr.grade ? ` Contrast: <b>${esc(gr.grade)}</b>.` : "";
  $("fonts-line").innerHTML = `Headings in <b>${esc(ty.d)}</b>, text in <b>${esc(ty.b)}</b>, labels and numbers in <b>${esc(ty.u)}</b>.${grade}`;
  for (const id of ["btn-ai", "btn-copy"]) { const b = $(id); if (b.dataset.label) b.textContent = b.dataset.label; b.classList.remove("ok"); }
  syncURL();
}

function renderSaved() {
  SAVED = SAVED.filter((s) => VALL.has(s.f) && GALL.has(s.g));
  $("tray").classList.toggle("show", SAVED.length > 0);
  $("tray-count").textContent = "(" + SAVED.length + ")";
  $("saved").innerHTML = SAVED.map((s, i) => {
    const ty = VALL.get(s.f), gr = GALL.get(s.g);
    loadVoiceFonts(ty, false);
    return `<span class="saved-chip">
      <span class="sw" style="background:${gr.tokens.bg};color:${gr.tokens.ink};font-family:${esc(css(ty.d))};font-weight:${ty.dw};">Ag</span>
      <span>${esc(ty.name)} on ${esc(gr.name)}<br><span class="cid">${esc(catLabel(s.cat))}</span></span>
      <button class="load" type="button" data-i="${i}">Open</button>
      <button class="x" type="button" data-i="${i}">Remove</button>
    </span>`;
  }).join("");
  store.set(SAVE_KEY, SAVED);
  $("saved").querySelectorAll(".x").forEach((b) => (b.onclick = () => { SAVED.splice(+b.dataset.i, 1); renderSaved(); }));
  $("saved").querySelectorAll(".load").forEach((b) => (b.onclick = () => {
    const s = SAVED[+b.dataset.i];
    curCat = s.cat;
    const v = VALL.get(s.f), g = GALL.get(s.g);
    if (!TYPES.includes(v)) EXTRA.voice = v;
    if (!GROUNDS.includes(g)) EXTRA.ground = g;
    SEL[curCat] = { f: s.f, g: s.g };
    renderAll();
    reveal();
  }));
}

function renderAll() { renderTabs(); renderTypes(); renderGrounds(); renderStage(); }
// Bring the chosen row into view inside its list (a kit opened from the library can be far down).
function reveal() {
  for (const id of ["t-grid", "g-grid"]) {
    const grid = $(id), on = grid.querySelector(".card.on");
    if (on) grid.scrollTop += on.getBoundingClientRect().top - grid.getBoundingClientRect().top - 6;
  }
}

/* ═══════════════ Actions ═══════════════ */
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}
function bindActions() {
  $("btn-shuffle").onclick = () => {
    const ts = typesFor(curCat), gs = groundsFor(curCat);
    SEL[curCat] = { f: ts[Math.floor(Math.random() * ts.length)].id, g: gs[Math.floor(Math.random() * gs.length)].id };
    renderTypes(); renderGrounds(); renderStage();
  };
  $("btn-save").onclick = () => {
    const s = { cat: curCat, f: SEL[curCat].f, g: SEL[curCat].g };
    if (!SAVED.some((x) => x.cat === s.cat && x.f === s.f && x.g === s.g)) { SAVED.push(s); renderSaved(); flash($("btn-save"), "Saved"); }
    else flash($("btn-save"), "Already saved");
  };
  $("btn-ai").onclick = () => copyText(kitPrompt(curType(), curGround(), IDX, catLabel(curCat).toLowerCase())).then(() => {
    flash($("btn-ai"), "Copied");
    toast("Copied. Paste it at the top of your prompt in Claude, Cursor or v0.");
  });
  $("btn-copy").onclick = () => copyText(comboCSS(curType(), curGround(), catLabel(curCat), IDX)).then(() => {
    flash($("btn-copy"), "Copied");
    toast("CSS copied. Paste it into your stylesheet.");
  });
  $("btn-dl").onclick = () => {
    const ty = curType(), gr = curGround();
    download(`${slug(ty.name)}-on-${slug(gr.name)}.css`, comboCSS(ty, gr, catLabel(curCat), IDX), "text/css");
  };
  $("btn-starter").onclick = () => {
    const ty = curType(), gr = curGround();
    download(`starter-${slug(ty.name)}-${slug(gr.name)}.html`, starterHTML(ty, gr, curCat), "text/html");
  };
  const allSavedCSS = () => SAVED.map((s) => {
    const ty = VALL.get(s.f), gr = GALL.get(s.g);
    return comboCSS(ty, gr, catLabel(s.cat), IDX).replace(/:root\{/, `.theme-${slug(ty.name)}-${slug(gr.name)}{`)
      .replace(/\nbody\{[\s\S]*$/, "")
      + `/* apply with: <body class="theme-${slug(ty.name)}-${slug(gr.name)}"> then use the variables */\n`;
  }).join("\n\n");
  $("btn-copy-all").onclick = () => copyText(allSavedCSS()).then(() => flash($("btn-copy-all"), "Copied"));
  $("btn-dl-all").onclick = () => { download("fonthabibi-saved.css", allSavedCSS(), "text/css"); flash($("btn-dl-all"), "Downloaded"); };
  $("btn-json").onclick = () => {
    const lib = {
      types: TYPES.map((t) => ({ id: t.id, name: t.name, vibe: t.vibe, categories: t.media, fonts: { display: t.d, body: t.b, ui: t.u }, displayWeight: t.dw })),
      grounds: GROUNDS.map((g) => ({ id: g.id, name: g.name, vibe: g.vibe, categories: g.media, tokens: g.tokens, contrast: g.grade })),
      more: "The full library is at /data/kits.json, /data/voices.json (font pairings), /data/grounds.json (color sets) and /data/fonts.json",
    };
    copyText(JSON.stringify(lib, null, 2)).then(() => flash($("btn-json"), "Copied"));
  };
}

/* ═══════════════ Start ═══════════════ */
async function start() {
  let meta, fonts, voices, grounds;
  try {
    [meta, fonts, voices, grounds] = await Promise.all(["meta", "fonts", "voices", "grounds"].map(loadData));
  } catch (err) {
    $("preview").innerHTML = `<div style="padding:40px;color:var(--shell-muted)">The mixer could not load. Check your connection and reload the page.</div>`;
    return;
  }
  META = meta;
  IDX = new Map(fonts.fonts.map((f) => [f.n, f]));
  CATS = meta.media;
  VALL = new Map(voices.voices.map((v) => [v.id, v]));
  GALL = new Map(grounds.grounds.map((g) => [g.id, g]));
  TYPES = voices.voices.filter((v) => v.curated);
  GROUNDS = grounds.grounds.filter((g) => g.curated);

  const p = new URLSearchParams(location.search);
  if (CATS.some((c) => c.id === p.get("medium"))) curCat = p.get("medium");
  const v = VALL.get(p.get("voice")), g = GALL.get(p.get("ground"));
  if (v && !TYPES.includes(v)) EXTRA.voice = v;
  if (g && !GROUNDS.includes(g)) EXTRA.ground = g;
  for (const c of CATS) SEL[c.id] = { f: typesFor(c.id)[0].id, g: groundsFor(c.id)[0].id };
  if (v) SEL[curCat].f = v.id;
  if (g) SEL[curCat].g = g.id;

  SAVED = store.get(SAVE_KEY, []).filter((s) => s && VALL.has(s.f) && GALL.has(s.g) && CATS.some((c) => c.id === s.cat));
  const c = meta.counts;
  $("foot-counts").textContent = `${TYPES.length} hand-picked font pairings and ${GROUNDS.length} color sets are here. The library has all ${fmt(c.voices)} pairings, ${fmt(c.grounds)} color sets and ${fmt(c.kits || 0)} ready-made kits.`;
  bindActions();
  renderAll();
  renderSaved();
  reveal();
}
start();
