# GardenGuide — instructions for Claude

The owner is an experienced hardware engineer who is new to software. Explain
software terms briefly the first time they come up; hardware analogies are welcome.

## Rules
- Read `docs/design-baseline.md` before changing anything. Decisions there (D-xx)
  are binding; propose a change to the baseline rather than quietly deviating.
- `src/core/` is pure logic: no DOM, no `localStorage`, no `Date.now()`/`new Date()`.
  "Today" is always a parameter.
- Every rule in the core has a test. Test names start with the requirement or
  decision ID they verify, e.g. `TL-01: ...` or `D-02: ...`.
- Never edit `data/plants.json` by hand: edit the spreadsheet in `data/source/`
  and run `npm run convert-data`.
- Work in small increments. Plan first, then code, then run
  `npm test` and `npm run typecheck`; both must pass before an increment is done.
- Keep dependencies to a minimum and explain any new one before adding it.

## Commands
- `npm test` — run all tests
- `npm run typecheck` — check types
- `npm run convert-data` — regenerate `data/plants.json` from the spreadsheet (needs Python 3 + openpyxl)
- `npm run validate-data` — check `data/plants.json`
