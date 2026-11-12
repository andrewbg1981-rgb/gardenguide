# GardenGuide

A web app that lists the garden tasks due now (pruning, fertilising, watering,
planting) from a small plant database, and keeps a log of what was done or skipped.

- Requirements: [`docs/requirements.md`](docs/requirements.md)
- Design decisions and styling: [`docs/design-baseline.md`](docs/design-baseline.md)
- Instructions for Claude: [`CLAUDE.md`](CLAUDE.md)

## Layout

```
data/source/   the plant database spreadsheet you edit (GardenGuide plant database.xlsx)
data/          plants.json, generated from the spreadsheet
scripts/       convert and validate the data
src/core/      the schedule engine (pure logic) and its tests
src/storage/   saving and loading your ticks and log (localStorage)
src/ui/        the screens (React) and styling
public/        app icon, install manifest, offline service worker
docs/          requirements, design baseline, v10 requirements
```

## Commands (need Node.js 22.18 or later)

```
npm install            # first time, and after package.json changes
npm run dev            # run the app locally; open the address it prints
npm test               # run all tests
npm run typecheck      # check types
npm run build          # check the data, then build the app into dist/
npm run preview        # serve the built app (as it will be deployed)
npm run convert-data   # spreadsheet -> data/plants.json (needs Python 3 + openpyxl;
                       #   first time on Windows: py -m pip install openpyxl)
npm run validate-data  # check data/plants.json
```

Your ticks and log are kept in the browser you use, per device. Clearing that
browser's site data clears them.

## Publishing

Every push to `main` on GitHub runs `.github/workflows/deploy.yml`: install,
test, type-check, build, and — only if all pass — publish to GitHub Pages.
Watch progress on the repository's **Actions** tab. A failed run publishes
nothing; the previous version stays live.

```
git add -A
git commit -m "What changed"
git push
```

On a phone, open the site and use **Add to Home screen** (Safari: Share menu)
to install it. Ticks and the log are saved on that device only.

## Status

- [x] Increment 0 — setup
- [x] Increment 1 — plant data as JSON
- [x] Increment 2 — schedule engine + tests
- [x] Increment 3 — user state and storage
- [x] Increment 4 — screens and styling
- [x] Increment 5 — deploy (live at https://andrewbg1981-rgb.github.io/gardenguide/)
- [ ] Use for a month, then v2 (inventory)
