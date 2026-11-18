import type { TFunction } from 'i18next';

import type { Task } from '@/core/domain';
import { weekdayName } from '@/features/ember/format';

/** 45 → "45 min", 60 → "1 h", 90 → "1 h 30 min". */
export function durationText(t: TFunction, minutes: number): string {
  if (minutes < 60) return t('tasks.minutes', { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t('tasks.hours', { h }) : t('tasks.hoursMinutes', { h, m });
}

/** Odgovori zadatka u jednom retku: "1 h · 3× tjedno · navečer · do petka". */
export function taskSummary(t: TFunction, task: Task, language: string): string {
  const parts = [durationText(t, task.durationMinutes), t('tasks.times', { count: task.timesPerWeek })];
  if (task.partOfDay !== 'any') parts.push(t(`tasks.part.${task.partOfDay}`));
  if (task.energy !== 'medium') parts.push(t(`tasks.energy.${task.energy}`));
  if (task.deadline !== null) parts.push(t('tasks.until', { day: weekdayName(task.deadline, language) }));
  return parts.join(' · ');
}
