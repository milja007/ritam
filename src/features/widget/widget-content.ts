import type { TFunction } from 'i18next';

import { eveningCheckinDate } from '@/core/checkin';
import { progressSummary } from '@/core/gamification';
import { scoreHeadline, type ScoreHeadline } from '@/core/progress';
import { flamePalettes, type ColorThemeId } from '@/core/theme';
import { localDateOf } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import type { WidgetDayInput, WidgetLabels } from '@/core/widget';
import { getDb } from '@/db/open';
import { listBlocksForDate, listDayScores, listEveningCheckins, listXpEvents } from '@/db/repos';

/** Tekstovi widgeta u jeziku appa (widget nema i18n). */
export function widgetLabels(t: TFunction): WidgetLabels {
  return {
    now: t('widget.now'),
    next: t('widget.next'),
    free: t('widget.free'),
    dayDone: t('widget.dayDone'),
    noPlan: t('widget.noPlan'),
    openApp: t('widget.openApp'),
    streakUnit: t('widget.streakUnit'),
  };
}

/**
 * Rezultat **današnjeg** dana za widget (živi ili konačni) — ne jučerašnji koji Dan ističe do
 * večernjeg upita; widget pokazuje dan na koji se odnose Sada i Sljedeće.
 */
export function widgetDayScore(headline: ScoreHeadline): number | null {
  const today = headline.featuresYesterday ? headline.todayInProgress : headline.featured.today;
  return today?.score ?? null;
}

/** Sve što widget treba za dan `now`, iz lokalne baze. */
export async function loadWidgetInput(now: Date, t: TFunction, theme: ColorThemeId): Promise<WidgetDayInput> {
  const db = getDb();
  const date = localDateOf(now);
  const [blocks, events, checkins] = await Promise.all([
    listBlocksForDate(db, LOCAL_USER_ID, date),
    listXpEvents(db, LOCAL_USER_ID),
    listEveningCheckins(db, LOCAL_USER_ID),
  ]);
  const history = listDayScores(db, LOCAL_USER_ID, date);
  const summary = progressSummary(events, checkins, date, eveningCheckinDate(now));
  return {
    date,
    blocks,
    score: widgetDayScore(scoreHeadline(history.days, date, history.longestStreak)),
    streak: summary.streak.current,
    labels: widgetLabels(t),
    flame: flamePalettes[theme],
  };
}
