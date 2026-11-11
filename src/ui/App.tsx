// The whole app: loads the plant library and the user's saved state, then
// shows either the Active tasks screen (WF-01) or the Log screen (WF-04).
//
// React in one paragraph: each screen is a function that returns what should
// be on screen for the current data. When data changes (setSession), React
// calls the function again and updates only what differs. Think of it as
// combinational logic: outputs (the screen) are a pure function of the
// registers (the state); you only ever write the registers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import plantsData from '../../data/plants.json';
import { loadLibrary } from '../core/library.ts';
import type { CalendarDate, PlantLibrary } from '../core/types.ts';
import { openSession, tickTask, untickTask, type Session } from '../storage/session.ts';
import type { KeyValueStore } from '../storage/storage.ts';
import { ActiveScreen } from './ActiveScreen.tsx';
import { browserStore } from './browserStore.ts';
import { sameDay, todayLocal } from './clock.ts';
import { Flourishes } from './Flourishes.tsx';
import { LogScreen } from './LogScreen.tsx';

type Screen = 'active' | 'log';
const screenFromHash = (): Screen => (window.location.hash === '#/log' ? 'log' : 'active');

export function App() {
  const loaded = useMemo(() => {
    try {
      return { library: loadLibrary(plantsData) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  if ('error' in loaded) {
    return (
      <main className="screen">
        <h1 className="brand">GardenGuide</h1>
        <p className="notice">The plant database could not be loaded:</p>
        <pre className="error">{loaded.error}</pre>
      </main>
    );
  }
  return <Garden library={loaded.library} />;
}

function Garden({ library }: { library: PlantLibrary }) {
  const storage = useMemo(browserStore, []);
  const store: KeyValueStore = storage.store;
  const [today, setToday] = useState<CalendarDate>(todayLocal);
  const [session, setSession] = useState<Session>(() => openSession(library, store, today));
  const stateRef = useRef(session.state);
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  // Messages for the user collect here until dismissed.
  const [notices, setNotices] = useState<string[]>(() => [...(storage.notice ? [storage.notice] : []), ...session.notices]);
  const apply = useCallback((next: Session) => {
    stateRef.current = next.state;
    setSession(next);
    if (next.notices.length) setNotices((old) => [...new Set([...old, ...next.notices])]);
  }, []);

  // Screens are addressed by the URL's #, so the phone's Back button works.
  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // If the app is left open past midnight, refresh "today" when it is looked at again.
  const todayRef = useRef(today);
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      const now = todayLocal();
      if (sameDay(now, todayRef.current)) return;
      todayRef.current = now;
      setToday(now);
      apply(openSession(library, store, now));
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [library, store, apply]);

  // Ticks save to storage, so they run here, not inside a React update
  // (React may run an update twice in development, which would tick twice).
  const tick = useCallback((key: string) => {
    try {
      apply(tickTask(library, store, stateRef.current, key, todayRef.current));
    } catch {
      // Already ticked (e.g. a double tap): nothing to do.
    }
  }, [library, store, apply]);

  const untick = useCallback((key: string) => {
    apply(untickTask(store, stateRef.current, key));
  }, [store, apply]);

  return (
    <>
      <Flourishes />
      {notices.length > 0 && (
        <div className="notices" role="alert">
          {notices.map((n) => <p key={n} className="notice">{n}</p>)}
          <button type="button" className="text-button" onClick={() => setNotices([])}>Dismiss</button>
        </div>
      )}
      {screen === 'log'
        ? <LogScreen library={library} state={session.state} />
        : <ActiveScreen library={library} state={session.state} today={today} onTick={tick} onUndo={untick} />}
    </>
  );
}
