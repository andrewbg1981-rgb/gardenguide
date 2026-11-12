import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeTasks, completeTask, createInitialState, describeLogEntry, earliestFirst, instanceKey, isExpired, logExpired,
  logNewestFirst, timing, undoComplete, dismissTask,
} from './schedule.ts';
import { toAbs } from './months.ts';
import { d, deepFreeze, libraryWith, realLibrary, testTask } from './test-helpers.ts';
import { validateUserState } from './userState.ts';
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
  assert.deepEqual(s.myPlants[0], { id: lib.plants[0]!.id, speciesId: lib.plants[0]!.id });
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

test('TD-01 / TL-01 / TK-02 / TK-03: with the real database, every month of the year gives a correct, complete, ordered list', () => {
  // Checked against the rules directly, so the test holds whatever the spreadsheet says.
  const lib = realLibrary();
  const state = createInitialState(lib, d(2026, 11, 11));
  for (let month = 1; month <= 12; month++) {
    const today = d(2027, month, 15);
    const now = toAbs(2027, month);
    const active = activeTasks(lib, state, today);
    // Correct: a window overlapping last month .. two months ahead, or (critical only)
    // an earlier unfinished window whose next one has not yet started (D-14).
    for (const t of active) {
      const inPeriod = t.end >= now - 1 && t.start <= now + 2;
      const nextStart = t.start + 12;
      assert.ok(inPeriod || (t.task.critical && t.end < now && nextStart > now), `${t.key} in month ${month}`);
    }
    // Complete: every task with a month in the active period is listed.
    for (const p of lib.plants) for (const task of p.tasks) {
      const due = [-1, 0, 1, 2].some((k) => task.months.includes(((month - 1 + k + 12) % 12) + 1));
      if (due) assert.ok(active.some((t) => t.task.id === task.id), `${task.id} missing in month ${month}`);
    }
    // Ordered (TK-03): critical overdue, critical now, routine now/overdue, upcoming;
    // then window start, end, plant name, task title (D-08).
    const rank = (t: TaskInstance) => {
      const w = timing(t, today);
      return w === 'upcoming' ? 3 : !t.task.critical ? 2 : w === 'overdue' ? 0 : 1;
    };
    for (let i = 1; i < active.length; i++) {
      const [x, y] = [active[i - 1]!, active[i]!];
      const cmp = rank(x) - rank(y) || x.start - y.start || x.end - y.end ||
        x.species.name.localeCompare(y.species.name) || x.task.title.localeCompare(y.task.title);
      assert.ok(cmp <= 0, `order in month ${month}: ${x.key} before ${y.key}`);
    }
  }
});

// ---------- TK-02 / TK-03 / D-14: critical tasks ----------

/** A library with one critical task 'crit' and one routine task 'rout'. */
function mixedLibrary(critMonths: number[], routMonths: number[]): PlantLibrary {
  const lib = libraryWith({ crit: critMonths, rout: routMonths });
  lib.plants[0]!.tasks[0] = testTask('crit_task', critMonths, 'pruning', true);
  return lib;
}

test('TK-02: a critical task stays on the list after its grace month; a routine one lapses', () => {
  const lib = mixedLibrary([11], [11]);
  const s = createInitialState(lib, d(2026, 11));
  const inMarch = activeTasks(lib, s, d(2027, 3));
  assert.deepEqual(ids(inMarch), ['crit']);
  assert.equal(timing(inMarch[0]!, d(2027, 3)), 'overdue');
  const logged = logExpired(lib, s, d(2027, 3)).added.map((e) => `${e.plantId} ${e.status}`);
  assert.deepEqual(logged, ['rout skipped'], 'the critical task is not logged as skipped');
});

test('D-14: when its next window starts, an unfinished critical task is logged skipped and replaced', () => {
  const lib = mixedLibrary([11], []);
  lib.plants = [lib.plants[0]!];
  const s = createInitialState(lib, d(2026, 11));
  const nextYear = d(2027, 11);
  assert.deepEqual(activeTasks(lib, s, nextYear).map((t) => t.key), [key('crit', 2027, 11)]);
  const { added } = logExpired(lib, s, nextYear);
  assert.deepEqual(added.map((e) => `${e.windowStart} ${e.status}`), ['2026-11 skipped']);
});

test('TK-02 / D-06: critical tasks from before tracking started are not owed', () => {
  const lib = mixedLibrary([7, 8], []);
  lib.plants = [lib.plants[0]!];
  const s = createInitialState(lib, d(2026, 11, 11));    // Jul–Aug 2026 window ended before first use
  assert.deepEqual(activeTasks(lib, s, d(2027, 1)), []);
  assert.deepEqual(logExpired(lib, s, d(2027, 1)).added, []);
});

