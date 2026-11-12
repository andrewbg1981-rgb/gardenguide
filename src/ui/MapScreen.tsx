// ZN-02: the site plan with zone outlines. Selecting a zone lists its plants and
// their current tasks. The selected zone is part of the address (#/map/<zone>),
// so the phone's Back button returns to the previous selection.

import { useEffect, useState } from 'react';
import { activeTasks, timing } from '../core/schedule.ts';
import type { CalendarDate, PlantLibrary, TaskInstance, UserState, Zone } from '../core/types.ts';
import { monthShort, windowLabel } from './format.ts';
import { TypeTag } from './TypeTag.tsx';
import { NORTH_DEGREES, PLAN_HEIGHT, PLAN_WIDTH, ZONE_SHAPES, type Rect } from './zoneShapes.ts';

const zoneFromHash = () => decodeURIComponent(window.location.hash.match(/^#\/map\/(.+)$/)?.[1] ?? '') || null;

interface Props { library: PlantLibrary; state: UserState; today: CalendarDate }

export function MapScreen({ library, state, today }: Props) {
  const [selected, setSelected] = useState<string | null>(zoneFromHash);
  useEffect(() => {
    const onHash = () => setSelected(zoneFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const zones = new Map(library.zones.map((z) => [z.id, z]));
  const tasks = activeTasks(library, state, today);
  const zone = selected ? zones.get(selected) ?? null : null;
  const unplaced = library.plants.filter((p) => !p.zone || !zones.has(p.zone));

  return (
    <main className="screen screen-wide">
      <header className="top">
        <div>
          <h1 className="brand">Map</h1>
          <p className="date">Select a zone to see its plants and tasks.</p>
        </div>
        <nav className="nav">
          <a className="nav-button" href="#/">Tasks</a>
          <a className="nav-button" href="#/log">Log</a>
        </nav>
      </header>

      <p className="meta swipe-hint">Swipe sideways to see the whole garden.</p>
      <div className="map-scroll">
        <div className="map">
          <img className="plan" src={`${import.meta.env.BASE_URL}site-plan.png`} alt="" width={PLAN_WIDTH} height={PLAN_HEIGHT} />
          <svg viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`} className="zones" role="group" aria-label="Garden zones">
            {ZONE_SHAPES.filter((s) => zones.has(s.zoneId)).map((s) => {
              const z = zones.get(s.zoneId)!;
              const on = s.zoneId === selected;
              const big = largest(s.rects);
              const label = s.labelAt ?? { x: big.x + big.w / 2, y: big.y + big.h / 2 };
              const count = tasks.filter((t) => t.species.zone === s.zoneId).length;
              return (
                <a key={s.zoneId} href={on ? '#/map' : `#/map/${s.zoneId}`} className={on ? 'zone on' : 'zone'}
                  aria-label={`${z.name}: ${count} active tasks`} aria-current={on ? 'true' : undefined}>
                  {s.rects.map((rc, i) => (
                    <rect key={i} x={rc.x} y={rc.y} width={rc.w} height={rc.h} rx={34}
                      style={{ fill: s.colour, stroke: s.colour }} />
                  ))}
                  <text x={label.x} y={label.y} className="zone-label">
                    {z.name}{count ? ` · ${count}` : ''}
                  </text>
                </a>
              );
            })}
          </svg>
          <svg className="north" viewBox="-20 -20 40 40" aria-label="North arrow: north is to the top left">
            <g transform={`rotate(${NORTH_DEGREES})`}>
              <path d="M0 -14 L6 6 L0 2 L-6 6 Z" />
              <text y="-17" className="north-n" transform={`rotate(${-NORTH_DEGREES} 0 -20)`}>N</text>
            </g>
          </svg>
        </div>
      </div>

      {zone ? <ZonePanel zone={zone} library={library} tasks={tasks} today={today} />
        : unplaced.length > 0 && (
          <p className="meta">Not placed in a zone: {unplaced.map((p) => p.name).join(', ')}.</p>
        )}
    </main>
  );
}

function largest(rects: Rect[]): Rect {
  return rects.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
}

const WIND = { sheltered: 'Sheltered', moderate: 'Moderate', exposed: 'Exposed' } as const;
const LEVEL = { low: 'Low', moderate: 'Moderate', high: 'High' } as const;

function ZonePanel({ zone: z, library, tasks, today }: {
  zone: Zone; library: PlantLibrary; tasks: TaskInstance[]; today: CalendarDate;
}) {
  const plants = library.plants.filter((p) => p.zone === z.id);
  const sun = z.sun.min === null ? 'not recorded'
    : z.sun.min === z.sun.max ? `about ${z.sun.min}% of the day` : `${z.sun.min}–${z.sun.max}% of the day`;
  const soil = [z.soil.ph !== null ? `pH ${z.soil.ph}` : null, z.soil.texture, z.soil.drainage ? `${z.soil.drainage} drainage` : null]
    .filter(Boolean).join(', ') || 'not surveyed';
  return (
    <section className="zone-panel" aria-labelledby="zone-title">
      <h2 className="section-title" id="zone-title">{z.name}</h2>
      {z.theme && <p className="meta">{z.theme}{z.container ? ' (pots)' : ''}</p>}
      <dl className="facts">
        <div><dt>Sun</dt><dd>{sun}</dd></div>
        <div><dt>Wind</dt><dd>{z.wind.level ? WIND[z.wind.level] : 'not recorded'}{z.wind.level && !z.wind.confirmed ? ' (estimate)' : ''}</dd></div>
        <div><dt>Salt</dt><dd>{z.salt.level ? LEVEL[z.salt.level] : 'not recorded'}{z.salt.level && !z.salt.confirmed ? ' (estimate)' : ''}</dd></div>
        <div><dt>Soil</dt><dd>{soil}</dd></div>
      </dl>

      {plants.length === 0 ? <p className="empty">No plants placed in this zone.</p> : (
        <ul className="zone-plants">
          {plants.map((p) => {
            const own = tasks.filter((t) => t.species.id === p.id);
            return (
              <li key={p.id} className="zone-plant">
                <span className="card-head">
                  <span className="task-title">{p.name}</span>
                  {p.botanicalName && <span className="window">{p.botanicalName}</span>}
                </span>
                {own.length === 0 ? <span className="meta">No active tasks.</span> : (
                  <ul className="mini-tasks">
                    {own.map((t) => (
                      <li key={t.key}>
                        <TypeTag type={t.task.type} />
                        <span>{t.task.title}</span>
                        <span className="meta">
                          {windowLabel(t.start, t.end)}
                          {timing(t, today) === 'overdue' ? ` · overdue since ${monthShort(t.end)}` : ''}
                          {t.task.critical ? ' · critical' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p><a className="nav-button" href="#/map">Close</a></p>
    </section>
  );
}
