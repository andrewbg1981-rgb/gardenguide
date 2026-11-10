import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeTasks, completeTask, createInitialState, earliestFirst, instanceKey, isExpired, logExpired, logNewestFirst,
} from './schedule.ts';
import { toAbs } from './months.ts';
import { d, deepFreeze, libraryWith, realLibrary } from './test-helpers.ts';
import type { PlantLibrary, TaskInstance, UserState } from './types.ts';

const keys = (ts: TaskInstance[]) => ts.map((t) => t.key);
const ids = (ts: TaskInstance[]) => ts.map((t) => t.plant.id);
const key = (plant: string, year: number, month: number) => instanceKey(plant, `${plant}_task`, toAbs(year, month));

/** Simulate opening the app on `today`: log expired tasks, return the active list. */
function openApp(lib: PlantLibrary, state: UserState, today = d(2026, 11)) {
  const next = logExpired(lib, state, today).state;
  return { state: next, active: activeTasks(lib, next, today) };
}

// ---------- D-01: initial state ----------

test('D-01: first use creates one "my plant" per library plant and records the start date', () => {
  const lib = realLibrary();
  const s = createInitialState(lib, d(2026, 11, 11));
  assert.equal(s.myPlants.length, lib.plants.length);
  assert.deepEqual(s.myPlants[0], { id: 'elkhorn_fern', speciesId: 'elkhorn_fern' });
  assert.equal(s.trackingStart, '2026-11-11');
  assert.deepEqual(s.log, []);
});

// ---------- TL-01: the active period ----------

test('TL-01: in November, tasks in Oct, Nov, Dec and Jan are active; Sep and Feb are not', () => {
  const lib = libraryWith({ sep: [9], oct: [10], nov: [11], dec: [12], jan: [1], feb: [2] });
  const s = createInitialState(lib, d(2026, 11));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11))).sort(), ['dec', 'jan', 'nov', 'oct']);
});

test('TL-01: the active period is whole months — the day of the month does not matter', () => {
  const lib = libraryWith({ oct: [10], jan: [1] });
  const s = createInitialState(lib, d(2026, 11, 1));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11, 1))), ids(activeTasks(lib, s, d(2026, 11, 30))));
});

test('TL-01: a long task is active if any of its months fall in the active period', () => {
  // Elkhorn fern Sep–Feb: active in November (inside) and in March (Feb is last month).
  const lib = libraryWith({ elk: [9, 10, 11, 12, 1, 2] });
  const s = createInitialState(lib, d(2026, 8));
  assert.deepEqual(keys(activeTasks(lib, s, d(2026, 7))), [key('elk', 2026, 9)], 'two months ahead');
  assert.deepEqual(keys(activeTasks(lib, s, d(2027, 3))), [key('elk', 2026, 9)], 'one month after');
  assert.deepEqual(keys(activeTasks(lib, s, d(2027, 4))), [], 'gone in April');
});

test('TL-01: the active period works across New Year (December shows Nov–Feb)', () => {
  const lib = libraryWith({ oct: [10], nov: [11], feb: [2], mar: [3] });
  const s = createInitialState(lib, d(2026, 12));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 12))), ['nov', 'feb']);
});

// ---------- TL-02: ordering ----------

test('TL-02: active tasks are ordered earliest first, across New Year', () => {
  const lib = libraryWith({ jan: [1], oct: [10], dec: [12], nov: [11] });
  const s = createInitialState(lib, d(2026, 11));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11))), ['oct', 'nov', 'dec', 'jan']);
});

test('TL-02: tasks starting in the same month: shorter window first, then plant name', () => {
  const lib = libraryWith({ b_long: [11, 12, 1], b_short: [11], a_short: [11] });
  const s = createInitialState(lib, d(2026, 11));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11))), ['a_short', 'b_short', 'b_long']);
});

test('D-08: the ordering rule can be swapped without changing anything else', () => {
  const lib = libraryWith({ oct: [10], dec: [12] });
  const s = createInitialState(lib, d(2026, 11));
  const latestFirst = (a: TaskInstance, b: TaskInstance) => -earliestFirst(a, b);
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11), latestFirst)), ['dec', 'oct']);
});

// ---------- TL-03: expiry ----------

test('TL-03: a task leaves the list once it is more than one month past its window', () => {
  const lib = libraryWith({ sep: [9] });
  const s = createInitialState(lib, d(2026, 9));
  assert.equal(activeTasks(lib, s, d(2026, 10)).length, 1, 'one month past: still shown');
  assert.equal(activeTasks(lib, s, d(2026, 11)).length, 0, 'two months past: gone');
});

