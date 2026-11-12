// TK-04: a task's guidance, opened on request without leaving the list.
// Uses the browser's built-in <details> element: closed by default, one tap opens it.

import type { TaskInstance } from '../core/types.ts';

const TOLERANCE: Record<string, string> = {
  light: 'Light: tips and spent growth only',
  moderate: 'Moderate: up to about one third',
  hard: 'Hard: can be cut back heavily',
};

export function TaskDetails({ task: t, onDismiss }: { task: TaskInstance; onDismiss?: () => void }) {
  const s = t.species;
  const rows: [string, string | null][] = [
    ['How', t.task.description],
    ['How much', t.task.howMuch],
    ['Materials', t.task.materials.length ? t.task.materials.join(', ') : null],
    ['If missed', t.task.ifMissed],
    ['Why critical', t.task.critical ? t.task.criticalReason : null],
    ['Pruning', t.task.type === 'pruning' && s.pruning.tolerance
      ? `${TOLERANCE[s.pruning.tolerance]}. ${s.pruning.rule ?? ''}` : null],
    ['Deadheading', t.task.type === 'pruning' && s.deadhead.advice && s.deadhead.advice !== 'n/a'
      ? `${s.deadhead.advice === 'yes' ? 'Yes' : 'No'}${s.deadhead.note ? `. ${s.deadhead.note}` : ''}` : null],
    ['Feeding', t.task.type === 'fertilising' ? s.feedingNote : null],
    ['Cautions', s.cautions],
  ];
  return (
    <details className="card-details">
      <summary>Details</summary>
      <dl>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="detail-row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        <div className="detail-row">
          <dt>Basis</dt>
          <dd>
            Confidence: {t.task.basis.confidence}.{' '}
            {t.task.basis.sources.map((src, i) => (
              <span key={src}>
                {i > 0 && '; '}
                {/^https?:\/\//.test(src) ? <a href={src} target="_blank" rel="noreferrer">{new URL(src).hostname.replace(/^www\./, '')}</a> : src}
              </span>
            ))}
          </dd>
        </div>
      </dl>
      {onDismiss && (
        <p className="dismiss-row">
          <span>Critical tasks stay on the list until done or dismissed.</span>
          <button type="button" className="text-button" onClick={onDismiss}>Dismiss</button>
        </p>
      )}
    </details>
  );
}
