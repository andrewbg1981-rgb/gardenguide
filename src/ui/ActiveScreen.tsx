// WF-01..WF-04 / TD-01 / UI-01: the Active tasks screen.

import { useEffect, useRef, useState } from 'react';
import { dateToAbs } from '../core/months.ts';
import { MONTHS_AHEAD, MONTHS_BEFORE, activeTasks, timing, type Timing } from '../core/schedule.ts';
import type { CalendarDate, PlantLibrary, TaskInstance, UserState } from '../core/types.ts';
import { longDate, monthShort, windowLabel } from './format.ts';
import { TypeTag } from './TypeTag.tsx';

/** How long a ticked task stays visible (fading) before it leaves the list. */
const LEAVE_MS = 650;
/** How long the "Undo" bar stays up. */
const UNDO_MS = 6000;

interface Props {
  library: PlantLibrary;
  state: UserState;
  today: CalendarDate;
  onTick: (key: string) => void;
  onUndo: (key: string) => void;
}

export function ActiveScreen({ library, state, today, onTick, onUndo }: Props) {
  const tasks = activeTasks(library, state, today);
  const now = dateToAbs(today);
  const months = Array.from({ length: MONTHS_BEFORE + MONTHS_AHEAD + 1 }, (_, i) => now - MONTHS_BEFORE + i);

  // Ticked tasks fade out briefly before they are logged, so a slip can be
  // un-ticked; after that, the Undo bar is the way back.
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, number>());
  const [undo, setUndo] = useState<{ key: string; label: string } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  // Leaving the screen mid-fade (e.g. opening the Log) still records the tick.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  useEffect(() => () => {
    timers.current.forEach((t, key) => { clearTimeout(t); onTickRef.current(key); });
    timers.current.clear();
    clearTimeout(undoTimer.current);
  }, []);

  function toggle(t: TaskInstance, checked: boolean) {
    const next = new Set(leaving);
    if (!checked) {
      clearTimeout(timers.current.get(t.key));
      timers.current.delete(t.key);
      next.delete(t.key);
      setLeaving(next);
      return;
    }
    next.add(t.key);
    setLeaving(next);
    timers.current.set(t.key, window.setTimeout(() => {
      timers.current.delete(t.key);
      onTick(t.key);
      setLeaving((s) => { const n = new Set(s); n.delete(t.key); return n; });
      setUndo({ key: t.key, label: `${t.task.title} · ${t.species.name}` });
      clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
    }, LEAVE_MS));
  }

  return (
    <main className="screen">
      <header className="top">
        <div>
          <h1 className="brand">GardenGuide</h1>
          <p className="date">{longDate(today)}</p>
        </div>
        <a className="nav-button" href="#/log">Log</a>
      </header>

      <ol className="months" aria-label="Active period">
        {months.map((m) => (
          <li key={m} className={m === now ? 'month current' : 'month'} aria-current={m === now ? 'date' : undefined}>
            {monthShort(m)}
          </li>
        ))}
      </ol>

      <h2 className="section-title">
        Active tasks <span className="count">{tasks.length}</span>
      </h2>

      {tasks.length === 0 ? (
        <p className="empty">Nothing due between last month and two months ahead. Enjoy the garden.</p>
      ) : (
        <ul className="tasks">
          {tasks.map((t) => (
            <TaskCard key={t.key} task={t} now={now} when={timing(t, today)} leaving={leaving.has(t.key)} onToggle={toggle} />
          ))}
        </ul>
      )}

      {undo && (
        <div className="undo-bar" role="status">
          <span>Done: {undo.label}</span>
          <button type="button" className="text-button" onClick={() => { onUndo(undo.key); setUndo(null); }}>
            Undo
          </button>
        </div>
      )}
    </main>
  );
}

const TIMING_TEXT: Record<Timing, (t: TaskInstance, now: number) => string> = {
  overdue: (t) => `Overdue · ended ${monthShort(t.end)}`,
  now: (t, now) => (t.end === now ? 'Due now · ends this month' : `Due now · until ${monthShort(t.end)}`),
  upcoming: (t) => `Starts ${monthShort(t.start)}`,
};

function TaskCard({ task: t, now, when, leaving, onToggle }: {
  task: TaskInstance; now: number; when: Timing; leaving: boolean; onToggle: (t: TaskInstance, checked: boolean) => void;
}) {
  const id = `tick-${t.key}`;
  return (
    <li className={`card timing-${when}${leaving ? ' leaving' : ''}`}>
      <input id={id} type="checkbox" className="tick" checked={leaving}
        onChange={(e) => onToggle(t, e.target.checked)} aria-describedby={`${id}-plant`} />
      <label htmlFor={id} className="card-body">
        <span className="card-head">
          <span className="task-title">{t.task.title}</span>
          <span className="window">{windowLabel(t.start, t.end)}</span>
        </span>
        <span className="plant" id={`${id}-plant`}>{t.species.name}</span>
        <span className="description">{t.task.description}</span>
        <span className="card-foot">
          <TypeTag type={t.task.type} />
          <span className={`timing timing-${when}`}>{TIMING_TEXT[when](t, now)}</span>
        </span>
      </label>
    </li>
  );
}