test('TL-03 / TL-01: every instance is either active, upcoming or expired — never lost between rules', () => {
  const lib = libraryWith({ t: [11, 12, 1] });
  const s = createInitialState(lib, d(2026, 1));
  const inst = { start: toAbs(2026, 11), end: toAbs(2027, 1) } as TaskInstance;
  for (let m = toAbs(2026, 6); m <= toAbs(2027, 6); m++) {
    const today = d(Math.floor(m / 12), (m % 12) + 1);
    const active = keys(activeTasks(lib, s, today)).includes(key('t', 2026, 11));
    const upcoming = m < inst.start - 2;
    const expired = isExpired(inst, today);
    assert.equal([active, upcoming, expired].filter(Boolean).length, 1, `month ${m % 12 + 1}/${Math.floor(m / 12)}`);
  }
});

// ---------- UI-01, LG-02: completing ----------

test('UI-01: ticking a task removes it from the active list', () => {
  const lib = libraryWith({ nov: [11], dec: [12] });
  let s = createInitialState(lib, d(2026, 11));
  s = completeTask(lib, s, key('nov', 2026, 11), d(2026, 11, 20));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11))), ['dec']);
});

test('LG-02: a ticked task is logged as "complete" with its window and the date', () => {
  const lib = libraryWith({ t: [11, 12, 1] });
  let s = createInitialState(lib, d(2026, 11));
  s = completeTask(lib, s, key('t', 2026, 11), d(2026, 12, 3));
  assert.deepEqual(s.log, [{
    key: key('t', 2026, 11), plantId: 't', taskId: 't_task',
    windowStart: '2026-11', windowEnd: '2027-01', status: 'complete', recordedOn: '2026-12-03',
  }]);
});

test('UI-01: a task can be ticked early, as soon as it appears (two months ahead)', () => {
  const lib = libraryWith({ jan: [1] });
  let s = createInitialState(lib, d(2026, 11));
  s = completeTask(lib, s, key('jan', 2027, 1), d(2026, 11));
  assert.equal(activeTasks(lib, s, d(2027, 1)).length, 0);
});

test('UI-01: only active tasks can be ticked, and only once', () => {
  const lib = libraryWith({ nov: [11], mar: [3] });
  let s = createInitialState(lib, d(2026, 11));
  assert.throws(() => completeTask(lib, s, key('mar', 2027, 3), d(2026, 11)), /not active/);
  s = completeTask(lib, s, key('nov', 2026, 11), d(2026, 11));
  assert.throws(() => completeTask(lib, s, key('nov', 2026, 11), d(2026, 11)), /not active/);
});

// ---------- D-02, TL-04: recurrence ----------

test('D-02: a Nov–Jan task ticked in December does not come back in January', () => {
  const lib = libraryWith({ hib: [11, 12, 1] });
  let s = createInitialState(lib, d(2026, 11));
  s = completeTask(lib, s, key('hib', 2026, 11), d(2026, 12));
  for (const today of [d(2027, 1), d(2027, 2), d(2027, 3)]) {
    assert.deepEqual(openApp(lib, s, today).active, [], `${today.month}/${today.year}`);
  }
});

test('TL-04: a completed task comes back for next year, two months before its window', () => {
  const lib = libraryWith({ war: [11, 12] });
  let s = createInitialState(lib, d(2026, 11));
  s = completeTask(lib, s, key('war', 2026, 11), d(2026, 11));
  assert.deepEqual(keys(activeTasks(lib, s, d(2027, 8))), [], 'August 2027: not yet');
  assert.deepEqual(keys(activeTasks(lib, s, d(2027, 9))), [key('war', 2027, 11)], 'September 2027: back');
});

test('TL-04: a skipped task also comes back for next year', () => {
  const lib = libraryWith({ sep: [9] });
  let { state } = openApp(lib, createInitialState(lib, d(2026, 9)), d(2026, 9));
  ({ state } = openApp(lib, state, d(2026, 11)));
  assert.equal(state.log[0]?.status, 'skipped');
  assert.deepEqual(keys(openApp(lib, state, d(2027, 7)).active), [key('sep', 2027, 9)]);
});

test('D-03: a task with two windows a year (yucca) is two separate tasks', () => {
  const lib = libraryWith({ yuc: [3, 4, 5, 9, 10, 11] });
  let s = createInitialState(lib, d(2026, 4));
  assert.deepEqual(keys(activeTasks(lib, s, d(2026, 4))), [key('yuc', 2026, 3)]);
  s = completeTask(lib, s, key('yuc', 2026, 3), d(2026, 4));
  assert.deepEqual(keys(activeTasks(lib, s, d(2026, 7))), [key('yuc', 2026, 9)], 'spring window still due');
});

// ---------- LG-01, LG-02, D-06: logging expired tasks ----------

test('LG-01 / LG-02: a task that expires un-ticked is logged as "skipped"', () => {
  const lib = libraryWith({ nov: [11] });
  const s = createInitialState(lib, d(2026, 11));
  assert.deepEqual(logExpired(lib, s, d(2026, 12)).added, [], 'December: still active, not skipped');
  const { added } = logExpired(lib, s, d(2027, 1, 4));
  assert.deepEqual(added.map((e) => [e.key, e.status, e.recordedOn]), [[key('nov', 2026, 11), 'skipped', '2027-01-04']]);
});