test('TK-02: a critical task can be dismissed; it is logged as dismissed and leaves the list', () => {
  const lib = mixedLibrary([11], [11]);
  const s = createInitialState(lib, d(2026, 11));
  const k = activeTasks(lib, s, d(2027, 3))[0]!.key;
  const after = dismissTask(lib, s, k, d(2027, 3));
  assert.deepEqual(after.log.map((e) => e.status), ['dismissed']);
  assert.deepEqual(activeTasks(lib, after, d(2027, 3)), []);
  assert.deepEqual(validateUserState(after), []);
});

test('TK-02: routine tasks cannot be dismissed (they lapse on their own)', () => {
  const lib = mixedLibrary([11], [11]);
  const s = createInitialState(lib, d(2026, 11));
  assert.throws(() => dismissTask(lib, s, key('rout', 2026, 11), d(2026, 11)), /routine/);
});

test('D-12: a dismissal can be undone', () => {
  const lib = mixedLibrary([11], []);
  const s = createInitialState(lib, d(2026, 11));
  const k = activeTasks(lib, s, d(2026, 11))[0]!.key;
  const undone = undoComplete(dismissTask(lib, s, k, d(2026, 11)), k);
  assert.equal(activeTasks(lib, undone, d(2026, 11)).length, 1);
});

test('TK-03: order is critical overdue, critical now, routine now, then upcoming', () => {
  const lib = libraryWith({ a_up: [1], b_rnow: [12], c_cnow: [12], d_cover: [10], e_rover: [11] });
  lib.plants[2]!.tasks[0]!.critical = true; lib.plants[2]!.tasks[0]!.criticalReason = 'test';
  lib.plants[3]!.tasks[0]!.critical = true; lib.plants[3]!.tasks[0]!.criticalReason = 'test';
  const s = createInitialState(lib, d(2026, 10));
  assert.deepEqual(ids(activeTasks(lib, s, d(2026, 12))), ['d_cover', 'c_cnow', 'e_rover', 'b_rnow', 'a_up']);
});

// ---------- D-12: undo ----------

test('D-12: undoing a tick makes the task active again', () => {
  const lib = libraryWith({ nov: [11] });
  const s = createInitialState(lib, d(2026, 11));
  const ticked = completeTask(lib, s, key('nov', 2026, 11), d(2026, 11));
  const undone = undoComplete(ticked, key('nov', 2026, 11));
  assert.deepEqual(keys(activeTasks(lib, undone, d(2026, 11))), [key('nov', 2026, 11)]);
});

test('D-12: undo only removes "complete" entries — skipped history stays', () => {
  const lib = libraryWith({ nov: [11] });
  const s = logExpired(lib, createInitialState(lib, d(2026, 11)), d(2027, 1)).state;
  assert.equal(undoComplete(s, key('nov', 2026, 11)), s);
});

// ---------- LG-03: naming log entries ----------

test('LG-03: a log entry is shown with its plant name and task title', () => {
  const lib = libraryWith({ waratah: [11] });
  lib.plants[0]!.name = 'Waratah';
  lib.plants[0]!.tasks[0]!.title = 'Prune after flowering';
  const s = createInitialState(lib, d(2026, 11, 11));
  const done = completeTask(lib, s, key('waratah', 2026, 11), d(2026, 11, 11));
  assert.deepEqual(describeLogEntry(lib, done, done.log[0]!),
    { plantName: 'Waratah', taskTitle: 'Prune after flowering', taskType: 'pruning' });
});

test('LG-03: a log entry whose plant has left the library still shows (by its ids)', () => {
  const lib = libraryWith({ nov: [11] });
  const s = completeTask(lib, createInitialState(lib, d(2026, 11)), key('nov', 2026, 11), d(2026, 11));
  assert.deepEqual(describeLogEntry(libraryWith({ other: [1] }), s, s.log[0]!),
    { plantName: 'nov', taskTitle: 'nov_task', taskType: null });
});

// ---------- TL-01: timing labels ----------

test('TL-01: each active task is labelled overdue, now or upcoming (across New Year)', () => {
  const lib = libraryWith({ nov: [11], dec: [12, 1], feb: [2] });
  const s = createInitialState(lib, d(2026, 12));
  const labels = activeTasks(lib, s, d(2026, 12)).map((t) => `${t.plant.id} ${timing(t, d(2026, 12))}`);
  assert.deepEqual(labels, ['nov overdue', 'dec now', 'feb upcoming']);
});
