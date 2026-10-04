# FontHabibi

**Fonts and colors that already go together.**

🔗 **Live site:** https://fonthabibi.pages.dev

FontHabibi is a free library of ready-made font and color kits. Pick what you're building, see each kit as a real website, and copy it into any AI builder or your own CSS.

## What's inside

- **Kits** (`/library/`): 555 ready-made font and color kits for 24 kinds of business, each shown as a small website. Pick what you're building, then **Copy for AI** or **Copy CSS**
- **The rest of the library**: 1,264 font pairings, 340 color sets and every Google font (1,884), searchable by mood, industry, language and contrast
- **The mixer** (`/type-ground-mixer-pro`): any font pairing on any color set, previewed as a website, app, dashboard, article or docs page
- **Contrast checked**: every generated ground passes WCAG AA (4.5:1) for body text, muted text, links and button labels
- **Export anything**: CSS tokens, a .css file, a starter page, or JSON
- Free forever, no account

## How to use a kit with an AI builder

1. Open the library and pick what you're building
2. Hit **Copy for AI** on the kit you like
3. Paste it at the top of your prompt. It lists the fonts, the colors and what each one is for, plus the CSS variables

## Project layout

```
index.html                  home page
type-ground-mixer-pro.html  the mixer (logic in assets/mixer.js)
library/index.html          the library (logic in assets/library.js)
assets/tool.css             the look shared by every page (colors, fonts, top bar)
assets/fh-core.js           shared: data loading, font loading, CSS export
data/                       generated data the pages read
  fonts.json                every Google font with style, mood, language and quality data
  voices.json               font pairings ("voices"), hand-picked + generated
  grounds.json              color sets ("grounds") with contrast scores, hand-picked + generated
  kits.json                 ready-made kits: one pairing on one color set, per kind of business
  meta.json                 counts and filter labels
functions/api/subscribe.js  "Follow the drops" email sign-up (Cloudflare Pages Function)
tools/                      scripts that build /data (not part of the site)
wrangler.toml               Cloudflare settings: output folder and the sign-up database
```

## Rebuilding the data

```
cd tools
npm install
# one-time: a sparse copy of github.com/google/fonts (see the top of build-fonts.mjs)
npm run build
```

`build` runs five steps: fonts, grounds, voices, kits, then `check` (validates everything and writes `data/meta.json`). Curated voices and grounds live in `tools/src/` and are never changed by the generators, except that muted text on 13 curated grounds was nudged to reach 4.5:1.

## Email sign-ups

Addresses go into the Cloudflare D1 database `fonthabibi-signups` (table `subscribers`). To see them: Cloudflare dashboard, Storage & Databases, D1, fonthabibi-signups, Console, and run `SELECT * FROM subscribers;`.

## Tech

Plain HTML, CSS, and vanilla JavaScript modules. No framework, no build step for the site itself. Hosted on Cloudflare Pages. Font data from Google Fonts.

---

© 2026 FontHabibi. Kits are free for unlimited personal and commercial use.
