import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeTasks, createInitialState } from '../core/schedule.ts';
import { d, libraryWith } from '../core/test-helpers.ts';
import { backupFileName, exportBackup, parseBackup } from './backup.ts';
import { openSession, importBackup, tickTask } from './session.ts';
import { STATE_KEY, loadState, memoryStore } from './storage.ts';

test('DV-02: an exported backup imports back to the same data', () => {
  const lib = libraryWith({ nov: [11] });
  const store = memoryStore();
  const open = openSession(lib, store, d(2026, 11, 13));
  const ticked = tickTask(lib, store, open.state, activeTasks(lib, open.state, d(2026, 11, 13))[0]!.key, d(2026, 11, 13));
  const file = exportBackup(ticked.state, d(2026, 11, 13));
  assert.deepEqual(parseBackup(file), { state: ticked.state, exportedOn: '2026-11-13' });
  assert.equal(backupFileName(d(2026, 11, 13)), 'gardenguide-backup-2026-11-13.json');
});

test('DV-02: importing replaces the saved data, after keeping a copy of what was there', () => {
  const lib = libraryWith({ nov: [11] });
  const phone = memoryStore();
  const pc = memoryStore();
  const fromPhone = tickTask(lib, phone, openSession(lib, phone, d(2026, 11, 13)).state,
    activeTasks(lib, createInitialState(lib, d(2026, 11, 13)), d(2026, 11, 13))[0]!.key, d(2026, 11, 13));
  const pcState = openSession(lib, pc, d(2026, 11, 14)).state;

  const result = importBackup(lib, pc, pcState, exportBackup(fromPhone.state, d(2026, 11, 13)), d(2026, 11, 14));
  assert.equal(result.state.log.length, 1);
  assert.deepEqual(loadState(pc), { kind: 'ok', state: result.state });
  assert.deepEqual(JSON.parse(pc.data.get(`${STATE_KEY}.before-import.2026-11-14`)!), pcState);
});

test('DV-02: an imported backup is brought up to date (new plants added, lapsed tasks logged)', () => {
  const lib = libraryWith({ nov: [11], later: [3] });
  const old = createInitialState(libraryWith({ nov: [11] }), d(2026, 11, 1));
  const result = importBackup(lib, memoryStore(), old, exportBackup(old, d(2026, 11, 1)), d(2027, 2, 1));
  assert.deepEqual(result.state.myPlants.map((p) => p.id), ['nov', 'later']);
  assert.deepEqual(result.state.log.map((e) => `${e.plantId} ${e.status}`), ['nov skipped']);
});

test('DV-02: files that are not GardenGuide backups are refused with a plain message', () => {
  assert.throws(() => parseBackup('not json'), /not a GardenGuide backup/);
  assert.throws(() => parseBackup('{"hello": 1}'), /not a GardenGuide backup/);
  assert.throws(() => parseBackup('{"format":"gardenguide-backup","formatVersion":9}'), /different version/);
  assert.throws(() => parseBackup('{"format":"gardenguide-backup","formatVersion":1,"state":{"schemaVersion":1}}'), /damaged/);
});

test('DV-02: a refused import leaves the saved data untouched', () => {
  const lib = libraryWith({ nov: [11] });
  const store = memoryStore();
  const { state } = openSession(lib, store, d(2026, 11, 13));
  const before = store.data.get(STATE_KEY);
  assert.throws(() => importBackup(lib, store, state, '{"hello": 1}', d(2026, 11, 13)));
  assert.equal(store.data.get(STATE_KEY), before);
});
