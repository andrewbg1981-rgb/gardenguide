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

/**
 * TK-03 / D-08: the v2 ordering. Groups first — critical overdue, critical due
 * now, routine due now or in its grace month, then upcoming — and within each
 * group the v1 order (earliestFirst).
 */
export function byUrgency(today: CalendarDate): (a: TaskInstance, b: TaskInstance) => number {
  const rank = (t: TaskInstance) => {
    const when = timing(t, today);
    if (when === 'upcoming') return 3;
    if (!t.task.critical) return 2;
    return when === 'overdue' ? 0 : 1;
  };
  return (a, b) => rank(a) - rank(b) || earliestFirst(a, b);
}

/** D-06 / D-11: the earliest window end that is tracked for a plant. */
function firstTrackedEnd(state: UserState, plant: MyPlant): number {
  const start = dateToAbs(parseDate(state.trackingStart)) - GRACE_MONTHS;
  return plant.addedOn ? Math.max(start, dateToAbs(parseDate(plant.addedOn)) - GRACE_MONTHS) : start;
}

/**
 * D-14: a critical instance is superseded once a later instance of the same
 * plant's task has started (e.g. next year's window). Until then it persists.
 */
function supersededSet(all: readonly TaskInstance[], now: number): Set<string> {
  const latestStarted = new Map<string, number>();
  for (const t of all) {
    if (t.start > now) continue;
    const id = `${t.plant.id}|${t.task.id}`;
    latestStarted.set(id, Math.max(latestStarted.get(id) ?? -Infinity, t.start));
  }
  return new Set(all.filter((t) => t.start < (latestStarted.get(`${t.plant.id}|${t.task.id}`) ?? -Infinity)).map((t) => t.key));
}

/** Critical instances whose windows ended before the active period but are still owed (TK-02). */
function persistingCritical(library: PlantLibrary, state: UserState, now: number): TaskInstance[] {
  const from = dateToAbs(parseDate(state.trackingStart)) - GRACE_MONTHS;
  const all = instancesOverlapping(library, state.myPlants, from, now)
    .filter((t) => t.task.critical);
  const superseded = supersededSet(all, now);
  return all.filter((t) => t.end < now - MONTHS_BEFORE && t.end >= firstTrackedEnd(state, t.plant) && !superseded.has(t.key));
}

/**
 * TL-01 / TK-02 / TK-03: tasks to show today. Routine tasks: windows overlapping
 * last month to two months ahead. Critical tasks: the same, plus any earlier
 * unfinished instance that has not been superseded (D-14).
 */
export function activeTasks(
  library: PlantLibrary, state: UserState, today: CalendarDate,
  order: (a: TaskInstance, b: TaskInstance) => number = byUrgency(today),
): TaskInstance[] {
  const now = dateToAbs(today);
  const logged = new Set(state.log.map((e) => e.key));
  return [
    ...instancesOverlapping(library, state.myPlants, now - MONTHS_BEFORE, now + MONTHS_AHEAD),
    ...persistingCritical(library, state, now),
  ]
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
 * TL-03 / TK-01 / LG-01 / LG-02: log every instance that lapsed un-ticked as 'skipped'.
 * Routine tasks lapse once more than a month past their window. Critical tasks
 * lapse only when superseded by their next window (TK-02, D-14).
 * Run this whenever the app opens. Instances that had already lapsed before
 * tracking started are ignored (D-06), as are a newly added plant's (D-11).
 */
export function logExpired(
  library: PlantLibrary, state: UserState, today: CalendarDate,
): { state: UserState; added: LogEntry[] } {
  const now = dateToAbs(today);
  const from = dateToAbs(parseDate(state.trackingStart)) - GRACE_MONTHS;
  const lastExpiredEnd = now - GRACE_MONTHS - 1;
  if (lastExpiredEnd < from) return { state, added: [] };

  const logged = new Set(state.log.map((e) => e.key));
  const all = instancesOverlapping(library, state.myPlants, from, now);
  const superseded = supersededSet(all.filter((t) => t.task.critical), now);
  const added = all
    .filter((t) => t.end >= firstTrackedEnd(state, t.plant) && t.end <= lastExpiredEnd && !logged.has(t.key))
    .filter((t) => !t.task.critical || superseded.has(t.key))
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

/** TK-02 / LG-02: deliberately drop a critical task. Throws for routine or inactive tasks. */
export function dismissTask(
  library: PlantLibrary, state: UserState, key: string, today: CalendarDate,
): UserState {
  const task = activeTasks(library, state, today).find((t) => t.key === key);
  if (!task) throw new Error(`Task ${key} is not active, so it cannot be dismissed`);
  if (!task.task.critical) throw new Error(`Task ${key} is routine; routine tasks lapse on their own`);
  return { ...state, log: [...state.log, logEntry(task, 'dismissed', today)] };
}

/**
 * D-12: undo a tick or a dismissal made by mistake. Removes the 'complete' or
 * 'dismissed' entry so the task is active again (if it still would be).
 * 'skipped' entries are never removed.
 */
export function undoComplete(state: UserState, key: string): UserState {
  const log = state.log.filter((e) => !(e.key === key && (e.status === 'complete' || e.status === 'dismissed')));
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
