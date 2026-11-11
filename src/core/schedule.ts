// The schedule engine: which tasks are active, ticking them off, and
// logging the ones that expired. Pure functions: nothing here reads the
// clock or storage, and nothing changes its inputs (new state is returned).

import { absToString, dateToAbs, dateToString, parseDate, absYear, toAbs } from './months.ts';
import type {
  CalendarDate, LogEntry, LogStatus, MyPlant, PlantLibrary, PlantSpecies, TaskInstance, TaskType, UserState,
} from './types.ts';
import { monthWindows } from './windows.ts';

/** TL-01: the active period runs from this many months before the current month… */
export const MONTHS_BEFORE = 1;
/** …to this many months after it (inclusive). */
export const MONTHS_AHEAD = 2;
/** TL-03: a task expires once the current month is more than this many months past its window. */
export const GRACE_MONTHS = 1;

/** D-02: the identity of one task instance. */
export function instanceKey(plantId: string, taskId: string, startAbs: number): string {
  return `${plantId}|${taskId}|${absToString(startAbs)}`;
}

/** D-01 / D-06: the starting state on first use — one "my plant" per library plant. */
export function createInitialState(library: PlantLibrary, today: CalendarDate): UserState {
  return {
    schemaVersion: 1,
    trackingStart: dateToString(today),
    myPlants: library.plants.map((p) => ({ id: p.id, speciesId: p.id })),
    log: [],
  };
}

/** Every task instance whose window overlaps the months [from, to] (absolute months). */
export function instancesOverlapping(
  library: PlantLibrary, myPlants: readonly MyPlant[], from: number, to: number,
): TaskInstance[] {
  const speciesById = new Map<string, PlantSpecies>(library.plants.map((p) => [p.id, p]));
  const result: TaskInstance[] = [];
  for (const plant of myPlants) {
    const species = speciesById.get(plant.speciesId);
    if (!species) continue; // plant no longer in the library: nothing to schedule
    for (const task of species.tasks) {
      for (const w of monthWindows(task.months)) {
        // A window can start up to a year before `from` and still overlap it.
        for (let year = absYear(from) - 1; year <= absYear(to); year++) {
          const start = toAbs(year, w.startMonth);
          const end = start + w.length - 1;
          if (start <= to && end >= from) {
            result.push({ key: instanceKey(plant.id, task.id, start), plant, species, task, start, end });
          }
        }
      }
    }
  }
  return result;
}

/** D-08: v1 ordering — earliest start, then earliest end, then plant name, then task title (TL-02). */
export function earliestFirst(a: TaskInstance, b: TaskInstance): number {
  return a.start - b.start || a.end - b.end
    || a.species.name.localeCompare(b.species.name) || a.task.title.localeCompare(b.task.title);
}

/** TL-01 / TL-02: tasks to show today. */
export function activeTasks(
  library: PlantLibrary, state: UserState, today: CalendarDate,
  order: (a: TaskInstance, b: TaskInstance) => number = earliestFirst,
): TaskInstance[] {
  const now = dateToAbs(today);
  const logged = new Set(state.log.map((e) => e.key));
  return instancesOverlapping(library, state.myPlants, now - MONTHS_BEFORE, now + MONTHS_AHEAD)
    .filter((t) => !logged.has(t.key))
    .sort(order);
}

/**
 * TL-01: where an active task sits relative to today, for display:
 * 'overdue' (window ended, still in the grace month), 'now' (today is in the
 * window) or 'upcoming' (starts within the next two months).
 */
export type Timing = 'overdue' | 'now' | 'upcoming';
export function timing(t: TaskInstance, today: CalendarDate): Timing {
  const now = dateToAbs(today);
  return now > t.end ? 'overdue' : now < t.start ? 'upcoming' : 'now';
}

/** TL-03: has this instance's window passed by more than the grace period? */
export function isExpired(t: TaskInstance, today: CalendarDate): boolean {
  return dateToAbs(today) > t.end + GRACE_MONTHS;
}

function logEntry(t: TaskInstance, status: LogStatus, today: CalendarDate): LogEntry {
  return {
    key: t.key, plantId: t.plant.id, taskId: t.task.id,
    windowStart: absToString(t.start), windowEnd: absToString(t.end),
    status, recordedOn: dateToString(today),
  };
}

/**
 * TL-03 / LG-01 / LG-02: log every instance that expired un-ticked as 'skipped'.
 * Run this whenever the app opens. Instances that had already expired before
 * tracking started are ignored (D-06). Returns the new state and what was added.
 */
export function logExpired(
  library: PlantLibrary, state: UserState, today: CalendarDate,
): { state: UserState; added: LogEntry[] } {
  const now = dateToAbs(today);
  const trackingAbs = dateToAbs(parseDate(state.trackingStart));
  // Latest window end that counts as expired today, and earliest one that was
  // still live when tracking started.
  const lastExpiredEnd = now - GRACE_MONTHS - 1;
  const firstTrackedEnd = trackingAbs - GRACE_MONTHS;
  if (lastExpiredEnd < firstTrackedEnd) return { state, added: [] };

  // D-11: a plant added later is only tracked from the day it was added.
  const firstTrackedEndFor = (plant: MyPlant) =>
    plant.addedOn ? Math.max(firstTrackedEnd, dateToAbs(parseDate(plant.addedOn)) - GRACE_MONTHS) : firstTrackedEnd;

  const logged = new Set(state.log.map((e) => e.key));
  const added = instancesOverlapping(library, state.myPlants, firstTrackedEnd, lastExpiredEnd)
    .filter((t) => t.end >= firstTrackedEndFor(t.plant) && t.end <= lastExpiredEnd && !logged.has(t.key))
    .sort(earliestFirst)
    .map((t) => logEntry(t, 'skipped', today));

  return added.length ? { state: { ...state, log: [...state.log, ...added] }, added } : { state, added };
}

/** UI-01 / LG-02: tick an active task. Throws if it is not currently active. */
export function completeTask(
  library: PlantLibrary, state: UserState, key: string, today: CalendarDate,
): UserState {
  const task = activeTasks(library, state, today).find((t) => t.key === key);
  if (!task) throw new Error(`Task ${key} is not active, so it cannot be completed`);
  return { ...state, log: [...state.log, logEntry(task, 'complete', today)] };
}

/**
 * D-12: undo a tick made by mistake. Removes the 'complete' entry so the task
 * is active again (if its window is still active). 'skipped' entries stay.
 */
export function undoComplete(state: UserState, key: string): UserState {
  const log = state.log.filter((e) => !(e.key === key && e.status === 'complete'));
  return log.length === state.log.length ? state : { ...state, log };
}

/** LG-03: names for a log entry. Falls back to the stored ids if the plant or task has left the library. */
export function describeLogEntry(
  library: PlantLibrary, state: UserState, entry: LogEntry,
): { plantName: string; taskTitle: string; taskType: TaskType | null } {
  const plant = state.myPlants.find((p) => p.id === entry.plantId);
  const species = library.plants.find((s) => s.id === (plant?.speciesId ?? entry.plantId));
  const task = species?.tasks.find((t) => t.id === entry.taskId);
  return {
    plantName: species?.name ?? entry.plantId,
    taskTitle: task?.title ?? entry.taskId,
    taskType: task?.type ?? null,
  };
}

/** LG-03: the log for display, most recent first. */
export function logNewestFirst(state: UserState): LogEntry[] {
  return [...state.log].sort((a, b) =>
    b.recordedOn.localeCompare(a.recordedOn) || b.windowStart.localeCompare(a.windowStart));
}
