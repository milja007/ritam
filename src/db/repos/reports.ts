import { and, desc, eq, inArray, lt, lte } from 'drizzle-orm';

import { betterWeeksStreak, closedWeeks, isEveningCheckinComplete, mainStreak } from '@/core/gamification';
import {
  buildDayDiagnosis,
  buildWeekDiagnosis,
  dayStats,
  diagnosisSuggestion,
  isWeekDiagnosisReady,
  LOCAL_DAY_DIAGNOSIS_VERSION,
  LOCAL_WEEK_DIAGNOSIS_VERSION,
  parseDayDiagnosis,
  periodStats,
  statsForAreas,
  type ArchiveEntry,
  type DayDiagnosis,
  type DayStats,
  type PeriodDay,
  type WeekDiagnosis,
  type WeekHistoryEntry,
} from '@/core/diagnosis';
import {
  checkinItemSchema,
  checkinSchema,
  reportSchema,
  ruleLogSchema,
  ruleSchema,
  scheduleBlockSchema,
  selectedScoreAreas,
  settingsSchema,
  xpEventSchema,
  type LocalDate,
  type Report,
  type ReportPeriod,
} from '@/core/domain';
import { dayScore, weekStart } from '@/core/progress';
import { addDays } from '@/core/time/local-date';

import type { RitamDb } from '../db';
import {
  checkinItems,
  checkins,
  reports,
  ruleLogs,
  rules,
  scheduleBlocks,
  settings,
  xpEvents,
} from '../schema';
import type { RitamTx } from './block-xp';
import { listDayScores } from './day-scores';
import { defaultRepoDeps, type RepoDeps } from './deps';

const reportOf = (userId: string, period: ReportPeriod, periodStart: LocalDate) =>
  and(eq(reports.userId, userId), eq(reports.period, period), eq(reports.periodStart, periodStart));

/** Dijagnoza razdoblja, ili `null` ako još nije napravljena. */
export async function getReport(
  db: RitamDb,
  userId: string,
  period: ReportPeriod,
  periodStart: LocalDate,
): Promise<Report | null> {
  const row = await db.select().from(reports).where(reportOf(userId, period, periodStart)).get();
  return row ? reportSchema.parse(row) : null;
}

/**
 * Arhiva dnevnih dijagnoza (Ž12): najnovije prvo, do `limit` zapisa, samo do dana `through`
 * (uključivo) — budući dani se ne pokazuju. Čita se samo za popis, pa se iz `sections` uzimaju
 * trend i „Ukratko“ redak; zapis koji nije lokalna dnevna dijagnoza (stara ili LLM verzija) se
 * preskače, bez greške. Ništa se ne generira ni ne sprema — dijagnoza se radi tek pri otvaranju.
 *
 * Napomena: `limit` je limit **pročitanih redaka**, ne vraćenih. Dok svi zapisi prolaze
 * `parseDayDiagnosis` (danas: samo lokalna dijagnoza) to je isto. Kad dođe LLM dijagnoza
 * (korak 31) i počne preskakati zapise, „ima li još“ u arhivi će znati reći „ne“ prerano —
 * tada paginaciju treba vezati na zadnji vraćeni dan, a ne na broj redaka.
 */
export async function listDayReportArchive(
  db: RitamDb,
  userId: string,
  through: LocalDate,
  limit: number,
): Promise<ArchiveEntry[]> {
  if (!Number.isInteger(limit) || limit <= 0) return [];
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, 'day'), lte(reports.periodStart, through)))
    .orderBy(desc(reports.periodStart))
    .limit(limit)
    .all();
  const entries: ArchiveEntry[] = [];
  for (const row of rows) {
    const diagnosis = parseDayDiagnosis(row.sections);
    if (diagnosis === null) continue;
    entries.push({
      date: row.periodStart,
      trend: diagnosis.trend,
      summary: diagnosis.summary,
      seen: row.seenAt !== null,
    });
  }
  return entries;
}

