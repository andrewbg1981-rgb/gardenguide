// Checking, upgrading and tidying the user's saved state (ST-01, D-10, D-11).
//
// Saved data comes back from the browser as plain text, so it is never trusted:
// it is checked here before the app uses it, the same way plants.json is
// checked by library.ts. (Hardware analogy: input validation at a connector —
// whatever arrives on the pins is treated as possibly noisy until checked.)

import { dateToString, parseDate } from './months.ts';
import { LOG_STATUSES, type CalendarDate, type PlantLibrary, type UserState } from './types.ts';

/** The schemaVersion this code writes. Raise it when the saved shape changes (D-10). */
export const USER_STATE_VERSION = 1;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isDate = (v: unknown) => {
  if (typeof v !== 'string') return false;
  try { parseDate(v); return true; } catch { return false; }
};
const isYearMonth = (v: unknown) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Returns a list of problems; an empty list means the state is usable. */
export function validateUserState(data: unknown): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  if (!isObj(data)) return ['Saved state is not a JSON object'];
  if (data.schemaVersion !== USER_STATE_VERSION) err(`schemaVersion must be ${USER_STATE_VERSION} (found ${String(data.schemaVersion)})`);
  if (!isDate(data.trackingStart)) err('trackingStart must be a YYYY-MM-DD date');

  if (!Array.isArray(data.myPlants)) err('myPlants must be a list');
  else {
    const ids = new Set<string>();
    data.myPlants.forEach((p: unknown, i: number) => {
      if (!isObj(p) || !isText(p.id) || !isText(p.speciesId)) return err(`myPlants[${i}] needs an id and a speciesId`);
      if (ids.has(p.id)) err(`myPlants[${i}]: duplicate id '${p.id}'`);
      ids.add(p.id);
      if (p.addedOn !== undefined && !isDate(p.addedOn)) err(`myPlants[${i}]: addedOn must be a YYYY-MM-DD date`);
    });
  }

  if (!Array.isArray(data.log)) err('log must be a list');
  else {
    const keys = new Set<string>();
    data.log.forEach((e: unknown, i: number) => {
      if (!isObj(e)) return err(`log[${i}] is not an object`);
      for (const f of ['key', 'plantId', 'taskId']) if (!isText(e[f])) err(`log[${i}]: missing ${f}`);
      if (!isYearMonth(e.windowStart) || !isYearMonth(e.windowEnd)) err(`log[${i}]: window must be YYYY-MM`);
      if (!(LOG_STATUSES as readonly unknown[]).includes(e.status)) err(`log[${i}]: status '${String(e.status)}' is not one of ${LOG_STATUSES.join(', ')}`);
      if (!isDate(e.recordedOn)) err(`log[${i}]: recordedOn must be a YYYY-MM-DD date`);
      if (typeof e.key === 'string') {
        if (keys.has(e.key)) err(`log[${i}]: task instance '${e.key}' is logged twice`);
        keys.add(e.key);
      }
    });
  }
  return errors;
}

/**
 * D-10: bring older saved data up to the current schemaVersion. Nothing to do
 * yet (only version 1 exists); this is where future upgrades will go, one step
 * per version. Data from a *newer* version of the app is refused, not guessed at.
 */
export function migrateUserState(data: unknown): unknown {
  if (isObj(data) && typeof data.schemaVersion === 'number' && data.schemaVersion > USER_STATE_VERSION) {
    throw new Error(`Saved data is from a newer version of GardenGuide (schema ${data.schemaVersion})`);
  }
  return data;
}

/** Upgrade, check and return typed state, or throw with every problem listed. */
export function parseUserState(data: unknown): UserState {
  const upgraded = migrateUserState(data);
  const errors = validateUserState(upgraded);
  if (errors.length) throw new Error('Saved state is not valid:\n  ' + errors.join('\n  '));
  return upgraded as UserState;
}

/**
 * D-01 / D-11: in v1 "My plants" mirrors the library. When a plant is added
 * to the spreadsheet later, add it here too, marked with today's date so its
 * past windows are not logged as skipped. Plants that leave the library are
 * kept (their log entries still refer to them); the schedule ignores them.
 */
export function syncMyPlants(library: PlantLibrary, state: UserState, today: CalendarDate): UserState {
  const have = new Set(state.myPlants.map((p) => p.speciesId));
  const added = library.plants
    .filter((s) => !have.has(s.id))
    .map((s) => ({ id: s.id, speciesId: s.id, addedOn: dateToString(today) }));
  return added.length ? { ...state, myPlants: [...state.myPlants, ...added] } : state;
}
