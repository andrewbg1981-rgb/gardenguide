// Checking that data/plants.json is well-formed (DM-01..DM-03).
// Returns a list of problems; an empty list means the data is valid.

import { TASK_TYPES, type PlantLibrary } from './types.ts';

export function validateLibrary(data: unknown): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const isText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

  if (!isObj(data)) return ['Library is not a JSON object'];
  if (data.schemaVersion !== 1) err(`schemaVersion must be 1 (found ${String(data.schemaVersion)})`);
  if (data.hemisphere !== 'south' && data.hemisphere !== 'north') err('hemisphere must be "south" or "north"');
  if (!Array.isArray(data.plants) || data.plants.length === 0) return [...errors, 'plants must be a non-empty list'];

  const plantIds = new Set<string>();
  const taskIds = new Set<string>();

  data.plants.forEach((p: unknown, i: number) => {
    if (!isObj(p)) return err(`plants[${i}] is not an object`);
    const where = `plant '${typeof p.id === 'string' ? p.id : `#${i}`}'`;

    if (!isText(p.id)) err(`${where}: missing id`);
    else if (plantIds.has(p.id as string)) err(`${where}: duplicate plant id`);
    else plantIds.add(p.id as string);

    for (const f of ['name', 'category', 'soilType', 'sunExposure']) {
      if (!isText(p[f])) err(`${where}: missing ${f}`);
    }

    const ph = p.soilPh;
    if (!isObj(ph) || typeof ph.min !== 'number' || typeof ph.max !== 'number') {
      err(`${where}: soilPh must have numeric min and max`);
    } else if (ph.min > ph.max || ph.min < 0 || ph.max > 14) {
      err(`${where}: soilPh range ${ph.min}-${ph.max} is not sensible`);
    }

    if (!Array.isArray(p.tasks) || p.tasks.length === 0) return err(`${where}: needs at least one task`);
    p.tasks.forEach((t: unknown, j: number) => {
      if (!isObj(t)) return err(`${where}: tasks[${j}] is not an object`);
      const tw = `${where}, task '${typeof t.id === 'string' ? t.id : `#${j}`}'`;
      if (!isText(t.id)) err(`${tw}: missing id`);
      else if (taskIds.has(t.id as string)) err(`${tw}: duplicate task id`);
      else taskIds.add(t.id as string);
      if (!(TASK_TYPES as readonly unknown[]).includes(t.type)) {
        err(`${tw}: type '${String(t.type)}' is not one of ${TASK_TYPES.join(', ')}`);
      }
      if (!isText(t.title)) err(`${tw}: missing title`);
      if (!isText(t.description)) err(`${tw}: missing description`);
      const months = t.months;
      if (!Array.isArray(months) || months.length === 0) {
        err(`${tw}: months must be a non-empty list`);
      } else {
        if (months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) err(`${tw}: months must be whole numbers 1–12`);
        if (new Set(months).size !== months.length) err(`${tw}: months contain duplicates`);
      }
    });
  });

  return errors;
}

/** Validate and return typed data, or throw with every problem listed. */
export function loadLibrary(data: unknown): PlantLibrary {
  const errors = validateLibrary(data);
  if (errors.length) throw new Error('Invalid plant library:\n  ' + errors.join('\n  '));
  return data as PlantLibrary;
}
