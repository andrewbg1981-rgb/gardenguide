// Data shapes shared by the whole app. See docs/design-baseline.md.

/** A calendar month, 1 = January … 12 = December. */
export type Month = number;

/** The task types in the v1 database. */
export const TASK_TYPES = ['pruning', 'fertilising', 'watering', 'planting'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

// ---------- Plant library (read-only reference data, data/plants.json) ----------
// Schema version 2 (KB-01..KB-06, ZN-01, ZN-03). null means "not known yet".

export const LEVELS = ['low', 'moderate', 'high'] as const;
export type Level = (typeof LEVELS)[number];
export const FROST_TOLERANCES = ['tender', 'light', 'hardy'] as const;
export const PRUNING_TOLERANCES = ['light', 'moderate', 'hard'] as const;
export const SOIL_TEXTURES = ['sandy', 'loam', 'clay', 'any', 'potting mix', 'epiphytic'] as const;
export const DRAINAGE_TYPES = ['sharp', 'good', 'moist', 'wet-tolerant'] as const;
export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export const EXPOSURES = ['sheltered', 'moderate', 'exposed'] as const;

export interface SoilPh {
  min: number;
  max: number;
  note?: string;
}

/** Portion of the day in direct sun, as percentages (0–100). */
export interface SunRange {
  min: number | null;
  max: number | null;
  note: string | null;
}

/** KB-05: where guidance came from, and how far to trust it. */
export interface Basis {
  sources: string[];
  confidence: (typeof CONFIDENCES)[number];
}

/** A task as defined in the library: "prune waratahs in Nov–Dec". */
export interface TaskTemplate {
  id: string;
  type: TaskType;
  title: string;
  /** How to do it (KB-03). */
  description: string;
  /** Calendar months in which the task should be done (DM-03), for the garden's location (D-07). */
  months: Month[];
  /** KB-04: missing it is a likely cause of decline or loss, or loses a season. */
  critical: boolean;
  criticalReason: string | null;
  howMuch: string | null;
  materials: string[];
  ifMissed: string | null;
  basis: Basis;
}

export interface PlantSpecies {
  id: string;
  name: string;
  botanicalName: string | null;
  category: string;
  /** Zone id (ZN-01), filled in by the owner. */
  zone: string | null;
  irrigated: boolean;
  sun: SunRange;
  soil: {
    ph: SoilPh | null;
    texture: (typeof SOIL_TEXTURES)[number] | null;
    drainage: (typeof DRAINAGE_TYPES)[number] | null;
    note: string | null;
  };
  size: { heightM: number | null; widthM: number | null; spacingM: number | null };
  tolerance: {
    wind: Level | null;
    salt: Level | null;
    frost: (typeof FROST_TOLERANCES)[number] | null;
    waterlogging: Level | null;
    drySpells: Level | null;
  };
  needsEstablishmentWatering: boolean | null;
  phosphorusSensitive: boolean | null;
  feedingNote: string | null;
  /** KB-02. */
  pruning: { tolerance: (typeof PRUNING_TOLERANCES)[number] | null; rule: string | null };
  deadhead: { advice: 'yes' | 'no' | 'n/a' | null; note: string | null };
  harvest: { signs: string | null; storage: string | null } | null;
  cautions: string | null;
  basis: Basis;
  tasks: TaskTemplate[];
}

/** A garden zone (ZN-01, ZN-03). */
export interface Zone {
  id: string;
  name: string;
  theme: string | null;
  container: boolean;
  sun: SunRange;
  wind: { level: (typeof EXPOSURES)[number] | null; confirmed: boolean };
  salt: { level: Level | null; confirmed: boolean };
  soil: {
    ph: number | null;
    texture: (typeof SOIL_TEXTURES)[number] | null;
    drainage: (typeof DRAINAGE_TYPES)[number] | null;
    surveyedOn: string | null;
  };
  notes: string | null;
}

export interface WishlistItem {
  name: string;
  botanicalName: string | null;
  zone: string | null;
  notes: string | null;
}

export interface PlantLibrary {
  schemaVersion: 2;
  /** Months in this library are for this hemisphere and location (D-07). */
  hemisphere: 'south' | 'north';
  location?: string;
  source?: string;
  zones: Zone[];
  plants: PlantSpecies[];
  wishlist: WishlistItem[];
}

// ---------- User state (saved by the storage module) ----------

/** One of the user's own plants (D-01). v10 adds plantedOn, location, etc. */
export interface MyPlant {
  id: string;
  speciesId: string;
  /**
   * D-11: the day this plant was added, 'YYYY-MM-DD'. Expired tasks are only
   * logged from this date on. Missing for plants added on the first day.
   */
  addedOn?: string;
}

/**
 * What finally happened to a task instance (D-05).
 * v10 will add 'assumed' for routine tasks that auto-advance.
 */
export const LOG_STATUSES = ['complete', 'skipped'] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];

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
