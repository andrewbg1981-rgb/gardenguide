# GardenGuide

A web app that lists the garden tasks due now (pruning, fertilising, watering,
planting) from a small plant database, and keeps a log of what was done or skipped.

- Requirements: [`docs/requirements.md`](docs/requirements.md)
- Design decisions and styling: [`docs/design-baseline.md`](docs/design-baseline.md)
- Instructions for Claude: [`CLAUDE.md`](CLAUDE.md)

## Layout

```
data/source/   the spreadsheet you edit
data/          plants.json, generated from the spreadsheet
scripts/       convert and validate the data
src/core/      the schedule engine (pure logic) and its tests
docs/          requirements, design baseline, v10 requirements
```

## Commands (need Node.js 22.18 or later)

```
npm install            # first time only: installs TypeScript for type checking
npm test               # run all tests
npm run typecheck      # check types
npm run convert-data   # spreadsheet -> data/plants.json (needs Python 3 + openpyxl)
npm run validate-data  # check data/plants.json
```

## Status

- [x] Increment 0 — setup
- [x] Increment 1 — plant data as JSON
- [x] Increment 2 — schedule engine + tests
- [ ] Increment 3 — user state and storage
- [ ] Increment 4 — screens and styling
- [ ] Increment 5 — deploy
