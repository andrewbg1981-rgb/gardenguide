// Month arithmetic.
//
// Dates crossing New Year are the main source of bugs in this app, so every
// month is converted to one absolute number:  year * 12 + (month - 1).
// Then "two months after December 2026" is just +2, with no special cases.
// (Hardware analogy: one wide counter instead of a month counter plus a year
// counter with carry logic.)

import type { CalendarDate, Month } from './types.ts';

/** Absolute month number, e.g. Nov 2026 -> 2026*12 + 10. */
export function toAbs(year: number, month: Month): number {
  return year * 12 + (month - 1);
}

export function absYear(abs: number): number {
  return Math.floor(abs / 12);
}

export function absMonth(abs: number): Month {
  return (abs % 12) + 1;
}

/** Absolute month number -> 'YYYY-MM'. */
export function absToString(abs: number): string {
  return `${absYear(abs)}-${String(absMonth(abs)).padStart(2, '0')}`;
}

export function dateToAbs(d: CalendarDate): number {
  return toAbs(d.year, d.month);
}

export function dateToString(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' -> CalendarDate. Throws on anything else. */
export function parseDate(text: string): CalendarDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${text}`);
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  if (d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) throw new Error(`Invalid date: ${text}`);
  return d;
}
