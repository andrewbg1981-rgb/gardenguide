// The only place the app reads the clock (D-13). "Today" is the date on this
// device, in its own time zone — so in Sydney it is a Sydney date.
import type { CalendarDate } from '../core/types.ts';

export function todayLocal(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export const sameDay = (a: CalendarDate, b: CalendarDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;
