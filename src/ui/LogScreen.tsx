// LG-03 / WF-04: the read-only Log screen, most recent first.

import { useState } from 'react';
import { describeLogEntry, logNewestFirst } from '../core/schedule.ts';
import type { CalendarDate, PlantLibrary, UserState } from '../core/types.ts';
import { backupFileName, exportBackup } from '../storage/backup.ts';
import { shortDate, windowLabelWithYear, yearMonthToAbs } from './format.ts';
import { TypeTag } from './TypeTag.tsx';

const STATUS_LABEL = { complete: 'Complete', skipped: 'Skipped', dismissed: 'Dismissed' } as const;

interface Props {
  library: PlantLibrary;
  state: UserState;
  today: CalendarDate;
  /** DV-02: returns an error message, or null on success. */
  onImport: (text: string) => string | null;
}

export function LogScreen({ library, state, today, onImport }: Props) {
  const entries = logNewestFirst(state);
  return (
    <main className="screen">
      <header className="top">
        <div>
          <h1 className="brand">Log</h1>
          <p className="date">Tracking since {shortDate(state.trackingStart)}</p>
        </div>
        <nav className="nav">
          <a className="nav-button" href="#/">Tasks</a>
          <a className="nav-button" href="#/map">Map</a>
        </nav>
      </header>

      {entries.length === 0 ? (
        <p className="empty">
          Nothing logged yet. Ticked tasks appear here as complete; tasks whose time passed
          un-ticked appear as skipped; dismissed critical tasks appear as dismissed.
        </p>
      ) : (
        <ul className="log">
          {entries.map((e) => {
            const info = describeLogEntry(library, state, e);
            return (
              <li key={e.key} className={`log-entry status-${e.status}`}>
                <span className="card-head">
                  <span className="task-title">{info.taskTitle}</span>
                  <span className={`status status-${e.status}`}>{STATUS_LABEL[e.status]}</span>
                </span>
                <span className="plant">{info.plantName}</span>
                <span className="card-foot">
                  <TypeTag type={info.taskType} />
                  <span className="meta">
                    {windowLabelWithYear(yearMonthToAbs(e.windowStart), yearMonthToAbs(e.windowEnd))}
                    {' · '}
                    {e.status === 'complete' ? 'ticked' : e.status === 'dismissed' ? 'dismissed' : 'noted'} {shortDate(e.recordedOn)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Backup state={state} today={today} onImport={onImport} />
    </main>
  );
}

/** DV-02: export to a file, and import from one (with a confirmation step). */
function Backup({ state, today, onImport }: Omit<Props, 'library'>) {
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function download() {
    const url = URL.createObjectURL(new Blob([exportBackup(state, today)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(today);
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Saved ${backupFileName(today)} to this device's downloads.`);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setPending({ name: file.name, text: await file.text() });
  }

  function confirm() {
    if (!pending) return;
    const error = onImport(pending.text);
    setMessage(error ?? `Imported ${pending.name}.`);
    setPending(null);
  }

  return (
    <section className="backup" aria-labelledby="backup-title">
      <h2 className="section-title" id="backup-title">Backup</h2>
      <p className="meta">
        Ticks and the log are stored in this browser only. Export a copy to keep elsewhere (e.g. OneDrive),
        or import one to continue on another device.
      </p>
      <div className="backup-actions">
        <button type="button" className="text-button" onClick={download}>Export</button>
        <label className="text-button">
          Import…
          <input type="file" accept=".json,application/json" className="visually-hidden"
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {pending && (
        <div className="confirm" role="alertdialog" aria-label="Confirm import">
          <p>Replace the data in this browser with <strong>{pending.name}</strong>? The current data is kept as a copy in this browser.</p>
          <div className="backup-actions">
            <button type="button" className="text-button" onClick={confirm}>Replace</button>
            <button type="button" className="text-button" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      {message && <p className="meta" role="status">{message}</p>}
    </section>
  );
}