/** Statistika jednog dana unutar transakcije (`eveningRows` = svi večernji upiti korisnika, za streak). */
function readDayStats(
  tx: RitamTx,
  userId: string,
  date: LocalDate,
  eveningRows: ReturnType<typeof checkinSchema.parse>[],
): DayStats {
  const blocks = tx
    .select()
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.date, date)))
    .all()
    .map((row) => scheduleBlockSchema.parse(row));
  const dayCheckins = tx
    .select()
    .from(checkins)
    .where(and(eq(checkins.userId, userId), eq(checkins.date, date)))
    .all()
    .map((row) => checkinSchema.parse(row));
  const evening = dayCheckins.find((checkin) => checkin.kind === 'evening') ?? null;
  const morning = dayCheckins.find((checkin) => checkin.kind === 'morning') ?? null;
  const items = evening
    ? tx
        .select()
        .from(checkinItems)
        .where(and(eq(checkinItems.userId, userId), eq(checkinItems.checkinId, evening.id)))
        .all()
        .map((row) => checkinItemSchema.parse(row))
    : [];
  const userRules = tx
    .select()
    .from(rules)
    .where(eq(rules.userId, userId))
    .all()
    .map((row) => ruleSchema.parse(row));
  const logs =
    userRules.length > 0
      ? tx
          .select()
          .from(ruleLogs)
          .where(
            and(
              eq(ruleLogs.date, date),
              inArray(
                ruleLogs.ruleId,
                userRules.map((rule) => rule.id),
              ),
            ),
          )
          .all()
          .map((row) => ruleLogSchema.parse(row))
      : [];
  const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
  const sleepSettings = settingsRow ? settingsSchema.parse(settingsRow) : null;
  const xp = tx
    .select()
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), eq(xpEvents.date, date)))
    .all()
    .map((row) => xpEventSchema.parse(row));

  return dayStats({
    date,
    blocks,
    items,
    rules: userRules,
    ruleLogs: logs,
    evening,
    morning,
    sleepSettings,
    xpEvents: xp,
    streak: mainStreak(eveningRows, date).current,
  });
}

export type DayReportResult = { report: Report; diagnosis: DayDiagnosis };

/**
 * Lokalna dijagnoza dana `date` (korak 16): statistika dana i jučer → sekcije → upsert u
 * `reports` (period `day`). Jučer se uspoređuje samo ako je jučerašnji upit ispunjen (inače
 * statusi blokova nisu potvrđeni). Ponovno generiranje (npr. nakon uređivanja upita) osvježi
 * sekcije i statistiku, a povratna informacija (`helpful`, komentar) ostaje.
 */
export function generateDayReport(
  db: RitamDb,
  userId: string,
  date: LocalDate,
  deps: RepoDeps = defaultRepoDeps,
): DayReportResult {
  const now = deps.now().toISOString();
  return db.transaction((tx) => {
    const eveningRows = tx
      .select()
      .from(checkins)
      .where(and(eq(checkins.userId, userId), eq(checkins.kind, 'evening')))
      .all()
      .map((row) => checkinSchema.parse(row));
    const today = readDayStats(tx, userId, date, eveningRows);
    const yesterdayDate = addDays(date, -1);
    const yesterdayDone =
      yesterdayDate !== null &&
      eveningRows.some((row) => row.date === yesterdayDate && isEveningCheckinComplete(row));
    const yesterday = yesterdayDone ? readDayStats(tx, userId, yesterdayDate, eveningRows) : null;

    // Jučerašnja spremljena dijagnoza: ponovljena ideja ostaje i dodaje se nova (odluka P38).
    const previousRow =
      yesterdayDate === null ? undefined : tx.select().from(reports).where(reportOf(userId, 'day', yesterdayDate)).get();
    const previous = previousRow ? parseDayDiagnosis(previousRow.sections) : null;
    // Područja: snimka uz večernji upit dana (P48), inače trenutne postavke (prije onboardinga plan).
    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const currentAreas = settingsRow ? selectedScoreAreas(settingsSchema.parse(settingsRow)) : (['plan'] as const);
    const areasOf = (day: LocalDate | null) =>
      eveningRows.find((row) => row.date === day)?.scoreAreas ?? currentAreas;
    const diagnosis = buildDayDiagnosis(today, yesterday, {
      previous,
      areas: areasOf(date),
      yesterdayAreas: areasOf(yesterdayDate),
    });
    const suggestion = diagnosisSuggestion(diagnosis);
    const existing = tx.select().from(reports).where(reportOf(userId, 'day', date)).get();
    const report = reportSchema.parse({
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      period: 'day',
      periodStart: date,
      sections: diagnosis,
      stats: { today, yesterday },
      promptVersion: LOCAL_DAY_DIAGNOSIS_VERSION,
      suggestion,
      // Nova ideja → odgovor na staru više ne vrijedi.
      suggestionAccepted: existing && existing.suggestion === suggestion ? existing.suggestionAccepted : null,
      helpful: existing?.helpful ?? null,
      feedbackComment: existing?.feedbackComment ?? null,
      seenAt: existing?.seenAt ?? null,
    });
    const values = { ...report, sections: diagnosis, stats: { today, yesterday } };
    if (existing) {
      tx.update(reports).set(values).where(eq(reports.id, existing.id)).run();
    } else {
      tx.insert(reports).values(values).run();
    }
    return { report, diagnosis };
  });
}

/**
 * Označi dijagnozu dana pokupljenom (otvorena na Dan, korak 17d). Prvo otvaranje zapiše vrijeme,
 * kasnija ga ne mijenjaju. Vraća je li dijagnoza postojala.
 */
export function markReportSeen(
  db: RitamDb,
  userId: string,
  period: ReportPeriod,
  periodStart: LocalDate,
  deps: RepoDeps = defaultRepoDeps,
): boolean {
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, period, periodStart)).get();
    if (!row) return false;
    if (row.seenAt === null) {
      // I `updatedAt`: sync (zadnji updatedAt pobjeđuje) inače ne bi prenio `seenAt` na drugi uređaj.
      const now = deps.now().toISOString();
      tx.update(reports).set({ seenAt: now, updatedAt: now }).where(eq(reports.id, row.id)).run();
    }
    return true;
  });
}

