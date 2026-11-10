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
 │ ordering rule (swappable)                                            │
 └──────────────────────────────────────────────────────────────────────┘
        ▲                                         ▲
   UI screens (increment 4)               storage module (increment 3)
```

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
| D-07 | The plant library records `hemisphere: "south"`; months are Sydney months. | v10 location support can shift months by 6 or convert to seasons. |
| D-08 | Active-list ordering is one replaceable function (v1: earliest start, then earliest end, then plant name, then task title). | v10 urgency ranking (acute → milestones → routine). |
| D-09 | All saving/loading goes through one storage module (v1: localStorage). | Swap for IndexedDB or cloud sync later. |
| D-10 | Soil pH is stored as numbers `{min, max, note}`; files carry `schemaVersion`. | v10 suitability checks compare numbers; versions allow safe data migration. |

## Styling (from tab "5. Styling")

- Background: charcoal green `#272C28`.
- **All text: warm cream `#E8E2D0`** (for now). Clickable text may get its own colour later.
- Font: Lato (bundled with the app for offline use). Headings: light weight, spaced capitals.
- Palette roles (colours used as fills/borders/tags, with cream text):

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
- UI (increment 4): Vite + React, packaged as an installable web app (PWA).
- Git + GitHub; hosting on GitHub Pages.

## Increments

0. Setup — repo, `CLAUDE.md`, requirement IDs, this baseline.
1. Data — spreadsheet → `data/plants.json`, with a validator.
2. Schedule engine + tests.
3. User state and storage module.
4. UI — Active tasks screen, Log screen, styling.
5. Deploy and use for a month; then v2 (inventory).
