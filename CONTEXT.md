# CONTEXT.md: Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)

> **Read this file first.** It is the single source of truth for every human and AI agent working on this repo.
> If code or another doc disagrees with this file, either fix the code or update this file in the same change. Never leave them out of sync.
> Task breakdown and progress live in [PLAN.md](./PLAN.md).

---

## 1. What we are building

An **interactive, Arabic-language (RTL) website** that shows the history of philosophy on a **world map** controlled by a **timeline slider**.

- The user drags or plays the timeline. The map shows the **historical borders** of that period and **markers for philosophers/thinkers** who were active then, each placed where they lived and worked.
- Clicking a marker opens a **popup/card** with the figure's Arabic name, dates, place, a portrait (if available), and a **short summary from Arabic Wikipedia**, with a link to the full article.
- **Inspiration:** [OldMapsOnline](https://www.oldmapsonline.org/en#position=6/30.009/31.209), mainly the map-first layout and the "time slider changes what the map shows" interaction. We do **not** copy its code, data, or branding.

### Scope of the first release (MVP)
**Who counts:** philosophers **and** early wisdom-literature sages and religious thinkers (owner decision, 2026-10-12). Each figure is classified with the `kind` field (§4.2) so the UI can tell them apart and filter them.

Ancient civilizations first, in this order:
1. **Ancient Egypt** (wisdom literature, e.g. Ptahhotep, Amenemope)
2. **Other ancient civilizations:** Mesopotamia, Persia, India, China
3. **Ancient Greece:** Presocratics → Socrates/Plato/Aristotle → Hellenistic schools (including Hellenistic Alexandria)

Later releases (out of scope until MVP is done): Roman, Late Antiquity, Islamic Golden Age, Medieval Europe, Renaissance, Early Modern, Modern & Contemporary.

### Non-goals (for now)
- No user accounts, comments, or backend database.
- No live editing of content in the UI.
- No languages other than Arabic in the UI (English names are kept in the data only for reference and lookups).

---

## 2. Tech stack (locked decisions)

| Concern | Choice | Notes |
|---|---|---|
| Build tool | **Vite** (vanilla JS template) | `npm run dev` for local work |
| Language | **Vanilla JavaScript (ES modules)** | No React/Vue. No TypeScript in MVP (JSDoc types are welcome) |
| Styling | **Vanilla CSS** with CSS custom properties | **No Tailwind** |
| Map library | **Leaflet** | Simple, mature, works well with GeoJSON |
| Historical borders | [`aourednik/historical-basemaps`](https://github.com/aourednik/historical-basemaps) GeoJSON | **GPL-3.0**: attribution is required. The project itself is licensed **GPL-3.0** (owner approved) |
| Base layer | Unlabeled physical/terrain tiles, or Natural Earth land polygons | **Never use modern labeled tiles** (modern country names would be anachronistic) |
| Content source | **Arabic Wikipedia** REST API + **Wikidata** | Fetched at **build time** by a script and cached as JSON, not fetched live in the browser |
| Fonts | Google Fonts: **Cairo** for UI, **Amiri** for long text | Owner decision (Q4) |
| Hosting | **GitHub Pages** | Owner decision (Q5); output is a pure static site |

Changing any row above needs an entry in the **Decision Log (§9)**.

---

## 3. Directory layout (target)

```
/
├── CONTEXT.md              ← this file
├── PLAN.md                 ← tasks & progress
├── index.html
├── package.json
├── public/
│   ├── data/
│   │   ├── figures.json        ← GENERATED: merged, enriched figure data (do not hand-edit)
│   │   ├── civilizations.json  ← hand-written civilization/region metadata
│   │   └── borders/            ← historical-basemaps GeoJSON files (world_bc500.geojson …)
│   └── images/                 ← generated/local images only (no hotlinking without attribution)
├── content/
│   └── figures/            ← HAND-WRITTEN source data, one JSON file per civilization
│       ├── egypt.json
│       ├── mesopotamia.json
│       ├── persia.json
│       ├── india.json
│       ├── china.json
│       └── greece.json
├── scripts/
│   ├── fetch-wikipedia.mjs ← pulls summaries/images from ar.wikipedia + Wikidata
│   └── validate-data.mjs   ← schema + sanity checks; must pass before commit
└── src/
    ├── main.js
    ├── styles/
    │   ├── tokens.css      ← design tokens (colors, spacing, fonts)
    │   ├── base.css        ← reset, RTL, typography
    │   └── components.css
    ├── map/                ← Leaflet setup, border layer, marker layer
    ├── timeline/           ← slider, play/pause, era bands
    ├── ui/                 ← popup card, filters, legend, about modal
    └── utils/              ← date formatting, Arabic numerals, etc.
```

**Data flow:** `content/figures/*.json` (human-curated) → `scripts/fetch-wikipedia.mjs` (adds summaries, images, URLs) → `scripts/validate-data.mjs` → `public/data/figures.json` (what the app loads).

---

## 4. Data model

### 4.1 Year convention (IMPORTANT)
- Years are **integers**. **Negative = BCE (ق.م)**, positive = CE (م).
- **There is no year 0.** `-1` = 1 BCE, `1` = 1 CE. The timeline math must skip 0.
- Uncertain dates set `"approx": true` and are shown with **"حوالي"** (circa).
- Display format: `٤٧٠ ق.م` / `١٢٠٠ م` (numeral style: see §6.3).

### 4.2 Figure (source file in `content/figures/*.json`)

```jsonc
{
  "id": "socrates",                    // kebab-case, unique, stable, never reused
  "wikidata": "Q_____",                // REQUIRED. Wikidata QID, verified by hand (see §7)
  "wikipedia_ar": "سقراط",              // exact ar.wikipedia article title, or null if none exists
  "name_ar": "سقراط",
  "name_en": "Socrates",
  "kind": "philosopher",               // REQUIRED. "philosopher" | "sage" (wisdom literature) | "religious-thinker"
  "legendary": false,                  // true if historicity is disputed (e.g. Imhotep as sage, Zoroaster, Laozi)
  "civilization": "greece",            // must match an id in civilizations.json
  "era": "classical-greek",            // must match an era id (see §5)
  "tradition_ar": "الفلسفة الكلاسيكية", // optional school/tradition
  "birth": { "year": -470, "approx": true },
  "death": { "year": -399, "approx": false },
  "active": { "from": -450, "to": -399 },   // drives timeline visibility
  "location": {
    "lat": 37.9715,
    "lng": 23.7257,
    "place_ar": "أثينا",
    "modern_country_ar": "اليونان"     // shown as context only
  },
  "tags": ["ethics", "epistemology"],
  "notes": "free text for curators; not shown in UI"
}
```

### 4.3 Fields added by `fetch-wikipedia.mjs` (in generated `public/data/figures.json`)

```jsonc
{
  "summary_ar": "…",                   // 'extract' from ar.wikipedia REST summary
  "summary_source": "wikipedia_ar",    // "wikipedia_ar" | "manual" (manual = needs human review)
  "wikipedia_url": "https://ar.wikipedia.org/wiki/…",
  "image": { "url": "…", "license": "…", "author": "…", "source_url": "…" }, // or null
  "fetched_at": "2026-10-12T00:00:00Z"
}
```

### 4.4 Civilization (`public/data/civilizations.json`)

```jsonc
{ "id": "egypt", "name_ar": "مصر القديمة", "color": "#C9A227", "center": [26.8, 30.8], "zoom": 6 }
```

---

## 5. Eras (MVP)

Era ids are fixed. Year ranges are **approximate display bands**, not scholarly claims.

| id | name_ar | Approx. range |
|---|---|---|
| `ancient-egypt` | مصر القديمة | -3000 → -332 |
| `mesopotamia` | بلاد الرافدين | -3000 → -539 |
| `ancient-persia` | فارس القديمة | -1500 → -330 |
| `ancient-india` | الهند القديمة | -1500 → -200 |
| `ancient-china` | الصين القديمة | -1000 → -221 |
| `presocratic` | ما قبل سقراط | -624 → -400 |
| `classical-greek` | الفلسفة اليونانية الكلاسيكية | -470 → -322 |
| `hellenistic` | الفلسفة الهلنستية | -323 → -31 |

The timeline default range for the MVP is **-3000 → 0**. It extends as later eras are added.

---

## 6. UI / UX conventions

### 6.1 Language & direction
- `<html lang="ar" dir="rtl">`. All UI strings are in Arabic. No English in the UI except inside attributions.
- Use **CSS logical properties** (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`) and **not** `left`/`right`, so the layout stays RTL-correct.
- Leaflet controls and popups must be checked in RTL. Leaflet assumes LTR by default.

### 6.2 Timeline direction
- **Locked: old dates on the right, newer dates on the left** (matches RTL reading). Play moves the handle from right to left. The "forward" step button moves toward newer dates, so it sits on the left.

### 6.3 Numerals
- **Locked: Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩)** everywhere in the UI (years, counts, zoom), formatted with `Intl.NumberFormat('ar-EG', { useGrouping: false })` for years. Years never get a thousands separator (`٣٠٠٠ ق.م`, not `٣٬٠٠٠`).
- Data files and URLs keep **Western digits** (`-470`). Conversion happens only at display time.
- Never hardcode digit conversion in several places. Use the single helper in `src/utils/format.js`.

### 6.4 Visual style
- Premium, dark, "ancient atlas" look: deep navy/ink background, parchment/gold accents, glassmorphism panels, smooth micro-animations.
- Each civilization has its own color (from `civilizations.json`) for markers and the legend.
- Marker **shape/icon reflects `kind`**: philosopher (●), sage / wisdom literature (scroll icon), religious thinker (flame/star icon). The card shows a kind chip (see glossary).
- Must be responsive. On mobile the timeline sits at the bottom and the popup becomes a bottom sheet.

### 6.5 Accessibility & SEO
- One `<h1>`, semantic landmarks (`<header>`, `<main>`, `<nav>`), descriptive `<title>` and meta description in Arabic.
- Every interactive element has a **unique, descriptive `id`** (e.g. `timeline-slider`, `timeline-play-btn`, `figure-card-close`).
- Keyboard: arrow keys move the timeline, Esc closes the card, markers can be reached by focus.

---

## 7. Anti-hallucination rules (MANDATORY for AI agents)

1. **Never invent facts.** That includes dates, birthplaces, quotes, Wikidata QIDs, Wikipedia titles, and image URLs. If you are not certain, leave the field `null` and add `"notes": "NEEDS VERIFICATION: …"`.
2. **Every figure needs a verified Wikidata QID.** Verify it by opening `https://www.wikidata.org/wiki/<QID>` and checking that the label matches. Do not produce QIDs from memory.
3. **Summaries come only from Arabic Wikipedia** through the fetch script. Do not write or "improve" summaries by hand. If there is no Arabic article, set `summary_source: "manual"`, write a short neutral summary, and mark it for human review.
4. **Coordinates** describe the city or site where the figure was mainly active (not the birthplace, unless that is the same). Note the place name in `place_ar`. Use Wikidata coordinates for the place when they exist.
5. **Disputed or legendary figures** (e.g. Zoroaster, Laozi, Imhotep as a sage) must have `legendary: true`, `approx: true`, and a note in `notes`. The UI shows a "تأريخ تقريبي/مختلف عليه" badge for them.
6. **Classify `kind` carefully.** Use `sage` for wisdom-literature authors (Ptahhotep, Amenemope), `religious-thinker` for founders/reformers of religious thought (Zoroaster, Akhenaten), and `philosopher` otherwise. When unsure, ask and do not guess. Religious figures are described neutrally and historically, with no endorsement or judgment.
7. **Do not change locked decisions (§2, §4.1, §5 ids, §6.2, §6.3)** without adding a Decision Log entry.
8. **Do not hand-edit generated files** (`public/data/figures.json`). Edit `content/` and re-run the scripts.
9. Run `npm run validate` before you call a data task done.
10. When unsure about the user's intent, **ask**. Do not guess.

---

## 8. Licensing & attribution

- **Wikipedia text:** CC BY-SA 4.0. Each popup links to its source article, and the footer/about modal credits Wikipedia.
- **Wikimedia Commons images:** each image's own license. Store `license`, `author`, `source_url` and show them in the card.
- **historical-basemaps:** GPL-3.0. Credit it in the about modal.
- **Project license:** **GPL-3.0** (approved by owner, so it is compatible with historical-basemaps). `LICENSE` file at repo root.
- **Wikimedia API etiquette:** send a descriptive `User-Agent` header (project name + contact) and rate-limit requests in the fetch script.

---

## 9. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-12 | Vanilla JS + Vite + Leaflet + vanilla CSS | Simple and fast, no framework needed for a map + slider app |
| 2026-10-12 | Wikipedia content fetched at build time, not runtime | Reproducible, reviewable, works offline, avoids API rate limits |
| 2026-10-12 | Wikidata QID is the canonical identifier for each figure | Stable IDs reduce mismatched/hallucinated article lookups |
| 2026-10-12 | Negative integers for BCE, no year 0 | One unambiguous date convention |
| 2026-10-12 | Timeline flows right (old) → left (new) | Owner decision (Q1), matches RTL reading |
| 2026-10-12 | Eastern Arabic numerals in UI, Western digits in data/URLs | Owner decision (Q2) |
| 2026-10-12 | Project licensed GPL-3.0 | Owner decision (Q6), compatible with historical-basemaps |
| 2026-10-12 | Include wisdom-literature sages & religious thinkers, classified by `kind` | Owner decision (Q7) |
| 2026-10-12 | Display both ancient place and modern country in popup cards | Owner decision (Q3) |
| 2026-10-12 | Arabic typography: Cairo (UI) + Amiri (text) | Owner decision (Q4) |
| 2026-10-12 | Hosting target: GitHub Pages | Owner decision (Q5) |

---

## 10. Glossary (Arabic UI terms)

| English | Arabic (UI) |
|---|---|
| Timeline | الخط الزمني |
| Philosopher / Thinker | فيلسوف / مفكّر |
| Civilization | حضارة |
| Era | حقبة / عصر |
| BCE / CE | ق.م / م |
| circa | حوالي |
| Read more on Wikipedia | اقرأ المزيد على ويكيبيديا |
| Play / Pause | تشغيل / إيقاف مؤقت |
| Filter | تصفية |
| About | عن المشروع |
| Disputed / approximate date | تأريخ تقريبي / مختلف عليه |
| Legendary / disputed historicity | شخصية شبه أسطورية |
| Philosopher (kind) | فيلسوف |
| Sage / wisdom literature (kind) | حكيم / أدب الحكمة |
| Religious thinker (kind) | مفكّر ديني |
