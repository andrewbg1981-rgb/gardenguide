// Data shapes shared by the whole app. See docs/design-baseline.md.

/** A calendar month, 1 = January … 12 = December. */
export type Month = number;

/** The task types in the v1 database. */
export const TASK_TYPES = ['pruning', 'fertilising', 'watering', 'planting'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

// ---------- Plant library (read-only reference data, data/plants.json) ----------

export interface SoilPh {
  min: number;
  max: number;
  note?: string;
}

/** A task as defined in the library: "prune waratahs in Nov–Dec". */
export interface TaskTemplate {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  /** Calendar months in which the task should be done (DM-03). */
  months: Month[];
}

export interface PlantSpecies {
  id: string;
  name: string;
  category: string;
  soilType: string;
  soilPh: SoilPh;
  sunExposure: string;
  tasks: TaskTemplate[];
}

export interface PlantLibrary {
  schemaVersion: 1;
  /** Months in this library are for this hemisphere (D-07). */
  hemisphere: 'south' | 'north';
  source?: string;
  plants: PlantSpecies[];
}

// ---------- User state (saved by the storage module) ----------

/** One of the user's own plants (D-01). v10 adds plantedOn, location, etc. */
export interface MyPlant {
  id: string;
  speciesId: string;
}

/**
 * What finally happened to a task instance (D-05).
 * v10 will add 'assumed' for routine tasks that auto-advance.
 */
export type LogStatus = 'complete' | 'skipped';

/** A date with no time zone: { year: 2026, month: 11, day: 11 }. */
export interface CalendarDate {
  year: number;
  month: Month;
  day: number;
}

export interface LogEntry {
  /** Task-instance key, see D-02 and instanceKey(). */
  key: string;
  plantId: string;
  taskId: string;
  /** Window of the instance, as 'YYYY-MM'. */
  windowStart: string;
  windowEnd: string;
  status: LogStatus;
  /** The day it was ticked, or the day the app noticed it had expired, 'YYYY-MM-DD'. */
  recordedOn: string;
}

export interface UserState {
  schemaVersion: 1;
  /** First day the app was used, 'YYYY-MM-DD' (D-06). */
  trackingStart: string;
  myPlants: MyPlant[];
  log: LogEntry[];
}

// ---------- Derived (calculated, never saved) ----------

/** One occurrence of a task for one plant in one window (D-02). */
export interface TaskInstance {
  key: string;
  plant: MyPlant;
  species: PlantSpecies;
  task: TaskTemplate;
  /** Absolute month numbers, see months.ts. Inclusive. */
  start: number;
  end: number;
}
