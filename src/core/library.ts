// Checking that data/plants.json is well-formed (DM-01..DM-03, KB-01..KB-06, ZN-01, ZN-03).
// Returns a list of problems; an empty list means the data is valid.
// The converter checks the spreadsheet row by row; this is the second check,
// run by the app on load and by `npm run validate-data`, on the JSON itself.

import {
  CONFIDENCES, DRAINAGE_TYPES, EXPOSURES, FROST_TOLERANCES, LEVELS, PRUNING_TOLERANCES, SOIL_TEXTURES, TASK_TYPES,
  type PlantLibrary,
} from './types.ts';

export const LIBRARY_VERSION = 2;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isTextOrNull = (v: unknown) => v === null || isText(v);
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const oneOf = (list: readonly string[], v: unknown, nullable = true) => (nullable && v === null) || list.includes(v as string);

export function validateLibrary(data: unknown): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  if (!isObj(data)) return ['Library is not a JSON object'];
  if (data.schemaVersion !== LIBRARY_VERSION) err(`schemaVersion must be ${LIBRARY_VERSION} (found ${String(data.schemaVersion)})`);
  if (data.hemisphere !== 'south' && data.hemisphere !== 'north') err('hemisphere must be "south" or "north"');
  if (!Array.isArray(data.plants) || data.plants.length === 0) return [...errors, 'plants must be a non-empty list'];

  const checkSun = (where: string, sun: unknown) => {
    if (!isObj(sun) || !isNumOrNull(sun.min) || !isNumOrNull(sun.max) || !isTextOrNull(sun.note)) {
      return err(`${where}: sun must have min, max (numbers or null) and note`);
    }
    const { min, max } = sun as { min: number | null; max: number | null };
    if ((min !== null && (min < 0 || min > 100)) || (max !== null && (max < 0 || max > 100)) ||
        (min !== null && max !== null && min > max)) {
      err(`${where}: sun range ${min}–${max}% is not sensible (0–100, min ≤ max)`);
    }
  };
  const checkBasis = (where: string, b: unknown) => {
    if (!isObj(b) || !Array.isArray(b.sources) || b.sources.length === 0 || !b.sources.every(isText)) {
      return err(`${where}: basis needs at least one source (KB-05)`);
    }
    if (!oneOf(CONFIDENCES, b.confidence, false)) err(`${where}: confidence must be one of ${CONFIDENCES.join(', ')}`);
  };

  // ---- zones (ZN-01, ZN-03)
  const zoneIds = new Set<string>();
  if (!Array.isArray(data.zones)) err('zones must be a list');
  else data.zones.forEach((z: unknown, i: number) => {
    if (!isObj(z)) return err(`zones[${i}] is not an object`);
    const where = `zone '${isText(z.id) ? z.id : `#${i}`}'`;
    if (!isText(z.id)) err(`${where}: missing id`);
    else if (zoneIds.has(z.id)) err(`${where}: duplicate zone id`);
    else zoneIds.add(z.id);
    if (!isText(z.name)) err(`${where}: missing name`);
    if (typeof z.container !== 'boolean') err(`${where}: container must be true or false`);
    checkSun(where, z.sun);
    if (!isObj(z.wind) || !oneOf(EXPOSURES, z.wind.level) || typeof z.wind.confirmed !== 'boolean') err(`${where}: wind is not valid`);
    if (!isObj(z.salt) || !oneOf(LEVELS, z.salt.level) || typeof z.salt.confirmed !== 'boolean') err(`${where}: salt is not valid`);
    if (!isObj(z.soil) || !isNumOrNull(z.soil.ph) || !oneOf(SOIL_TEXTURES, z.soil.texture) || !oneOf(DRAINAGE_TYPES, z.soil.drainage)) {
      err(`${where}: soil is not valid`);
    }
  });

  // ---- plants and tasks
  const plantIds = new Set<string>();
  const taskIds = new Set<string>();

  data.plants.forEach((p: unknown, i: number) => {
    if (!isObj(p)) return err(`plants[${i}] is not an object`);
    const where = `plant '${isText(p.id) ? p.id : `#${i}`}'`;

    if (!isText(p.id)) err(`${where}: missing id`);
    else if (plantIds.has(p.id)) err(`${where}: duplicate plant id`);
    else plantIds.add(p.id);
    for (const f of ['name', 'category']) if (!isText(p[f])) err(`${where}: missing ${f}`);
    if (p.zone !== null && !(isText(p.zone) && zoneIds.has(p.zone))) err(`${where}: zone '${String(p.zone)}' is not a known zone`);
    if (typeof p.irrigated !== 'boolean') err(`${where}: irrigated must be true or false`);
    checkSun(where, p.sun);

    const soil = p.soil;
    if (!isObj(soil)) err(`${where}: missing soil`);
    else {
      const ph = soil.ph;
      if (ph !== null) {
        if (!isObj(ph) || typeof ph.min !== 'number' || typeof ph.max !== 'number') err(`${where}: soil pH must have numeric min and max`);
        else if (ph.min > ph.max || ph.min < 0 || ph.max > 14) err(`${where}: soil pH range ${ph.min}-${ph.max} is not sensible`);
      }
      if (!oneOf(SOIL_TEXTURES, soil.texture)) err(`${where}: soil texture '${String(soil.texture)}' is not allowed`);
      if (!oneOf(DRAINAGE_TYPES, soil.drainage)) err(`${where}: drainage '${String(soil.drainage)}' is not allowed`);
    }
    if (!isObj(p.size) || !['heightM', 'widthM', 'spacingM'].every((k) => isNumOrNull((p.size as Obj)[k]))) {
      err(`${where}: size must have heightM, widthM, spacingM (numbers or null)`);
    }
    const tol = p.tolerance;
    if (!isObj(tol) || !oneOf(LEVELS, tol.wind) || !oneOf(LEVELS, tol.salt) || !oneOf(FROST_TOLERANCES, tol.frost) ||
        !oneOf(LEVELS, tol.waterlogging) || !oneOf(LEVELS, tol.drySpells)) {
      err(`${where}: tolerance values are not valid`);
    }
    if (!isObj(p.pruning) || !oneOf(PRUNING_TOLERANCES, p.pruning.tolerance)) err(`${where}: pruning tolerance is not valid (KB-02)`);
    else if (p.pruning.tolerance !== null && !isText(p.pruning.rule)) err(`${where}: a pruning tolerance needs its rule (KB-02)`);
    if (!isObj(p.deadhead) || !oneOf(['yes', 'no', 'n/a'], p.deadhead.advice)) err(`${where}: deadhead advice is not valid`);
    checkBasis(where, p.basis);

    if (!Array.isArray(p.tasks) || p.tasks.length === 0) return err(`${where}: needs at least one task`);
    p.tasks.forEach((t: unknown, j: number) => {
      if (!isObj(t)) return err(`${where}: tasks[${j}] is not an object`);
      const tw = `${where}, task '${isText(t.id) ? t.id : `#${j}`}'`;
      if (!isText(t.id)) err(`${tw}: missing id`);
      else if (taskIds.has(t.id)) err(`${tw}: duplicate task id`);
      else taskIds.add(t.id);
      if (!(TASK_TYPES as readonly unknown[]).includes(t.type)) err(`${tw}: type '${String(t.type)}' is not one of ${TASK_TYPES.join(', ')}`);
      if (!isText(t.title)) err(`${tw}: missing title`);
      if (!isText(t.description)) err(`${tw}: missing description (how to do it)`);
      const months = t.months;
      if (!Array.isArray(months) || months.length === 0) err(`${tw}: months must be a non-empty list`);
      else {
        if (months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) err(`${tw}: months must be whole numbers 1–12`);
        if (new Set(months).size !== months.length) err(`${tw}: months contain duplicates`);
      }
      if (typeof t.critical !== 'boolean') err(`${tw}: critical must be true or false (KB-04)`);
      else if (t.critical && !isText(t.criticalReason)) err(`${tw}: a critical task needs a reason (KB-04)`);
      if (!Array.isArray(t.materials) || !t.materials.every(isText)) err(`${tw}: materials must be a list of text`);
      checkBasis(tw, t.basis);
    });
  });

  if (!Array.isArray(data.wishlist)) err('wishlist must be a list');
  else data.wishlist.forEach((w: unknown, i: number) => {
    if (!isObj(w) || !isText(w.name)) return err(`wishlist[${i}]: missing name`);
    if (w.zone !== null && !(isText(w.zone) && zoneIds.has(w.zone))) err(`wishlist '${w.name}': zone '${String(w.zone)}' is not a known zone`);
  });

  return errors;
}

/** Validate and return typed data, or throw with every problem listed. */
export function loadLibrary(data: unknown): PlantLibrary {
  const errors = validateLibrary(data);
  if (errors.length) throw new Error('Invalid plant library:\n  ' + errors.join('\n  '));
  return data as PlantLibrary;
}
