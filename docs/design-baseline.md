# GardenGuide — Design baseline

Agreed decisions for v1, made so that v1 stays compatible with the v10 vision
(`docs/GardenGuide v10 requirements.xlsx`). Change a decision here first, then in code.

## Architecture

```
plants.json (plant library, read-only)      browser storage (user state)
        │                                         │
        ▼                                         ▼
 ┌──────────────── core (pure logic, no UI, no browser) ────────────────┐
 │ windows · task instances · active list · complete · expire · log    │
 │ ordering rule (swappable) · user-state checks · undo                 │
 └──────────────────────────────────────────────────────────────────────┘
        ▲                                         ▲
   UI screens (src/ui)                    storage module (src/storage)
   reads the clock, renders               load · save · open session · tick
```

- `src/storage/session.ts` is what the screens call: `openSession` (load or
  create, add new library plants, log expired tasks, save), `tickTask`, `untickTask`.
- Saved state is validated on load. Unreadable data is copied to
  `gardenguide.userState.unreadable.<date>` before starting afresh, never discarded.
- If the browser refuses to save, the app keeps working for that visit and says so.

- The **core** never reads the clock: "today" is always passed in, so any date can be tested.
- The core never touches browser storage: a storage module loads/saves user state.

## Decisions

| ID | Decision | Why (v10 link) |
|---|---|---|
| D-01 | **Plant library** (species, read-only) is separate from **My plants** (the user's own plants). In v1, My plants is created automatically with one entry per library plant. | v2 inventory and v10 planting dates/locations attach to My plants without changing the library. |
| D-02 | Each year's occurrence of a task is a **task instance**, identified by plant, task and the **year-month its window starts** (e.g. `waratah|task_war_prune_1|2026-11`). | A Nov–Jan task ticked in December does not reappear in January. |
| D-03 | A task's months are split into **continuous runs** (wrapping across December→January). Each run is its own instance. | Yucca `3,4,5,9,10,11` = two windows per year. |
| D-04 | **Active** = not yet logged, and window overlaps [last month … two months ahead]. **Expired** = current month is two or more months after the window's last month. | TL-01, TL-03. The two rules meet exactly, so a task is always either active, future, logged or expired. |
| D-05 | The **log is the single record** of what happened to an instance. Status values: `complete`, `skipped`. v10 will add `assumed` (routine tasks auto-advanced). | v10 auto-advance changes the expiry rule, not the data model. |
| D-06 | **Tracking starts** the day the user first opens the app. Instances already expired before then are ignored (not logged as skipped). | Avoids a log full of "skipped" history on first use. |
| D-07 | The plant library records `hemisphere: "south"` and `location`. Months are for the garden's location: Skenes Creek, on the cool-temperate Victorian coast. *(Changed Nov 2026: v1 used Sydney months.)* | v10 location support can shift months by 6 or convert to seasons. |
| D-08 | Active-list ordering is one replaceable function (v1: earliest start, then earliest end, then plant name, then task title). | v10 urgency ranking (acute → milestones → routine). |
| D-09 | All saving/loading goes through one storage module (v1: localStorage). | Swap for IndexedDB or cloud sync later. |
| D-10 | Soil pH is stored as numbers `{min, max, note}`; files carry `schemaVersion`. Plant library v2 (Nov 2026) adds zones and the KB fields; unknown values are `null`, never guessed. | v10 suitability checks compare numbers; versions allow safe data migration. |
| D-11 | *(added in increment 3)* Each of My plants may carry `addedOn`. A plant added to the library after first use joins My plants automatically, dated that day, and its expired tasks are only logged from that date (D-06 applied per plant). Plants removed from the library stay in My plants so their log entries still read correctly. | Adding a plant to the spreadsheet must not flood the log with "skipped". v2 inventory sets `addedOn` when the user adds a plant. |
| D-12 | *(added in increment 4)* A tick can be undone: briefly by un-ticking while it fades out, then by an Undo bar for a few seconds. Undo removes the `complete` log entry; `skipped` entries are never removed. | Phones make accidental taps easy; the log (D-05) must stay trustworthy. |
| D-13 | *(added in increment 3)* Layering is checked by tests: `src/core` never reads the clock, the DOM or browser storage; `src/storage` is handed a store rather than reaching for `localStorage`; only `src/ui` reads the clock (`clock.ts`). The core is type-checked without browser types. | Keeps the core testable at any date and portable to a phone app. |

## Styling (from tab "5. Styling")

- Background: charcoal green `#272C28`.
- **All text: warm cream `#E8E2D0`** (for now). Clickable text may get its own colour later.
- Font: Lato (bundled with the app for offline use). Headings: light weight, spaced capitals.
- Palette roles (colours used as fills/borders/tags, with cream text). Cream text on
  the light fills (Wattle, Hibiscus) is hard to read, so tags use the colour as a dot
  and border, and skipped log entries use Hibiscus as a stripe and tint:

| Colour | Hex | Role |
|---|---|---|
| Wattle Blossom | `#E5C158` | Highlights, current month; planting tag |
| Silver Gum | `#7F9683` | Pruning tag |
| Banksia Amber | `#D96C06` | Fertilising tag |
| Leschenaultia Sky | `#5B86B7` | Watering tag |
| Native Hibiscus | `#9C7C9E` | "Skipped" log entries |
| Tree Fern | `#2D4B38` | Card/panel backgrounds, ticked checkbox fill |
| Waratah Crimson | `#B32428` | Reserved for v10 urgent alerts (fill only) |

- Flourishes: original cream line-art (gum nuts, eucalyptus leaves, waratah) at low opacity, in corners on wide screens only; hidden on phones.

## Tooling

- TypeScript; core tests use Node's built-in test runner (`node --test`), no extra packages.
- UI (increment 4): Vite + React, packaged as an installable web app (PWA) with a
  hand-written manifest and service worker (no PWA plugin). Lato via `@fontsource/lato`.
- Two type-check configs: `tsconfig.json` (core, storage, scripts — no browser types)
  and `tsconfig.ui.json` (screens). `npm run typecheck` runs both.
- `package-lock.json` is committed so every install gets the same package versions.
- Git + GitHub; hosting on GitHub Pages (public repository and site; no personal
  data is published — user state stays in each browser, D-09).
- GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci`, tests, type-check
  and build on every push to `main`; it deploys only if all pass.

## Increments

0. Setup — repo, `CLAUDE.md`, requirement IDs, this baseline.
1. Data — spreadsheet → `data/plants.json`, with a validator.
2. Schedule engine + tests.
3. User state and storage module. ✅
4. UI — Active tasks screen, Log screen, styling. ✅
5. Deploy ✅.

v2–v4 follow `docs/requirements-v4.md` (roadmap in section 7).

- v2.1 Plant database expansion ✅ — new spreadsheet `data/source/GardenGuide plant database.xlsx`
  (tabs: Plants, Tasks, Zones, Wishlist, Lists, Review), library schema v2, critical review of v1 data,
  six plants added. The v1 workbook is kept in `docs/` for its v1 requirements and styling tabs.
