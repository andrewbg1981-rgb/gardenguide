# GardenGuide v1 — Requirements

Source: `data/source/GardenGuide v1 data set.xlsx`, tab "1. Requirements".
IDs were added so every test can name the requirement it verifies.
A requirement is *verified* when at least one automated test cites its ID.

| ID | Category | Requirement | Status | Verified by |
|---|---|---|---|---|
| CF-01 | Core functionality | GardenGuide v1 shall maintain a gardening schedule only. | v1 | Scope (no test) |
| DM-01 | Data management | GardenGuide v1 shall be provided with a database in JSON format. | v1 | `library.test.ts` |
| DM-02 | Data management | The database shall include a list of plants, important plant characteristics, and date periods for important tasks per plant (including pruning, fertilising, increased watering frequency). | v1 | `library.test.ts` |
| DM-03 | Data management | GardenGuide v1 shall expect date periods to be expressed as calendar months in which the task should be completed. | v1 | `library.test.ts`, `windows.test.ts` |
| TD-01 | Task display | GardenGuide v1 shall display a list of active tasks. | v1 | `schedule.test.ts`; Active tasks screen (`src/ui/ActiveScreen.tsx`) |
| TL-01 | Task logic | "Active" tasks are incomplete tasks within the active period: one month before the current calendar month up to and including two months after it. | v1 | `schedule.test.ts` |
| TL-02 | Task logic | Active tasks shall be arranged earliest date first. | v1 | `schedule.test.ts` |
| TL-03 | Task logic | A task shall be removed from the active list automatically once it is more than a month past its period. | v1 | `schedule.test.ts` |
| TL-04 | Task logic | Completed or expired tasks shall automatically reset and repopulate for the following calendar year. | v1 | `schedule.test.ts` |
| UI-01 | User interaction | The user can mark a task complete, which removes it from the list. | v1 | `schedule.test.ts`, `storage.test.ts`; tick box on each card |
| LG-01 | Logging | GardenGuide v1 shall keep a log of completed and expired tasks. | v1 | `schedule.test.ts` |
| LG-02 | Logging | Completed tasks are labelled 'complete' and expired tasks 'skipped' in the log. | v1 | `schedule.test.ts` |
| LG-03 | Logging | A basic read-only view of the historical log shall be provided. | v1 | `schedule.test.ts` (names, order); Log screen (`src/ui/LogScreen.tsx`) |
| ST-01 | Storage | The user's active inventory and task log shall be saved in the browser (localStorage) between sessions. | v1 | `storage.test.ts`, `userState.test.ts` |
| INV-01 | Inventory | The user can select plants from the database for a personal inventory, filtering the schedule to those plants. | **v2** | — (data model ready: see D-01) |

## Workflow (tab "3. Workflow")

| ID | Step | Where |
|---|---|---|
| WF-01 | The app opens straight to the active task screen. | `App.tsx` (default screen) |
| WF-02 | The user views the active task list; it scrolls if longer than one screen. | `ActiveScreen.tsx` |
| WF-03 | The user completes a task by ticking a checkbox beside it. | `ActiveScreen.tsx` |
| WF-04 | A log button opens the log screen. | `ActiveScreen.tsx` → `#/log` |

Screens are checked by hand (and by Claude with a scripted browser) rather than
by automated tests; the logic behind them is tested.
