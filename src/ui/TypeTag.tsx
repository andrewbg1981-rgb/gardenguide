import type { TaskType } from '../core/types.ts';

const LABELS: Record<TaskType, string> = {
  pruning: 'Pruning', fertilising: 'Fertilising', watering: 'Watering', planting: 'Planting',
};

/** A task-type tag: cream text, coloured dot and border (palette roles in the baseline). */
export function TypeTag({ type }: { type: TaskType | null }) {
  if (!type) return null;
  return <span className={`tag tag-${type}`}>{LABELS[type]}</span>;
}
