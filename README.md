# FontHabibi

**Pick a voice, pick a ground.** Free font and color systems for websites, apps, tools, articles, and docs.

🔗 **Live site:** https://fonthabibi.pages.dev

Every AI-generated build comes out wearing the same cream page and the same serif. FontHabibi fixes that: pick a type set (a "voice") and a color system (a "ground") independently, preview the combination inside the medium it will actually live in (a phone frame, a dashboard, an article), then copy the whole thing as ready CSS tokens or JSON you can paste straight into Claude, Cursor, or v0.

## What's inside

- **The mixer** (`/type-ground-mixer-pro`): 74 curated voices × 68 curated grounds across 5 media, plus anything you open from the library
- **The library** (`/library/`): every Google font (1,884), 1,264 font pairings and 340 color grounds, searchable by mood, industry, language and contrast
- **Contrast checked**: every generated ground passes WCAG AA (4.5:1) for body text, muted text, links and button labels
- **Export anything**: CSS tokens, a .css file, a starter page, or JSON
- Free forever, no account

## How to use a kit with an AI builder

1. Open the mixer or the library, pick a voice and a ground
2. Hit **Copy CSS**
3. Paste it into your prompt: *"Use these design tokens for everything you build"*

## Project layout

```
index.html                  home page
type-ground-mixer-pro.html  the mixer (logic in assets/mixer.js)
library/index.html          the library (logic in assets/library.js)
assets/fh-core.js           shared: data loading, font loading, CSS export
data/                       generated data the pages read
  fonts.json                every Google font with style, mood, language and quality data
  voices.json               curated + generated font pairings
  grounds.json              curated + generated color grounds with contrast scores
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

`build` runs four steps: fonts, grounds, voices, then `check` (validates everything and writes `data/meta.json`). Curated voices and grounds live in `tools/src/` and are never changed by the generators, except that muted text on 13 curated grounds was nudged to reach 4.5:1.

## Email sign-ups

Addresses go into the Cloudflare D1 database `fonthabibi-signups` (table `subscribers`). To see them: Cloudflare dashboard, Storage & Databases, D1, fonthabibi-signups, Console, and run `SELECT * FROM subscribers;`.

## Tech

Plain HTML, CSS, and vanilla JavaScript modules. No framework, no build step for the site itself. Hosted on Cloudflare Pages. Font data from Google Fonts.

---

© 2026 FontHabibi. Kits are free for unlimited personal and commercial use.
