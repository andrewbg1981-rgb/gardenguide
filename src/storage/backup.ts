// DV-02: exporting personal data to a file, and importing it again.
// The file is plain JSON, so it can be kept anywhere (e.g. OneDrive) and read by eye.

import { dateToString } from '../core/months.ts';
import { parseUserState } from '../core/userState.ts';
import type { CalendarDate, UserState } from '../core/types.ts';

const FORMAT = 'gardenguide-backup';
const FORMAT_VERSION = 1;

/** The text of a backup file. */
export function exportBackup(state: UserState, today: CalendarDate): string {
  return JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION, exportedOn: dateToString(today), state }, null, 2) + '\n';
}

export const backupFileName = (today: CalendarDate) => `gardenguide-backup-${dateToString(today)}.json`;

/** Read a backup file's text. Throws with a plain explanation if it is not a usable GardenGuide backup. */
export function parseBackup(text: string): { state: UserState; exportedOn: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a GardenGuide backup (it is not readable JSON).');
  }
  const d = data as { format?: unknown; formatVersion?: unknown; exportedOn?: unknown; state?: unknown };
  if (typeof data !== 'object' || data === null || d.format !== FORMAT) {
    throw new Error('This file is not a GardenGuide backup.');
  }
  if (d.formatVersion !== FORMAT_VERSION) {
    throw new Error(`This backup was made by a different version of GardenGuide (format ${String(d.formatVersion)}).`);
  }
  try {
    return { state: parseUserState(d.state), exportedOn: String(d.exportedOn ?? '') };
  } catch (e) {
    throw new Error(`The backup is damaged: ${e instanceof Error ? e.message : String(e)}`);
  }
}
