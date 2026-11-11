// Hands the storage module a real store: localStorage if the browser allows it,
// otherwise a temporary in-memory one (with a notice for the user).
import { memoryStore, type KeyValueStore } from '../storage/storage.ts';

export function browserStore(): { store: KeyValueStore; notice?: string } {
  try {
    const ls = window.localStorage;
    const probe = 'gardenguide.probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { store: ls };
  } catch {
    return {
      store: memoryStore(),
      notice: 'This browser is not letting GardenGuide save (private browsing, or storage switched off). ' +
        'Ticks will be forgotten when the tab closes.',
    };
  }
}
