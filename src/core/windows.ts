// Splitting a task's months into continuous windows (D-03).
//
//   [11, 12, 1]            -> one window: Nov–Jan (crosses New Year)
//   [3, 4, 5, 9, 10, 11]   -> two windows: Mar–May and Sep–Nov
//
// The months are treated as a ring (December is next to January).

import type { Month } from './types.ts';

export interface MonthWindow {
  /** First month of the window. */
  startMonth: Month;
  /** Number of months, 1–12. */
  length: number;
}

const next = (m: Month): Month => (m % 12) + 1;
const prev = (m: Month): Month => ((m + 10) % 12) + 1;

export function monthWindows(months: readonly Month[]): MonthWindow[] {
  const set = new Set(months);
  if (set.size === 0) return [];
  if (set.size === 12) return [{ startMonth: 1, length: 12 }];

  const windows: MonthWindow[] = [];
  for (const m of [...set].sort((a, b) => a - b)) {
    if (set.has(prev(m))) continue; // not the start of a run
    let length = 1;
    let cur = m;
    while (set.has(next(cur))) {
      cur = next(cur);
      length++;
    }
    windows.push({ startMonth: m, length });
  }
  return windows;
}
