// WF-01..WF-04 / TD-01 / UI-01 / TK-02..TK-04 / TK-06: the Active tasks screen.

import { useEffect, useRef, useState } from 'react';
import { dateToAbs } from '../core/months.ts';
import { MONTHS_AHEAD, MONTHS_BEFORE, activeTasks, timing, type Timing } from '../core/schedule.ts';
import type { CalendarDate, PlantLibrary, TaskInstance, UserState } from '../core/types.ts';
import { longDate, monthShort, windowLabel } from './format.ts';
import { TaskDetails } from './TaskDetails.tsx';
import { TypeTag } from './TypeTag.tsx';

/** How long a ticked task stays visible (fading) before it leaves the list. */
const LEAVE_MS = 650;
/** How long the "Undo" bar stays up. */
const UNDO_MS = 6000;
/** Filter value for plants not yet placed in a zone. */
const NO_ZONE = '';

interface Props {
  library: PlantLibrary;
  state: UserState;
  today: CalendarDate;
  onTick: (key: string) => void;
  onDismiss: (key: string) => void;
  onUndo: (key: string) => void;
}

export function ActiveScreen({ library, state, today, onTick, onDismiss, onUndo }: Props) {
  const all = activeTasks(library, state, today);
  const now = dateToAbs(today);
  const months = Array.from({ length: MONTHS_BEFORE + MONTHS_AHEAD + 1 }, (_, i) => now - MONTHS_BEFORE + i);
  const zoneName = new Map(library.zones.map((z) => [z.id, z.name]));

  // TK-06: zone filter. null = all zones.
  const [zone, setZone] = useState<string | null>(null);
  const zoneOf = (t: TaskInstance) => t.species.zone ?? NO_ZONE;
  const counts = new Map<string, number>();
  for (const t of all) counts.set(zoneOf(t), (counts.get(zoneOf(t)) ?? 0) + 1);
  const filterOptions = [
    ...library.zones.filter((z) => counts.has(z.id)).map((z) => ({ id: z.id, label: z.name })),
    ...(counts.has(NO_ZONE) ? [{ id: NO_ZONE, label: 'No zone' }] : []),
  ];
  const tasks = zone === null ? all : all.filter((t) => zoneOf(t) === zone);

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

  function showUndo(key: string, label: string) {
    setUndo({ key, label });
    clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }

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
      showUndo(t.key, `Done: ${t.task.title} · ${t.species.name}`);
    }, LEAVE_MS));
  }

  function dismiss(t: TaskInstance) {
    onDismiss(t.key);
    showUndo(t.key, `Dismissed: ${t.task.title} · ${t.species.name}`);
  }

  return (
    <main className="screen">
      <header className="top">
        <div>
          <h1 className="brand">GardenGuide</h1>
          <p className="date">{longDate(today)}</p>
        </div>
        <nav className="nav">
          <a className="nav-button" href="#/map">Map</a>
          <a className="nav-button" href="#/log">Log</a>
        </nav>
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

      {filterOptions.length > 1 && (
        <div className="chips" role="group" aria-label="Filter by zone">
          <button type="button" className={zone === null ? 'chip on' : 'chip'} aria-pressed={zone === null}
            onClick={() => setZone(null)}>All</button>
          {filterOptions.map((o) => (
            <button key={o.id} type="button" className={zone === o.id ? 'chip on' : 'chip'} aria-pressed={zone === o.id}
              onClick={() => setZone(zone === o.id ? null : o.id)}>
              {o.label} <span className="chip-count">{counts.get(o.id)}</span>
            </button>
          ))}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="empty">Nothing due between last month and two months ahead.</p>
      ) : (
        <ul className="tasks">
          {tasks.map((t) => (
            <TaskCard key={t.key} task={t} now={now} when={timing(t, today)} leaving={leaving.has(t.key)}
              zone={t.species.zone ? zoneName.get(t.species.zone) ?? null : null}
              onToggle={toggle} onDismiss={dismiss} />
          ))}
        </ul>
      )}

      {undo && (
        <div className="undo-bar" role="status">
          <span>{undo.label}</span>
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

function TaskCard({ task: t, now, when, leaving, zone, onToggle, onDismiss }: {
  task: TaskInstance; now: number; when: Timing; leaving: boolean; zone: string | null;
  onToggle: (t: TaskInstance, checked: boolean) => void; onDismiss: (t: TaskInstance) => void;
}) {
  const id = `tick-${t.key}`;
  const critical = t.task.critical;
  return (
    <li className={`card timing-${when}${critical ? ' critical' : ''}${leaving ? ' leaving' : ''}`}>
      <div className="card-row">
        <input id={id} type="checkbox" className="tick" checked={leaving}
          onChange={(e) => onToggle(t, e.target.checked)} aria-describedby={`${id}-plant`} />
        <label htmlFor={id} className="card-body">
          <span className="card-head">
            <span className="task-title">{t.task.title}</span>
            <span className="window">{windowLabel(t.start, t.end)}</span>
          </span>
          <span className="plant" id={`${id}-plant`}>
            {t.species.name}{zone && <span className="zone-name"> · {zone}</span>}
          </span>
          <span className="card-foot">
            <TypeTag type={t.task.type} />
            {critical && <span className="critical-label">Critical</span>}
            <span className={`timing timing-${when}`}>{TIMING_TEXT[when](t, now)}</span>
          </span>
        </label>
      </div>
      <TaskDetails task={t} onDismiss={critical ? () => onDismiss(t) : undefined} />
    </li>
  );
}
