// Small helpers shared by the tests.
import { readFileSync } from 'node:fs';
import type { CalendarDate, PlantLibrary, PlantSpecies, TaskTemplate, TaskType } from './types.ts';

/** Shorthand date: d(2026, 11) = 15 Nov 2026 (the day rarely matters). */
export const d = (year: number, month: number, day = 15): CalendarDate => ({ year, month, day });

/** A minimal valid plant (schema v2) with one task per entry, for tests that only care about months. */
export function testPlant(id: string, tasks: TaskTemplate[]): PlantSpecies {
  return {
    id, name: id, botanicalName: null, category: 'Test', zone: null, irrigated: false,
    sun: { min: null, max: null, note: null },
    soil: { ph: { min: 6, max: 7 }, texture: null, drainage: null, note: null },
    size: { heightM: null, widthM: null, spacingM: null },
    tolerance: { wind: null, salt: null, frost: null, waterlogging: null, drySpells: null },
    needsEstablishmentWatering: null, phosphorusSensitive: null, feedingNote: null,
    pruning: { tolerance: null, rule: null }, deadhead: { advice: null, note: null },
    harvest: null, cautions: null, basis: { sources: ['test'], confidence: 'low' },
    tasks,
  };
}

export function testTask(id: string, months: number[], type: TaskType = 'pruning', critical = false): TaskTemplate {
  return {
    id, type, title: `${id.replace(/_task$/, '')} task`, description: 'Test task', months,
    critical, criticalReason: critical ? 'test' : null, howMuch: null, materials: [], ifMissed: null,
    basis: { sources: ['test'], confidence: 'low' },
  };
}

/** A one-plant-per-task library, so each test controls exactly which months exist. */
export function libraryWith(tasks: Record<string, number[]>, type: TaskType = 'pruning'): PlantLibrary {
  return {
    schemaVersion: 2,
    hemisphere: 'south',
    zones: [],
    wishlist: [],
    plants: Object.entries(tasks).map(([id, months]) => testPlant(id, [testTask(`${id}_task`, months, type)])),
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
