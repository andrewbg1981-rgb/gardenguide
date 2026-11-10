import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absMonth, absToString, absYear, parseDate, toAbs } from './months.ts';

test('months: absolute numbers carry across New Year', () => {
  const dec = toAbs(2026, 12);
  assert.equal(dec + 1, toAbs(2027, 1));
  assert.equal(absToString(dec + 2), '2027-02');
  assert.equal(absToString(toAbs(2027, 1) - 1), '2026-12');
});

test('months: round trip year and month', () => {
  for (let m = 1; m <= 12; m++) {
    const abs = toAbs(2026, m);
    assert.equal(absYear(abs), 2026);
    assert.equal(absMonth(abs), m);
  }
});

test('months: parseDate reads YYYY-MM-DD and rejects anything else', () => {
  assert.deepEqual(parseDate('2026-11-11'), { year: 2026, month: 11, day: 11 });
  assert.throws(() => parseDate('11/11/2026'));
  assert.throws(() => parseDate('2026-13-01'));
});
