// Small helpers shared by the tests.
import { readFileSync } from 'node:fs';
import type { CalendarDate, PlantLibrary, TaskType } from './types.ts';

/** Shorthand date: d(2026, 11) = 15 Nov 2026 (the day rarely matters). */
export const d = (year: number, month: number, day = 15): CalendarDate => ({ year, month, day });

/** A one-plant-per-task library, so each test controls exactly which months exist. */
export function libraryWith(tasks: Record<string, number[]>, type: TaskType = 'pruning'): PlantLibrary {
  return {
    schemaVersion: 1,
    hemisphere: 'south',
    plants: Object.entries(tasks).map(([id, months]) => ({
      id,
      name: id,
      category: 'Test',
      soilType: 'Loam',
      soilPh: { min: 6, max: 7 },
      sunExposure: 'Full sun',
      tasks: [{ id: `${id}_task`, type, title: `${id} task`, description: 'Test task', months }],
    })),
  };
}

export function realLibrary(): PlantLibrary {
  return JSON.parse(readFileSync(new URL('../../data/plants.json', import.meta.url), 'utf8'));
}

/** Freeze an object and everything inside it, so a test fails if code tries to change it. */
export function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}
