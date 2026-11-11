// LG-03 / WF-04: the read-only Log screen, most recent first.

import { describeLogEntry, logNewestFirst } from '../core/schedule.ts';
import type { PlantLibrary, UserState } from '../core/types.ts';
import { shortDate, windowLabelWithYear, yearMonthToAbs } from './format.ts';
import { TypeTag } from './TypeTag.tsx';

export function LogScreen({ library, state }: { library: PlantLibrary; state: UserState }) {
  const entries = logNewestFirst(state);
  return (
    <main className="screen">
      <header className="top">
        <div>
          <h1 className="brand">Log</h1>
          <p className="date">Tracking since {shortDate(state.trackingStart)}</p>
        </div>
        <a className="nav-button" href="#/">Tasks</a>
      </header>

      {entries.length === 0 ? (
        <p className="empty">
          Nothing logged yet. Ticked tasks appear here as complete; tasks whose time passed
          un-ticked appear as skipped.
        </p>
      ) : (
        <ul className="log">
          {entries.map((e) => {
            const info = describeLogEntry(library, state, e);
            return (
              <li key={e.key} className={`log-entry status-${e.status}`}>
                <span className="card-head">
                  <span className="task-title">{info.taskTitle}</span>
                  <span className={`status status-${e.status}`}>{e.status === 'complete' ? 'Complete' : 'Skipped'}</span>
                </span>
                <span className="plant">{info.plantName}</span>
                <span className="card-foot">
                  <TypeTag type={info.taskType} />
                  <span className="meta">
                    {windowLabelWithYear(yearMonthToAbs(e.windowStart), yearMonthToAbs(e.windowEnd))}
                    {' · '}
                    {e.status === 'complete' ? 'ticked' : 'noted'} {shortDate(e.recordedOn)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
