// Turning dates and months into words for the screens.
import { absMonth, absYear } from '../core/months.ts';
import type { CalendarDate } from '../core/types.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const monthShort = (abs: number) => MONTHS[absMonth(abs) - 1]!;

/** 'Nov', or 'Nov – Jan' for a window of several months. */
export const windowLabel = (start: number, end: number) =>
  start === end ? monthShort(start) : `${monthShort(start)} – ${monthShort(end)}`;

/** Same, with the year: 'Nov 2026 – Jan 2027', 'Nov – Dec 2026'. */
export function windowLabelWithYear(start: number, end: number): string {
  if (start === end) return `${monthShort(start)} ${absYear(start)}`;
  return absYear(start) === absYear(end)
    ? `${monthShort(start)} – ${monthShort(end)} ${absYear(end)}`
    : `${monthShort(start)} ${absYear(start)} – ${monthShort(end)} ${absYear(end)}`;
}

/** 'Wednesday 11 November 2026'. Day of week worked out without the clock. */
export function longDate(d: CalendarDate): string {
  const dow = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  return `${DAYS[dow]} ${d.day} ${MONTHS_LONG[d.month - 1]} ${d.year}`;
}

/** '2026-11-11' -> '11 Nov 2026'. */
export function shortDate(text: string): string {
  const [y, m, d] = text.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** 'YYYY-MM' -> absolute month. */
export function yearMonthToAbs(text: string): number {
  const [y, m] = text.split('-').map(Number);
  return (y ?? 0) * 12 + ((m ?? 1) - 1);
}