test('LG-01: completed tasks are not also logged as skipped', () => {
  const lib = libraryWith({ nov: [11] });
  let s = createInitialState(lib, d(2026, 11));
  s = completeTask(lib, s, key('nov', 2026, 11), d(2026, 11));
  assert.deepEqual(logExpired(lib, s, d(2027, 2)).added, []);
});

test('LG-01: logging expired tasks twice does not create duplicates', () => {
  const lib = libraryWith({ nov: [11] });
  const first = logExpired(lib, createInitialState(lib, d(2026, 11)), d(2027, 1));
  const second = logExpired(lib, first.state, d(2027, 1));
  assert.equal(second.added.length, 0);
  assert.equal(second.state.log.length, 1);
});

test('D-06: tasks that had already expired before first use are not logged as skipped', () => {
  // First use in November: September has already expired, October is still active.
  const lib = libraryWith({ sep: [9], oct: [10] });
  const s = createInitialState(lib, d(2026, 11));
  const { added } = logExpired(lib, s, d(2026, 12));
  assert.deepEqual(added.map((e) => e.plantId), ['oct']);
});

test('LG-01: if the app is not opened for over a year, every missed instance is logged once', () => {
  const lib = libraryWith({ mar: [3] });
  const s = createInitialState(lib, d(2026, 1));
  const { added } = logExpired(lib, s, d(2028, 6));
  assert.deepEqual(added.map((e) => e.windowStart), ['2026-03', '2027-03', '2028-03']);
});

test('LG-03: the log is listed most recent first', () => {
  const lib = libraryWith({ oct: [10], nov: [11] });
  let s = createInitialState(lib, d(2026, 10));
  s = completeTask(lib, s, key('nov', 2026, 11), d(2026, 10, 20));
  s = logExpired(lib, s, d(2026, 12, 2)).state; // October task skipped
  assert.deepEqual(logNewestFirst(s).map((e) => [e.plantId, e.status]), [['oct', 'skipped'], ['nov', 'complete']]);
});

// ---------- Engine properties ----------

test('Core: functions never change their inputs (new state is returned instead)', () => {
  const lib = deepFreeze(libraryWith({ oct: [10], nov: [11] }));
  const s = deepFreeze(createInitialState(lib, d(2026, 10)));
  assert.doesNotThrow(() => {
    completeTask(lib, s, key('nov', 2026, 11), d(2026, 11));
    logExpired(lib, s, d(2027, 1));
    activeTasks(lib, s, d(2026, 11));
    logNewestFirst(s);
  });
});

test('Core: plants missing from the library are ignored rather than crashing', () => {
  const lib = libraryWith({ nov: [11] });
  const s = { ...createInitialState(lib, d(2026, 11)), myPlants: [{ id: 'gone', speciesId: 'gone' }, { id: 'nov', speciesId: 'nov' }] };
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 11))), ['nov']);
});

// ---------- Real data ----------

test('TD-01: with the real database on 11 Nov 2026, the list matches a hand check', () => {
  const lib = realLibrary();
  const active = activeTasks(lib, createInitialState(lib, d(2026, 11, 11)), d(2026, 11, 11));
  const got = active.map((t) => `${t.task.id} ${t.key.split('|')[2]}`);
  // Hand check against the spreadsheet: tasks with any month in Oct 2026 – Jan 2027,
  // ordered by window start, then window end, then plant name.
  assert.deepEqual(got, [
    'task_pass_fert_1 2026-09', // Sep–Nov, Passionfruit
    'task_stag_fert_1 2026-09', // Sep–Nov, Staghorn fern
    'task_sun_plant_1 2026-09', // Sep–Nov, Sunflower
    'task_yuc_prune_1 2026-09', // Sep–Nov, Yucca (spring window)
    'task_elk_fert_1 2026-09',  // Sep–Feb (same start, ends later)
    'task_pro_prune_1 2026-10', // Oct–Dec
    'task_daf_prune_1 2026-11', // Nov–Dec, Daffodil
    'task_war_prune_1 2026-11', // Nov–Dec, Waratah
    'task_nhib_prune_1 2026-11', // Nov–Jan
    'task_pel_prune_1 2026-11', // Nov–Feb
    'task_sun_water_1 2026-12', // Dec–Jan, Sunflower
    'task_bnf_water_1 2026-12', // Dec–Feb, Birds nest fern
    'task_hyd_water_1 2026-12', // Dec–Feb, Hydrangea
    'task_stf_water_1 2026-12', // Dec–Feb, Soft tree fern
    'task_arum_prune_1 2027-01', // Jan–Feb, Arum lily
    'task_kang_prune_1 2027-01', // Jan–Mar
  ]);
});
