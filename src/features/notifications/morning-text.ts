import type { TFunction } from 'i18next';

import type { MorningSummary } from '@/core/notifications';

/**
 * Tijelo jutarnje obavijesti iz pregleda dana (odluka P33): "Danas 4 bloka, od toga 2 zadatka.
 * Prvi: Posao u 09:00." Dan bez blokova → poziv da složi dan.
 */
export function morningBody(t: TFunction, summary: MorningSummary): string {
  if (summary.blocks === 0 || summary.first === null) return t('notifications.morning.day.empty');
  const tasks = summary.tasks > 0 ? t('notifications.morning.day.tasks', { count: summary.tasks }) : '';
  return `${t('notifications.morning.day.blocks', { count: summary.blocks })}${tasks}. ${t(
    'notifications.morning.day.first',
    summary.first,
  )}`;
}
