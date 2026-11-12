import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLibrary, validateLibrary } from './library.ts';
import { libraryWith, realLibrary } from './test-helpers.ts';

const clone = <T>(x: T): T => structuredClone(x);

test('DM-01: data/plants.json is valid JSON that passes every check', () => {
  assert.deepEqual(validateLibrary(realLibrary()), []);
});

// Tests on the real database check rules every version of the data must obey.
// They never pin values the owner edits in the spreadsheet (zones, months, counts),
// so editing the spreadsheet does not break them. Exact expectations use test data.

test('DM-02: every plant has its characteristics and at least one task', () => {
  for (const p of realLibrary().plants) {
    assert.ok(p.name && p.category, p.id);
    assert.ok(p.soil.ph && p.soil.ph.min <= p.soil.ph.max, p.id);
    assert.ok(p.tasks.length > 0, p.id);
  }
});

test('DM-02: the database covers pruning, fertilising and watering', () => {
  const types = new Set(realLibrary().plants.flatMap((p) => p.tasks.map((t) => t.type)));
  for (const t of ['pruning', 'fertilising', 'watering']) assert.ok(types.has(t as never), t);
});

test('D-07: the library records its hemisphere and location', () => {
  assert.equal(realLibrary().hemisphere, 'south');
  assert.equal(realLibrary().location, 'Skenes Creek, Victoria');
});

test('KB-02: every plant with a pruning tolerance states its rule', () => {
  for (const p of realLibrary().plants) if (p.pruning.tolerance) assert.ok(p.pruning.rule, p.id);
  const lib = clone(realLibrary());
  lib.plants[0]!.pruning = { tolerance: 'light', rule: null };
  assert.ok(validateLibrary(lib).some((e) => e.includes('needs its rule')));
});

test('KB-03: every task says how to do it', () => {
  for (const p of realLibrary().plants) for (const t of p.tasks) assert.ok(t.description, t.id);
});

test('KB-04: critical tasks carry a reason; the validator rejects one without', () => {
  const critical = realLibrary().plants.flatMap((p) => p.tasks).filter((t) => t.critical);
  assert.ok(critical.length > 0);
  for (const t of critical) assert.ok(t.criticalReason, t.id);
  const lib = libraryWith({ a: [1] });
  lib.plants[0]!.tasks[0]!.critical = true;
  assert.ok(validateLibrary(lib).some((e) => e.includes('critical task needs a reason')));
});

test('KB-05: every plant and task records a source and a confidence', () => {
  for (const p of realLibrary().plants) {
    assert.ok(p.basis.sources.length > 0, p.id);
    for (const t of p.tasks) assert.ok(t.basis.sources.length > 0, t.id);
  }
  const lib = libraryWith({ a: [1] });
  lib.plants[0]!.basis = { sources: [], confidence: 'high' };
  (lib.plants[0]!.tasks[0]!.basis as { confidence: string }).confidence = 'certain';
  const errors = validateLibrary(lib);
  assert.ok(errors.some((e) => e.includes('at least one source')));
  assert.ok(errors.some((e) => e.includes('confidence must be')));
});

test('ZN-01 / ZN-03: zones have unique ids and sensible sun ranges', () => {
  const lib = clone(realLibrary());
  assert.ok(lib.zones.length > 0);
  lib.zones.push(clone(lib.zones[0]!));
  lib.zones[1]!.sun = { min: 80, max: 20, note: null };
  const errors = validateLibrary(lib);
  assert.ok(errors.some((e) => e.includes('duplicate zone id')));
  assert.ok(errors.some((e) => e.includes('not sensible')));
});

test('ZN-01: a plant can only be placed in a zone that exists', () => {
  const lib = clone(realLibrary());
  lib.plants[0]!.zone = lib.zones[0]!.id;
  assert.deepEqual(validateLibrary(lib), []);
  lib.plants[0]!.zone = 'moon';
  assert.ok(validateLibrary(lib).some((e) => e.includes("zone 'moon'")));
});

test('ZN-03: every zone records wind and salt exposure as estimated or confirmed; bad levels are rejected', () => {
  for (const z of realLibrary().zones) {
    assert.equal(typeof z.wind.confirmed, 'boolean', z.id);
    assert.equal(typeof z.salt.confirmed, 'boolean', z.id);
  }
  const lib = clone(realLibrary());
  (lib.zones[0]!.wind as { level: string }).level = 'gale';
  assert.ok(validateLibrary(lib).some((e) => e.includes('wind is not valid')));
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
  lib.plants[0].soil.ph = { min: 8, max: 6 };
  const errors = validateLibrary(lib);
  assert.ok(errors.some((e) => e.includes('duplicate plant id')));
  assert.ok(errors.some((e) => e.includes('duplicate task id')));
  assert.ok(errors.some((e) => e.includes("'mowing'")));
  assert.ok(errors.some((e) => e.includes('not sensible')));
  assert.throws(() => loadLibrary(lib), /Invalid plant library/);
});

test('D-10: the validator rejects a missing or old schema version', () => {
  const lib = libraryWith({ a: [1] }) as any;
  delete lib.schemaVersion;
  assert.ok(validateLibrary(lib).some((e) => e.includes('schemaVersion')));
  lib.schemaVersion = 1;
  assert.ok(validateLibrary(lib).some((e) => e.includes('schemaVersion must be 2')));
});
