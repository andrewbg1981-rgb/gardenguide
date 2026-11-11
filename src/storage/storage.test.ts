import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeTasks, createInitialState } from '../core/schedule.ts';
import { d, libraryWith, realLibrary } from '../core/test-helpers.ts';
import { STATE_KEY, loadState, memoryStore, saveState, type KeyValueStore } from './storage.ts';
import { openSession, tickTask, untickTask } from './session.ts';

/** A store that refuses every write, like a browser with storage full or disabled. */
const fullStore = (): KeyValueStore => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });

// ---------- ST-01: saving and loading ----------

test('ST-01: nothing saved yet loads as "empty"', () => {
  assert.deepEqual(loadState(memoryStore()), { kind: 'empty' });
});

test('ST-01: a saved state loads back identical', () => {
  const store = memoryStore();
  const s = createInitialState(realLibrary(), d(2026, 11, 11));
  saveState(store, s);
  assert.deepEqual(loadState(store), { kind: 'ok', state: s });
});

test('ST-01: damaged saved data loads as "unreadable", keeping the raw text', () => {
  const store = memoryStore({ [STATE_KEY]: '{"schemaVersion":1,' });
  const r = loadState(store);
  assert.equal(r.kind, 'unreadable');
  assert.equal(r.kind === 'unreadable' && r.raw, '{"schemaVersion":1,');
});

// ---------- WF-01 / ST-01: opening the app ----------

test('ST-01 / D-06: first open creates and saves the starting state', () => {
  const lib = realLibrary();
  const store = memoryStore();
  const { state, notices } = openSession(lib, store, d(2026, 11, 11));
  assert.equal(state.trackingStart, '2026-11-11');
  assert.equal(state.myPlants.length, lib.plants.length);
  assert.deepEqual(notices, []);
  assert.deepEqual(loadState(store), { kind: 'ok', state });
});

test('ST-01: a ticked task stays ticked after the app is closed and reopened', () => {
  const lib = libraryWith({ nov: [11], dec: [12] });
  const store = memoryStore();
  const first = openSession(lib, store, d(2026, 11, 11));
  const key = activeTasks(lib, first.state, d(2026, 11, 11))[0]!.key;
  tickTask(lib, store, first.state, key, d(2026, 11, 11));

  const reopened = openSession(lib, store, d(2026, 11, 12));
  assert.deepEqual(activeTasks(lib, reopened.state, d(2026, 11, 12)).map((t) => t.plant.id), ['dec']);
  assert.equal(reopened.state.log[0]!.status, 'complete');
});

test('ST-01 / TL-03: tasks that expired while the app was closed are logged and saved on the next open', () => {
  const lib = libraryWith({ nov: [11] });
  const store = memoryStore();
  openSession(lib, store, d(2026, 11, 11));
  openSession(lib, store, d(2027, 1, 10));   // Nov window + 1 month grace has passed
  const r = loadState(store);
  assert.equal(r.kind, 'ok');
  assert.deepEqual(r.kind === 'ok' && r.state.log.map((e) => `${e.status} ${e.windowStart}`), ['skipped 2026-11']);
});

test('ST-01: reopening with nothing new does not rewrite storage', () => {
  const lib = libraryWith({ nov: [11] });
  const store = memoryStore();
  openSession(lib, store, d(2026, 11, 11));
  let writes = 0;
  const counting: KeyValueStore = { getItem: (k) => store.getItem(k), setItem: () => { writes++; } };
  openSession(lib, counting, d(2026, 11, 20));
  assert.equal(writes, 0);
});

test('ST-01: unreadable saved data is backed up, never silently thrown away', () => {
  const store = memoryStore({ [STATE_KEY]: 'not json' });
  const { state, notices } = openSession(realLibrary(), store, d(2026, 11, 11));
  assert.equal(state.log.length, 0);
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /could not be read/);
  assert.equal(store.data.get(`${STATE_KEY}.unreadable.2026-11-11`), 'not json');
  assert.equal(loadState(store).kind, 'ok', 'a fresh, valid state replaces it');
});

test('ST-01: if the browser refuses to save, the app keeps working and says so', () => {
  const lib = libraryWith({ nov: [11] });
  const { state, notices } = openSession(lib, fullStore(), d(2026, 11, 11));
  assert.match(notices.join(), /could not save/);
  const ticked = tickTask(lib, fullStore(), state, activeTasks(lib, state, d(2026, 11, 11))[0]!.key, d(2026, 11, 11));
  assert.equal(ticked.state.log.length, 1, 'the tick still counts for this visit');
  assert.match(ticked.notices.join(), /could not save/);
});

// ---------- D-12: undo ----------

test('D-12: undoing a tick puts the task back on the list, and that is saved too', () => {
  const lib = libraryWith({ nov: [11] });
  const store = memoryStore();
  const open = openSession(lib, store, d(2026, 11, 11));
  const key = activeTasks(lib, open.state, d(2026, 11, 11))[0]!.key;
  const ticked = tickTask(lib, store, open.state, key, d(2026, 11, 11));
  untickTask(store, ticked.state, key);
  const reopened = openSession(lib, store, d(2026, 11, 11));
  assert.equal(activeTasks(lib, reopened.state, d(2026, 11, 11)).length, 1);
  assert.deepEqual(reopened.state.log, []);
});