export type WeekReportResult = { report: Report; diagnosis: WeekDiagnosis };

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lokalna dijagnoza tjedna koji počinje ponedjeljkom `start` (korak 36): statistika zaključenih
 * dana tog i prošlog tjedna → sekcije → upsert u `reports` (period `week`). Vraća `null` dok
 * dijagnoza nije dostupna (tjedan nije prošao, a nedjeljni upit nije ispunjen, ili tjedan nema
 * nijedan zaključen dan) i kad `start` nije ponedjeljak.
 *
 * Svaki dan se boduje i svodi na područja koja su vrijedila uz njegov večernji upit (P48).
 * Prijedlog prati ranije tjedne (`reports` s `period = 'week'`): prihvaćena promjena ostaje dva
 * tjedna i tada se sprema kao već prihvaćena, odbijena se ne nudi dva tjedna.
 *
 * Ponovni poziv bez promjene podataka ništa ne piše (da otvaranje taba ne dira `updatedAt` i
 * sync); s promjenom osvježi sekcije, a odgovor na prijedlog ostaje dok je prijedlog isti.
 */
export function generateWeekReport(
  db: RitamDb,
  userId: string,
  start: LocalDate,
  today: LocalDate,
  deps: RepoDeps = defaultRepoDeps,
): WeekReportResult | null {
  if (weekStart(start) !== start) return null;
  const end = addDays(start, 6);
  const nextStart = addDays(start, 7);
  const previousStart = addDays(start, -7);
  if (end === null || nextStart === null || previousStart === null) return null;

  // Niz boljih tjedana i dotadašnji rekord gledaju se „s ponedjeljka poslije“: tada je i ovaj
  // tjedan zaključen. Čita se prije transakcije (`listDayScores` otvara svoju).
  const weeks = closedWeeks(listDayScores(db, userId, end).days, nextStart);
  const betterWeeks = betterWeeksStreak(weeks, nextStart).current;
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
    const complete = new Map(
      eveningRows.filter((row) => row.date <= today && isEveningCheckinComplete(row)).map((row) => [row.date, row]),
    );
    if (!isWeekDiagnosisReady(end, today, complete.keys())) return null;

    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const currentAreas = settingsRow ? selectedScoreAreas(settingsSchema.parse(settingsRow)) : (['plan'] as const);
    const weekDays = (from: LocalDate): PeriodDay[] => {
      const days: PeriodDay[] = [];
      for (let offset = 0; offset < 7; offset += 1) {
        const date = addDays(from, offset);
        const evening = date === null ? undefined : complete.get(date);
        if (date === null || evening === undefined) continue;
        const full = readDayStats(tx, userId, date, eveningRows);
        const areas = evening.scoreAreas ?? currentAreas;
        days.push({ stats: statsForAreas(full, areas), score: dayScore(full, areas).score });
      }
      return days;
    };
    const current = periodStats(start, end, 7, weekDays(start));
    const previousDays = weekDays(previousStart);
    const previous = previousDays.length > 0 ? periodStats(previousStart, addDays(start, -1) ?? start, 7, previousDays) : null;

    const history: WeekHistoryEntry[] = tx
      .select()
      .from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, 'week'), lt(reports.periodStart, start)))
      .all()
      .map((row) => ({ start: row.periodStart, suggestion: row.suggestion, accepted: row.suggestionAccepted }));

    const diagnosis = buildWeekDiagnosis(current, previous, { history, betterWeeks, previousBest });
    const stats = { current, previous };
    const existing = tx.select().from(reports).where(reportOf(userId, 'week', start)).get();
    if (existing && sameJson(existing.sections, diagnosis) && sameJson(existing.stats, stats)) {
      return { report: reportSchema.parse(existing), diagnosis };
    }
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
      // Prenesena promjena je već prihvaćena; inače odgovor vrijedi samo dok je prijedlog isti.
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

/**
 * Odgovor na prijedlog iz dijagnoze („Probat ću“ / „Ne sada“). Vraća `false` kad dijagnoze nema
 * ili ne nudi prijedlog; isti odgovor drugi put ništa ne mijenja.
 */
export function answerReportSuggestion(
  db: RitamDb,
  userId: string,
  period: ReportPeriod,
  periodStart: LocalDate,
  accepted: boolean,
  deps: RepoDeps = defaultRepoDeps,
): boolean {
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, period, periodStart)).get();
    if (!row || row.suggestion === null) return false;
    if (row.suggestionAccepted !== accepted) {
      tx.update(reports)
        .set({ suggestionAccepted: accepted, updatedAt: deps.now().toISOString() })
        .where(eq(reports.id, row.id))
        .run();
    }
    return true;
  });
}
