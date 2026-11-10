import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthWindows } from './windows.ts';

test('DM-03: a single run of months is one window', () => {
  assert.deepEqual(monthWindows([3, 4, 5]), [{ startMonth: 3, length: 3 }]);
});

test('DM-03: a single month is a one-month window', () => {
  assert.deepEqual(monthWindows([9]), [{ startMonth: 9, length: 1 }]);
});

test('D-03: a run crossing New Year is one window starting in the earlier year', () => {
  assert.deepEqual(monthWindows([11, 12, 1]), [{ startMonth: 11, length: 3 }]);
  assert.deepEqual(monthWindows([9, 10, 11, 12, 1, 2]), [{ startMonth: 9, length: 6 }]);
});

test('D-03: month order in the data does not matter', () => {
  assert.deepEqual(monthWindows([1, 12, 11]), [{ startMonth: 11, length: 3 }]);
});

test('D-03: separate runs become separate windows (yucca)', () => {
  assert.deepEqual(monthWindows([3, 4, 5, 9, 10, 11]), [
    { startMonth: 3, length: 3 },
    { startMonth: 9, length: 3 },
  ]);
});

test('D-03: separate runs, one of them crossing New Year', () => {
  assert.deepEqual(monthWindows([1, 5, 6, 12]), [
    { startMonth: 5, length: 2 },
    { startMonth: 12, length: 2 },
  ]);
});

test('D-03: all twelve months is one year-long window from January', () => {
  assert.deepEqual(monthWindows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), [{ startMonth: 1, length: 12 }]);
});

test('D-03: no months means no windows', () => {
  assert.deepEqual(monthWindows([]), []);
});
