// What happens when the app opens and when the user ticks a task: the core's
// pure functions joined to the storage module. The screens call only these.

import { completeTask, createInitialState, logExpired, undoComplete } from '../core/schedule.ts';
import { dateToString } from '../core/months.ts';
import { syncMyPlants } from '../core/userState.ts';
import type { CalendarDate, PlantLibrary, UserState } from '../core/types.ts';
import { backUpUnreadable, loadState, saveState, type KeyValueStore } from './storage.ts';

export interface Session {
  state: UserState;
  /** Messages for the user, e.g. "your saved data could not be read". */
  notices: string[];
}

/**
 * WF-01 / ST-01: open the app on `today`.
 * Load saved state (or start fresh on first use, D-06), add any new library
 * plants (D-11), log tasks that expired while the app was closed (TL-03), save.
 */
export function openSession(library: PlantLibrary, store: KeyValueStore, today: CalendarDate): Session {
  const notices: string[] = [];
  const loaded = loadState(store);
  let state: UserState;

  if (loaded.kind === 'ok') {
    state = loaded.state;
  } else {
    if (loaded.kind === 'unreadable') {
      let kept = 'could not be kept (storage is full or switched off)';
      try {
        kept = `was kept in browser storage under "${backUpUnreadable(store, loaded.raw, dateToString(today))}"`;
      } catch { /* reported in the notice below */ }
      notices.push(`Your saved data could not be read, so GardenGuide has started afresh. ` +
        `The old data ${kept}. (${loaded.error})`);
    }
    state = createInitialState(library, today);
  }

  const before = state;
  state = syncMyPlants(library, state, today);
  state = logExpired(library, state, today).state;
  if (state !== before || loaded.kind !== 'ok') notices.push(...trySave(store, state));
  return { state, notices };
}

/** UI-01 / WF-03: tick a task and save straight away. */
export function tickTask(
  library: PlantLibrary, store: KeyValueStore, state: UserState, key: string, today: CalendarDate,
): Session {
  const next = completeTask(library, state, key, today);
  return { state: next, notices: trySave(store, next) };
}

/** D-12: undo a tick and save. */
export function untickTask(store: KeyValueStore, state: UserState, key: string): Session {
  const next = undoComplete(state, key);
  return { state: next, notices: next === state ? [] : trySave(store, next) };
}

function trySave(store: KeyValueStore, state: UserState): string[] {
  try {
    saveState(store, state);
    return [];
  } catch {
    return ['GardenGuide could not save to this browser (storage may be full or switched off). ' +
      'Changes will be lost when this tab is closed.'];
  }
}
