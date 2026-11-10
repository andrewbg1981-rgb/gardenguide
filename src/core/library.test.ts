import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLibrary, validateLibrary } from './library.ts';
import { libraryWith, realLibrary } from './test-helpers.ts';

test('DM-01: data/plants.json is valid JSON that passes every check', () => {
  assert.deepEqual(validateLibrary(realLibrary()), []);
});

test('DM-02: every plant has its characteristics and at least one task', () => {
  for (const p of realLibrary().plants) {
    assert.ok(p.name && p.category && p.soilType && p.sunExposure, p.id);
    assert.ok(p.soilPh.min <= p.soilPh.max, p.id);
    assert.ok(p.tasks.length > 0, p.id);
  }
});

test('DM-02: the database covers pruning, fertilising and watering', () => {
  const types = new Set(realLibrary().plants.flatMap((p) => p.tasks.map((t) => t.type)));
  for (const t of ['pruning', 'fertilising', 'watering']) assert.ok(types.has(t as never), t);
});

test('DM-02: the spreadsheet conversion kept every plant and task', () => {
  const lib = realLibrary();
  assert.equal(lib.plants.length, 20);
  assert.equal(lib.plants.reduce((n, p) => n + p.tasks.length, 0), 26);
  assert.deepEqual(lib.plants.find((p) => p.id === 'hydrangea')?.soilPh, { min: 5, max: 7, note: 'color dependent' });
});

test('D-07: the library records its hemisphere', () => {
  assert.equal(realLibrary().hemisphere, 'south');
});

test('DM-03: the validator rejects months outside 1–12 and duplicates', () => {
  const lib = libraryWith({ a: [0, 13], b: [3, 3] });
  const errors = validateLibrary(lib);
  assert.ok(errors.some((e) => e.includes("'a_task'") && e.includes('1–12')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes("'b_task'") && e.includes('duplicates')), errors.join('\n'));
});

test('DM-01: the validator rejects duplicate ids, unknown task types and bad pH', () => {
  const lib = libraryWith({ a: [1] }) as any;
  lib.plants.push(structuredClone(lib.plants[0]));
  lib.plants[0].tasks[0].type = 'mowing';
  lib.plants[0].soilPh = { min: 8, max: 6 };
  const errors = validateLibrary(lib);
  assert.ok(errors.some((e) => e.includes('duplicate plant id')));
  assert.ok(errors.some((e) => e.includes('duplicate task id')));
  assert.ok(errors.some((e) => e.includes("'mowing'")));
  assert.ok(errors.some((e) => e.includes('not sensible')));
  assert.throws(() => loadLibrary(lib), /Invalid plant library/);
});

test('DM-01: the validator rejects a missing schema version', () => {
  const lib = libraryWith({ a: [1] }) as any;
  delete lib.schemaVersion;
  assert.ok(validateLibrary(lib).some((e) => e.includes('schemaVersion')));
});
