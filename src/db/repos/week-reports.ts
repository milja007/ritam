import { and, eq, lt } from 'drizzle-orm';

import {
  buildWeekDiagnosis,
  LOCAL_WEEK_DIAGNOSIS_VERSION,
  periodStats,
  statsForAreas,
  type PeriodDay,
  type WeekDiagnosis,
  type WeekHistoryEntry,
} from '@/core/diagnosis';
import {
  checkinSchema,
  reportSchema,
  selectedScoreAreas,
  settingsSchema,
  type LocalDate,
  type Report,
} from '@/core/domain';
import { betterWeeksStreak, closedWeeks, isEveningCheckinComplete } from '@/core/gamification';
import { dayScore, weekStart } from '@/core/progress';
import { addDays } from '@/core/time/local-date';

import type { RitamDb } from '../db';
import { checkins, reports, settings } from '../schema';
import { listDayScores } from './day-scores';
import { defaultRepoDeps, type RepoDeps } from './deps';
import { readDayStats, reportOf } from './reports';

export type WeekReportResult = { report: Report; diagnosis: WeekDiagnosis };

/**
 * Lokalna dijagnoza tjedna u kojem je `date` (korak 36): statistika zaključenih dana tog i
 * prošlog tjedna → sekcije → upsert u `reports` (period `week`, `periodStart` = ponedjeljak).
 * Ulaze samo dani s ispunjenim večernjim upitom, svaki bodovan područjima koja su tada vrijedila
 * (P48). Prijedlog tjedna prati ranije tjedne dijagnoze: odbijeni se ne nudi dva tjedna, a
 * prihvaćeni se prenosi (i ostaje prihvaćen) dok ne potraje dva tjedna.
 *
 * Ponovno generiranje osvježi sekcije; odgovor na prijedlog, povratna informacija i `seenAt`
 * ostaju. Tjedan bez ijednog zaključenog dana nema dijagnozu → `null`, ništa se ne sprema.
 */
export function generateWeekReport(
  db: RitamDb,
  userId: string,
  date: LocalDate,
  deps: RepoDeps = defaultRepoDeps,
): WeekReportResult | null {
  const start = weekStart(date);
  const end = start === null ? null : addDays(start, 6);
  const previousStart = start === null ? null : addDays(start, -7);
  const previousEnd = start === null ? null : addDays(start, -1);
  const nextWeek = start === null ? null : addDays(start, 7);
  if (start === null || end === null || previousStart === null || previousEnd === null || nextWeek === null) {
    return null;
  }

  // Ubrojeni tjedni (kao za rang) zaključno s ovim: niz boljih tjedana i dosadašnji rekord.
  const weeks = closedWeeks(listDayScores(db, userId, end).days, nextWeek);
  const betterWeeks = betterWeeksStreak(weeks, nextWeek).current;
  const earlier = weeks.filter((week) => week.start < start).map((week) => week.average);
  const previousBest = earlier.length > 0 ? Math.max(...earlier) : null;

  const now = deps.now().toISOString();
  return db.transaction((tx) => {
    const eveningRows = tx
      .select()
      .from(checkins)
      .where(and(eq(checkins.userId, userId), eq(checkins.kind, 'evening')))
      .all()
      .map((row) => checkinSchema.parse(row));
    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const currentAreas = settingsRow ? selectedScoreAreas(settingsSchema.parse(settingsRow)) : (['plan'] as const);

    const days: PeriodDay[] = eveningRows
      .filter((row) => row.date >= previousStart && row.date <= end && isEveningCheckinComplete(row))
      .map((row) => {
        const stats = readDayStats(tx, userId, row.date, eveningRows);
        const areas = row.scoreAreas ?? currentAreas;
        return { stats: statsForAreas(stats, areas), score: dayScore(stats, areas).score };
      });
    const current = periodStats(start, end, 7, days);
    if (current.recorded === 0) return null;
    const previous = periodStats(previousStart, previousEnd, 7, days);

    const history: WeekHistoryEntry[] = tx
      .select()
      .from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, 'week'), lt(reports.periodStart, start)))
      .all()
      .map((row) => ({ start: row.periodStart, suggestion: row.suggestion, accepted: row.suggestionAccepted }));

    const diagnosis = buildWeekDiagnosis(current, previous, { history, betterWeeks, previousBest });
    const existing = tx.select().from(reports).where(reportOf(userId, 'week', start)).get();
    const stats = { current, previous: previous.recorded > 0 ? previous : null };
    const report = reportSchema.parse({
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      period: 'week',
      periodStart: start,
      sections: diagnosis,
      stats,
      promptVersion: LOCAL_WEEK_DIAGNOSIS_VERSION,
      suggestion: diagnosis.suggestion,
      // Prenesena promjena je već prihvaćena; nov prijedlog poništava odgovor na stari.
      suggestionAccepted: diagnosis.carried
        ? true
        : existing && existing.suggestion === diagnosis.suggestion
          ? existing.suggestionAccepted
          : null,
      helpful: existing?.helpful ?? null,
      feedbackComment: existing?.feedbackComment ?? null,
      seenAt: existing?.seenAt ?? null,
    });
    const values = { ...report, sections: diagnosis, stats };
    if (existing) {
      tx.update(reports).set(values).where(eq(reports.id, existing.id)).run();
    } else {
      tx.insert(reports).values(values).run();
    }
    return { report, diagnosis };
  });
}
