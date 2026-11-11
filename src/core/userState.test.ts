import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, logExpired } from './schedule.ts';
import { parseUserState, syncMyPlants, validateUserState } from './userState.ts';
import { d, libraryWith, realLibrary } from './test-helpers.ts';
import type { PlantLibrary, UserState } from './types.ts';

const goodState = (): UserState => ({
  schemaVersion: 1,
  trackingStart: '2026-11-11',
  myPlants: [{ id: 'waratah', speciesId: 'waratah' }],
  log: [{
    key: 'waratah|task_war_prune_1|2026-11', plantId: 'waratah', taskId: 'task_war_prune_1',
    windowStart: '2026-11', windowEnd: '2026-12', status: 'complete', recordedOn: '2026-11-20',
  }],
});

// ---------- ST-01 / D-10: saved state is checked before use ----------

test('ST-01: a well-formed saved state passes every check', () => {
  assert.deepEqual(validateUserState(goodState()), []);
  assert.deepEqual(validateUserState(createInitialState(realLibrary(), d(2026, 11, 11))), []);
});

test('ST-01: saved state survives a save/load round trip unchanged', () => {
  const s = goodState();
  assert.deepEqual(parseUserState(JSON.parse(JSON.stringify(s))), s);
});

test('ST-01: damaged saved state is rejected with every problem listed', () => {
  const bad = { ...goodState(), trackingStart: '11/11/2026', myPlants: [{ id: 'x' }] } as unknown;
  const errors = validateUserState(bad);
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /trackingStart/);
  assert.match(errors.join('\n'), /speciesId/);
  assert.throws(() => parseUserState(bad), /trackingStart/);
  assert.deepEqual(validateUserState('hello'), ['Saved state is not a JSON object']);
});

test('LG-02: a log entry with an unknown status is rejected', () => {
  const s = goodState() as unknown as { log: Record<string, unknown>[] };
  s.log[0]!.status = 'done';
  assert.match(validateUserState(s).join('\n'), /status 'done'/);
});

test('D-02: the same task instance logged twice is rejected', () => {
  const s = goodState();
  s.log.push({ ...s.log[0]!, status: 'skipped' });
  assert.match(validateUserState(s).join('\n'), /logged twice/);
});

test('D-10: saved state from a newer app version is refused, not guessed at', () => {
  assert.throws(() => parseUserState({ ...goodState(), schemaVersion: 2 }), /newer version/);
});

// ---------- D-11: plants added to the library later ----------

test('D-11: a plant added to the library later joins My plants, dated today', () => {
  const lib = libraryWith({ a: [11] });
  const s = createInitialState(lib, d(2026, 11, 11));
  const bigger: PlantLibrary = { ...lib, plants: [...lib.plants, ...libraryWith({ b: [3] }).plants] };
  const synced = syncMyPlants(bigger, s, d(2027, 2, 5));
  assert.deepEqual(synced.myPlants, [{ id: 'a', speciesId: 'a' }, { id: 'b', speciesId: 'b', addedOn: '2027-02-05' }]);
});

test('D-11: syncing when nothing is new returns the same state', () => {
  const lib = libraryWith({ a: [11] });
  const s = createInitialState(lib, d(2026, 11));
  assert.equal(syncMyPlants(lib, s, d(2027, 1)), s);
});

test('D-11: a plant removed from the library stays in My plants (its log still refers to it)', () => {
  const s = createInitialState(libraryWith({ a: [11], b: [3] }), d(2026, 11));
  assert.equal(syncMyPlants(libraryWith({ a: [11] }), s, d(2027, 1)).myPlants.length, 2);
});

test('D-11: a newly added plant\'s past windows are not logged as skipped', () => {
  // Tracking began Jan 2026. Plant 'late' (Feb task) is added in Jun 2026, after its Feb window expired.
  const lib = libraryWith({ early: [2], late: [2] });
  let s = createInitialState(libraryWith({ early: [2] }), d(2026, 1));
  s = syncMyPlants(lib, s, d(2026, 6));
  const { added } = logExpired(lib, s, d(2026, 6));
  assert.deepEqual(added.map((e) => e.plantId), ['early']);
  // …but next year's window is tracked normally.
  const later = logExpired(lib, s, d(2027, 6)).added.map((e) => `${e.plantId} ${e.windowStart}`);
  assert.deepEqual(later.sort(), ['early 2026-02', 'early 2027-02', 'late 2027-02']);
});
