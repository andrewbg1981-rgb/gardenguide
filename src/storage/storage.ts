// The storage module (D-09, ST-01): the only code that saves or loads user state.
//
// It talks to a "key-value store" — anything with getItem/setItem. In the
// browser that is localStorage; in tests it is a simple in-memory stand-in.
// Swapping localStorage for IndexedDB or cloud sync later means writing a new
// store with the same two operations; nothing else changes.
// (Hardware analogy: a bus interface. The core sees one fixed interface; the
// memory chip behind it can be replaced.)

import { parseUserState } from '../core/userState.ts';
import type { UserState } from '../core/types.ts';

/** The two operations the app needs. window.localStorage already has this shape. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Where the user's state lives in the store. */
export const STATE_KEY = 'gardenguide.userState';

export type LoadResult =
  | { kind: 'empty' }                              // first use: nothing saved yet
  | { kind: 'ok'; state: UserState }
  | { kind: 'unreadable'; raw: string; error: string }; // saved, but damaged or from a newer version

export function loadState(store: KeyValueStore): LoadResult {
  const raw = store.getItem(STATE_KEY);
  if (raw === null) return { kind: 'empty' };
  try {
    return { kind: 'ok', state: parseUserState(JSON.parse(raw)) };
  } catch (e) {
    return { kind: 'unreadable', raw, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Throws if the store refuses (e.g. storage full or disabled); the caller decides what to tell the user. */
export function saveState(store: KeyValueStore, state: UserState): void {
  store.setItem(STATE_KEY, JSON.stringify(state));
}

/**
 * Keep a copy of unreadable data under a separate key before starting afresh,
 * so a bug or a damaged save never silently destroys the log. Returns the key used.
 */
export function backUpUnreadable(store: KeyValueStore, raw: string, stamp: string): string {
  const key = `${STATE_KEY}.unreadable.${stamp}`;
  store.setItem(key, raw);
  return key;
}

/** An in-memory store, for tests and as a fallback when the browser blocks storage. */
export function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
  };
}
