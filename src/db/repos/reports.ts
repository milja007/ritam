import { and, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm';

import { betterWeeksStreak, closedWeeks, isEveningCheckinComplete, mainStreak } from '@/core/gamification';
import {
  buildDayDiagnosis,
  buildMonthDiagnosis,
  buildRollingWeekDiagnosis,
  buildWeekDiagnosis,
  dayStats,
  diagnosisSuggestion,
  earlierMonthAverages,
  isMonthDiagnosisReady,
  isYearDiagnosisReady,
  buildYearDiagnosis,
  earlierYearAverages,
  yearBounds,
  yearChanges,
  LOCAL_YEAR_DIAGNOSIS_VERSION,
  llmYearTextSchema,
  parseYearDiagnosis,
  type LlmPreviousYearReport,
  type LlmYearText,
  type YearDiagnosis,
  isWeekDiagnosisReady,
  llmDayTextSchema,
  llmMonthTextSchema,
  llmWeekTextSchema,
  LOCAL_DAY_DIAGNOSIS_VERSION,
  LOCAL_MONTH_DIAGNOSIS_VERSION,
  LOCAL_WEEK_DIAGNOSIS_VERSION,
  monthBounds,
  monthChanges,
  parseDayDiagnosis,
  parseMonthDiagnosis,
  parseWeekDiagnosis,
  periodStats,
  rollingWeekStart,
  statsForAreas,
  type ArchiveEntry,
  type DayDiagnosis,
  type DayStats,
  type LlmDayText,
  type LlmPreviousReport,
  type LlmMonthText,
  type LlmPreviousMonthReport,
  type LlmPreviousWeekReport,
  type LlmWeekDay,
  type LlmWeekText,
  type PeriodStats,
  type MonthDiagnosis,
  type PeriodDay,
  type WeekDiagnosis,
  type WeekHistoryEntry,
} from '@/core/diagnosis';
import {
  checkinItemSchema,
  checkinSchema,
  noteSchema,
  reportSchema,
  ruleLogSchema,
  ruleSchema,
  scheduleBlockSchema,
  selectedScoreAreas,
  settingsSchema,
  trackerEntrySchema,
  xpEventSchema,
  type LocalDate,
  type Report,
  type ReportPeriod,
} from '@/core/domain';
import { dayScore, weekStart, type ScorePart } from '@/core/progress';
import { addDays } from '@/core/time/local-date';
import { trackerDay } from '@/core/trackers';

import type { RitamDb } from '../db';
import {
  checkinItems,
  checkins,
  reports,
  ruleLogs,
  rules,
  scheduleBlocks,
  settings,
  trackerEntries,
  xpEvents,
} from '../schema';
import type { RitamTx } from './block-xp';
import { listDayScores } from './day-scores';
import { defaultRepoDeps, type RepoDeps } from './deps';

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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
  // Trackeri (korak 31b): unosi tog dana; ulaze samo uključeni (`trackerDay`).
  const entries = tx
    .select()
    .from(trackerEntries)
    .where(and(eq(trackerEntries.userId, userId), eq(trackerEntries.date, date)))
    .all()
    .map((row) => trackerEntrySchema.parse(row));

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
    trackers: trackerDay(entries, sleepSettings, date),
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
    const existing = tx.select().from(reports).where(reportOf(userId, 'day', date)).get();
    // Riječi modela (korak 31) ostaju samo dok se činjenice dana nisu promijenile.
    const existingLlm = existing ? parseDayDiagnosis(existing.sections)?.llm : undefined;
    if (existingLlm && sameJson(existing?.stats, { today, yesterday })) diagnosis.llm = existingLlm;
    const suggestion = diagnosisSuggestion(diagnosis);
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


/** Tekst modela spremljene mjesečne dijagnoze (korak 31d), ako je valjan. */
const monthLlmOf = (sections: unknown): LlmMonthText | undefined => {
  const llm = typeof sections === 'object' && sections !== null && 'llm' in sections ? sections.llm : undefined;
  const result = llmMonthTextSchema.safeParse(llm);
  return result.success ? result.data : undefined;
};

/** Tekst modela spremljene godišnje dijagnoze (korak 31e), ako je valjan. */
const yearLlmOf = (sections: unknown): LlmYearText | undefined => {
  const llm = typeof sections === 'object' && sections !== null && 'llm' in sections ? sections.llm : undefined;
  const result = llmYearTextSchema.safeParse(llm);
  return result.success ? result.data : undefined;
};

/** Sve ideje spremljenih sekcija i nove dijagnoze su iste. */
const sameIdeas = (stored: unknown, next: { ideas: readonly unknown[] }): boolean =>
  sameJson(
    typeof stored === 'object' && stored !== null && 'ideas' in stored ? stored.ideas : null,
    next.ideas,
  );

/** Prva ideja spremljenih sekcija i nove dijagnoze je ista (ključ i parametri). */
const sameIdea = (stored: unknown, next: { ideas: readonly unknown[] }): boolean => {
  const storedIdeas =
    typeof stored === 'object' && stored !== null && 'ideas' in stored && Array.isArray(stored.ideas)
      ? (stored.ideas as unknown[])
      : [];
  return sameJson(storedIdeas[0] ?? null, next.ideas[0] ?? null);
};

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
    // Riječi modela (korak 31c) ostaju dok su statistika tjedna i promjena tjedna iste.
    const existingDiagnosis = existing ? parseWeekDiagnosis(existing.sections) : null;
    if (
      existingDiagnosis?.llm &&
      sameJson(existing?.stats, stats) &&
      existingDiagnosis.suggestion === diagnosis.suggestion &&
      sameJson(existingDiagnosis.ideas, diagnosis.ideas)
    ) {
      diagnosis.llm = existingDiagnosis.llm;
    }
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
      // Prenesena promjena je već prihvaćena; inače odgovor vrijedi samo dok je konkretna ideja
      // ista — isti ključ i isti parametri (npr. ista zabrana i okidač), P2 Codexa za PR #21.
      suggestionAccepted: diagnosis.carried
        ? true
        : existing && existing.suggestion === diagnosis.suggestion && sameIdea(existing.sections, diagnosis)
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
 * „Zadnjih 7 dana“ koji završavaju danom `end` (koncept: zadnji dan mjeseca koji nije nedjelja):
 * statistika zaključenih dana `end−6..end` naspram 7 dana prije → pregled bez prijedloga. **Samo
 * čita** — ne sprema u `reports` (ključ tjedne dijagnoze je ponedjeljak, a tjedni prijedlozi i niz
 * boljih tjedana ostaju vezani uz kalendarski tjedan). `null` dok nije dostupno (kao tjedna:
 * upit za `end` ispunjen ili `end` prošao, barem jedan zaključen dan) i za neispravan datum.
 */
export function previewRollingWeek(db: RitamDb, userId: string, end: LocalDate, today: LocalDate): WeekDiagnosis | null {
  const start = rollingWeekStart(end);
  const previousStart = addDays(end, -13);
  const previousEnd = addDays(end, -7);
  if (start === null || previousStart === null || previousEnd === null) return null;

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
    const daysFrom = (from: LocalDate): PeriodDay[] => {
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
    const current = periodStats(start, end, 7, daysFrom(start));
    const previousDays = daysFrom(previousStart);
    const previous = previousDays.length > 0 ? periodStats(previousStart, previousEnd, 7, previousDays) : null;
    return buildRollingWeekDiagnosis(current, previous);
  });
}

export type MonthReportResult = { report: Report; diagnosis: MonthDiagnosis };

/**
 * Lokalna dijagnoza mjeseca `month` ("YYYY-MM", korak 37): statistika zaključenih dana tog i
 * prošlog mjeseca → sekcije → upsert u `reports` (period `month`, `periodStart` = prvi dan).
 * `null` dok nije dostupna (mjesec nije prošao, a upit zadnjeg dana nije ispunjen, ili mjesec
 * nema nijedan zaključen dan) i za neispravan mjesec.
 *
 * Kao tjedna: dani se boduju po snimci područja uz svoj upit (P48), a ponovni poziv bez promjene
 * ništa ne piše. Mjesec ne nudi prijedlog za prihvaćanje (`suggestion = null`): ideje su smjer,
 * a promjene po jednu nudi tjedna dijagnoza. Pregled promjena broji odgovore tjednih dijagnoza
 * čiji tjedan počinje u tom mjesecu.
 */
export function generateMonthReport(
  db: RitamDb,
  userId: string,
  month: string,
  today: LocalDate,
  deps: RepoDeps = defaultRepoDeps,
): MonthReportResult | null {
  const bounds = monthBounds(month);
  if (bounds === null) return null;
  const previousEnd = addDays(bounds.start, -1);
  const previousBounds = previousEnd === null ? null : monthBounds(previousEnd.slice(0, 7));
  if (previousBounds === null) return null;

  // Dotadašnji rekord: prosjeci ranijih mjeseci (čita se prije transakcije, kao kod tjedna).
  const earlier = earlierMonthAverages(listDayScores(db, userId, bounds.end).days, month);
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
    if (!isMonthDiagnosisReady(month, today, complete.keys())) return null;

    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const currentAreas = settingsRow ? selectedScoreAreas(settingsSchema.parse(settingsRow)) : (['plan'] as const);
    const closedDays = (start: LocalDate, end: LocalDate): PeriodDay[] =>
      [...complete.entries()]
        .filter(([date]) => date >= start && date <= end)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, evening]) => {
          const full = readDayStats(tx, userId, date, eveningRows);
          const areas = evening.scoreAreas ?? currentAreas;
          return { stats: statsForAreas(full, areas), score: dayScore(full, areas).score };
        });
    const days = closedDays(bounds.start, bounds.end);
    const current = periodStats(bounds.start, bounds.end, bounds.length, days);
    const previousDays = closedDays(previousBounds.start, previousBounds.end);
    const previous =
      previousDays.length > 0
        ? periodStats(previousBounds.start, previousBounds.end, previousBounds.length, previousDays)
        : null;

    const weekAnswers = tx
      .select()
      .from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, 'week')))
      .all()
      .map((row) => {
        const week = parseWeekDiagnosis(row.sections);
        return {
          start: row.periodStart,
          suggestion: row.suggestion,
          accepted: row.suggestionAccepted,
          idea: week ? JSON.stringify(week.ideas[0] ?? null) : null,
          carried: week?.carried === true,
        };
      });
    const changes = monthChanges(month, weekAnswers);

    const diagnosis = buildMonthDiagnosis(current, previous, days, { previousBest, changes });
    const stats = { current, previous };
    const existing = tx.select().from(reports).where(reportOf(userId, 'month', bounds.start)).get();
    // Riječi modela (korak 31d) ostaju dok su statistika mjeseca i smjer isti.
    const existingLlm = existing ? monthLlmOf(existing.sections) : undefined;
    if (existingLlm && sameJson(existing?.stats, stats) && sameIdeas(existing?.sections, diagnosis)) {
      diagnosis.llm = existingLlm;
    }
    if (existing && sameJson(existing.sections, diagnosis) && sameJson(existing.stats, stats)) {
      return { report: reportSchema.parse(existing), diagnosis };
    }
    const report = reportSchema.parse({
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      period: 'month',
      periodStart: bounds.start,
      sections: diagnosis,
      stats,
      promptVersion: LOCAL_MONTH_DIAGNOSIS_VERSION,
      suggestion: null,
      suggestionAccepted: null,
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

export type YearReportResult = { report: Report; diagnosis: YearDiagnosis };

/**
 * Lokalna dijagnoza godine `year` ("YYYY", korak 37b): statistika zaključenih dana te i prošle
 * godine → sekcije → upsert u `reports` (period `year`, `periodStart` = 1. 1.). `null` dok nije
 * dostupna (godina nije prošla, a upit 31. 12. nije ispunjen, ili godina nema zaključen dan) i
 * za neispravnu godinu. Pravila kao mjesečna: dani po snimci područja (P48), bez promjene ne
 * piše, bez prijedloga za prihvaćanje; pregled promjena broji tjedne dijagnoze godine.
 */
export function generateYearReport(
  db: RitamDb,
  userId: string,
  year: string,
  today: LocalDate,
  deps: RepoDeps = defaultRepoDeps,
): YearReportResult | null {
  const bounds = yearBounds(year);
  // Prije 31. 12. dijagnoza ne može biti dostupna — bez čitanja cijele godine iz baze.
  if (bounds === null || today < bounds.end) return null;
  const previousEnd = addDays(bounds.start, -1);
  const previousBounds = previousEnd === null ? null : yearBounds(previousEnd.slice(0, 4));
  if (previousBounds === null) return null;

  // Dotadašnji rekord: prosjeci ranijih godina (čita se prije transakcije, kao kod tjedna).
  const earlier = earlierYearAverages(listDayScores(db, userId, bounds.end).days, year);
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
    if (!isYearDiagnosisReady(year, today, complete.keys())) return null;

    const settingsRow = tx.select().from(settings).where(eq(settings.userId, userId)).get();
    const currentAreas = settingsRow ? selectedScoreAreas(settingsSchema.parse(settingsRow)) : (['plan'] as const);
    const closedDays = (start: LocalDate, end: LocalDate): PeriodDay[] =>
      [...complete.entries()]
        .filter(([date]) => date >= start && date <= end)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, evening]) => {
          const full = readDayStats(tx, userId, date, eveningRows);
          const areas = evening.scoreAreas ?? currentAreas;
          return { stats: statsForAreas(full, areas), score: dayScore(full, areas).score };
        });
    const days = closedDays(bounds.start, bounds.end);
    const current = periodStats(bounds.start, bounds.end, bounds.length, days);
    const previousDays = closedDays(previousBounds.start, previousBounds.end);
    const previous =
      previousDays.length > 0
        ? periodStats(previousBounds.start, previousBounds.end, previousBounds.length, previousDays)
        : null;

    const weekAnswers = tx
      .select()
      .from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, 'week')))
      .all()
      .map((row) => {
        const week = parseWeekDiagnosis(row.sections);
        return {
          start: row.periodStart,
          suggestion: row.suggestion,
          accepted: row.suggestionAccepted,
          idea: week ? JSON.stringify(week.ideas[0] ?? null) : null,
          carried: week?.carried === true,
        };
      });
    const changes = yearChanges(year, weekAnswers);

    const diagnosis = buildYearDiagnosis(current, previous, days, { previousBest, changes });
    const stats = { current, previous };
    const existing = tx.select().from(reports).where(reportOf(userId, 'year', bounds.start)).get();
    // Riječi modela (korak 31e) ostaju dok su statistika godine i smjer isti.
    const existingLlm = existing ? yearLlmOf(existing.sections) : undefined;
    if (existingLlm && sameJson(existing?.stats, stats) && sameIdeas(existing?.sections, diagnosis)) {
      diagnosis.llm = existingLlm;
    }
    if (existing && sameJson(existing.sections, diagnosis) && sameJson(existing.stats, stats)) {
      return { report: reportSchema.parse(existing), diagnosis };
    }
    const report = reportSchema.parse({
      id: existing?.id ?? deps.newId(),
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      period: 'year',
      periodStart: bounds.start,
      sections: diagnosis,
      stats,
      promptVersion: LOCAL_YEAR_DIAGNOSIS_VERSION,
      suggestion: null,
      suggestionAccepted: null,
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

export type ReportFeedback = {
  /** Pomoglo (`true`) / Nije pomoglo (`false`); `null` = bez odgovora. */
  helpful: boolean | null;
  /** Slobodan komentar; prazan tekst se sprema kao `null`. */
  comment: string | null;
};

/**
 * Povratna informacija ispod dijagnoze (korak 31: „Pomoglo / Nije pomoglo“ + komentar). Vraća
 * `false` kad dijagnoze nema. Ista vrijednost ne piše (nema praznog synca); promjena pomakne
 * `updatedAt`, da je sync prenese. Ponovno generiranje dijagnoze odgovor čuva.
 */
export function setReportFeedback(
  db: RitamDb,
  userId: string,
  period: ReportPeriod,
  periodStart: LocalDate,
  feedback: ReportFeedback,
  deps: RepoDeps = defaultRepoDeps,
): boolean {
  const parsed = noteSchema.nullable().parse(feedback.comment);
  const comment = parsed === null || parsed === '' ? null : parsed;
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, period, periodStart)).get();
    if (!row) return false;
    if (row.helpful !== feedback.helpful || row.feedbackComment !== comment) {
      tx.update(reports)
        .set({ helpful: feedback.helpful, feedbackComment: comment, updatedAt: deps.now().toISOString() })
        .where(eq(reports.id, row.id))
        .run();
    }
    return true;
  });
}

/** Spremljena statistika dnevne dijagnoze (`reports.stats`), ili `null` za neočekivan oblik. */
function storedDayStats(stats: unknown): { today: DayStats; yesterday: DayStats | null } | null {
  if (typeof stats !== 'object' || stats === null) return null;
  const { today, yesterday } = stats as { today?: unknown; yesterday?: unknown };
  const isStats = (value: unknown): value is DayStats =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DayStats).date === 'string' &&
    typeof (value as DayStats).plan === 'object' &&
    typeof (value as DayStats).rules === 'object' &&
    Array.isArray((value as DayStats).comments) &&
    Array.isArray((value as DayStats).misses);
  if (!isStats(today)) return null;
  return { today, yesterday: isStats(yesterday) ? yesterday : null };
}

/** Koliko dana unatrag ide u povijest za `write-report` (uzorci po danu u tjednu). */
const LLM_HISTORY_DAYS = 28;

export type WriteReportData = {
  diagnosis: DayDiagnosis;
  today: DayStats;
  yesterday: DayStats | null;
  history: DayStats[];
  previous: LlmPreviousReport[];
  areas: ScorePart[];
  /** Snimka statistike iz koje je zahtjev nastao — odgovor se sprema samo ako je ista. */
  basis: string;
};

/**
 * Sve što `write-report` treba za dan `date` (korak 31), iz već spremljenih dijagnoza: danas i
 * jučer iz statistike dijagnoze dana, raniji dani iz statistike njihovih dijagnoza (do 28 dana),
 * zadnje dijagnoze s odgovorom Pomoglo / Nije pomoglo. `null` kad dijagnoze dana nema.
 */
export async function loadWriteReportData(db: RitamDb, userId: string, date: LocalDate): Promise<WriteReportData | null> {
  const row = await db.select().from(reports).where(reportOf(userId, 'day', date)).get();
  if (!row) return null;
  const diagnosis = parseDayDiagnosis(row.sections);
  const stats = storedDayStats(row.stats);
  if (diagnosis === null || stats === null) return null;
  const from = addDays(date, -LLM_HISTORY_DAYS) ?? date;
  const earlier = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.userId, userId),
        eq(reports.period, 'day'),
        gte(reports.periodStart, from),
        lt(reports.periodStart, date),
      ),
    )
    .orderBy(desc(reports.periodStart))
    .all();
  const history: DayStats[] = [];
  const previous: LlmPreviousReport[] = [];
  for (const report of earlier) {
    const earlierStats = storedDayStats(report.stats);
    if (earlierStats) history.push(earlierStats.today);
    const earlierDiagnosis = parseDayDiagnosis(report.sections);
    if (earlierDiagnosis) {
      previous.push({
        date: report.periodStart,
        diagnosis: earlierDiagnosis,
        helpful: report.helpful,
        comment: report.feedbackComment,
        suggestionAccepted: report.suggestionAccepted,
      });
    }
  }
  const settingsRow = await db.select().from(settings).where(eq(settings.userId, userId)).get();
  const evening = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.userId, userId), eq(checkins.kind, 'evening'), eq(checkins.date, date)))
    .get();
  const eveningAreas = evening ? checkinSchema.parse(evening).scoreAreas : null;
  const areas: ScorePart[] = eveningAreas
    ? [...eveningAreas]
    : settingsRow
      ? [...selectedScoreAreas(settingsSchema.parse(settingsRow))]
      : ['plan'];
  return {
    diagnosis,
    today: stats.today,
    yesterday: stats.yesterday,
    history,
    previous,
    areas,
    basis: JSON.stringify(row.stats),
  };
}

/**
 * Spremi riječi modela uz dijagnozu dana (`sections.llm`). Ne sprema ako se dijagnoza u
 * međuvremenu promijenila (`basis` ≠ trenutna statistika — npr. uređen večernji upit) ili je
 * nema. Vraća dijagnozu s tekstom ili `null`.
 */
export function saveDayReportText(
  db: RitamDb,
  userId: string,
  date: LocalDate,
  text: LlmDayText,
  basis: string,
  deps: RepoDeps = defaultRepoDeps,
): DayDiagnosis | null {
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, 'day', date)).get();
    if (!row || JSON.stringify(row.stats) !== basis) return null;
    const diagnosis = parseDayDiagnosis(row.sections);
    if (diagnosis === null) return null;
    const next: DayDiagnosis = { ...diagnosis, llm: llmDayTextSchema.parse(text) };
    if (!sameJson(diagnosis.llm, next.llm)) {
      tx.update(reports)
        .set({ sections: next, updatedAt: deps.now().toISOString() })
        .where(eq(reports.id, row.id))
        .run();
    }
    return next;
  });
}

/** Spremljena statistika tjedne dijagnoze (`reports.stats`), ili `null` za neočekivan oblik. */
function storedWeekStats(stats: unknown): { current: PeriodStats; previous: PeriodStats | null } | null {
  if (typeof stats !== 'object' || stats === null) return null;
  const { current, previous } = stats as { current?: unknown; previous?: unknown };
  const isStats = (value: unknown): value is PeriodStats =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PeriodStats).start === 'string' &&
    typeof (value as PeriodStats).end === 'string' &&
    typeof (value as PeriodStats).plan === 'object' &&
    typeof (value as PeriodStats).rules === 'object' &&
    typeof (value as PeriodStats).misses === 'object' &&
    Array.isArray((value as PeriodStats).rules.byRule) &&
    Array.isArray((value as PeriodStats).repeatedMisses);
  if (!isStats(current)) return null;
  return { current, previous: isStats(previous) ? previous : null };
}

/** Koliko ranijih tjednih dijagnoza ide modelu (prati je li savjet upalio). */
const LLM_PREVIOUS_WEEKS = 4;

export type WriteWeekReportData = {
  diagnosis: WeekDiagnosis;
  current: PeriodStats;
  previous: PeriodStats | null;
  days: LlmWeekDay[];
  previousReports: LlmPreviousWeekReport[];
  /** Snimka statistike i promjene tjedna iz koje je zahtjev nastao — odgovor se sprema samo ako je ista. */
  basis: string;
};

const weekBasis = (stats: unknown, diagnosis: WeekDiagnosis) =>
  JSON.stringify({ stats, suggestion: diagnosis.suggestion, ideas: diagnosis.ideas });

/**
 * Sve što `write-report` treba za tjedan koji počinje ponedjeljkom `start` (korak 31c), iz već
 * spremljenih dijagnoza: statistika tjedna i prošlog iz tjedne dijagnoze, dani tjedna iz dnevnih
 * dijagnoza (rezultat koji je korisnik vidio), do 4 ranije tjedne dijagnoze s odgovorom.
 * `null` kad tjedne dijagnoze nema.
 */
export async function loadWeekWriteReportData(
  db: RitamDb,
  userId: string,
  start: LocalDate,
): Promise<WriteWeekReportData | null> {
  const row = await db.select().from(reports).where(reportOf(userId, 'week', start)).get();
  if (!row) return null;
  const diagnosis = parseWeekDiagnosis(row.sections);
  const stats = storedWeekStats(row.stats);
  const end = addDays(start, 6);
  if (diagnosis === null || stats === null || end === null) return null;
  const days = await storedPeriodDays(db, userId, start, end);
  const earlier = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, 'week'), lt(reports.periodStart, start)))
    .orderBy(desc(reports.periodStart))
    .limit(LLM_PREVIOUS_WEEKS)
    .all();
  const previousReports: LlmPreviousWeekReport[] = [];
  for (const report of earlier) {
    const earlierDiagnosis = parseWeekDiagnosis(report.sections);
    if (!earlierDiagnosis) continue;
    previousReports.push({
      start: report.periodStart,
      diagnosis: earlierDiagnosis,
      helpful: report.helpful,
      comment: report.feedbackComment,
      suggestionAccepted: report.suggestionAccepted,
    });
  }
  return {
    diagnosis,
    current: stats.current,
    previous: stats.previous,
    days,
    previousReports,
    basis: weekBasis(row.stats, diagnosis),
  };
}

/**
 * Spremi riječi modela uz tjednu dijagnozu (`sections.llm`). Ne sprema ako su se statistika ili
 * promjena tjedna u međuvremenu promijenile (`basis`) ili dijagnoze nema. Vraća dijagnozu s
 * tekstom ili `null`.
 */
export function saveWeekReportText(
  db: RitamDb,
  userId: string,
  start: LocalDate,
  text: LlmWeekText,
  basis: string,
  deps: RepoDeps = defaultRepoDeps,
): WeekDiagnosis | null {
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, 'week', start)).get();
    if (!row) return null;
    const diagnosis = parseWeekDiagnosis(row.sections);
    if (diagnosis === null || weekBasis(row.stats, diagnosis) !== basis) return null;
    const next: WeekDiagnosis = { ...diagnosis, llm: llmWeekTextSchema.parse(text) };
    if (!sameJson(diagnosis.llm, next.llm)) {
      tx.update(reports)
        .set({ sections: next, updatedAt: deps.now().toISOString() })
        .where(eq(reports.id, row.id))
        .run();
    }
    return next;
  });
}

export type WriteMonthReportData = {
  diagnosis: MonthDiagnosis;
  current: PeriodStats;
  previous: PeriodStats | null;
  days: LlmWeekDay[];
  previousReports: LlmPreviousMonthReport[];
  basis: string;
};

/** Koliko ranijih mjesečnih dijagnoza ide modelu. */
const LLM_PREVIOUS_MONTHS = 3;

const monthBasis = (stats: unknown, diagnosis: MonthDiagnosis) => JSON.stringify({ stats, ideas: diagnosis.ideas });

/** Dani razdoblja `from`–`to` iz spremljenih dnevnih dijagnoza: statistika i rezultat koji je korisnik vidio. */
async function storedPeriodDays(db: RitamDb, userId: string, from: LocalDate, to: LocalDate): Promise<LlmWeekDay[]> {
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, 'day'), gte(reports.periodStart, from), lte(reports.periodStart, to)))
    .all();
  const days: LlmWeekDay[] = [];
  for (const row of rows) {
    const stored = storedDayStats(row.stats);
    if (!stored) continue;
    const scoreRow = parseDayDiagnosis(row.sections)?.progress.find((progress) => progress.metric === 'score');
    days.push({ stats: stored.today, score: scoreRow ? scoreRow.value : null });
  }
  return days;
}

/**
 * Sve što `write-report` treba za mjesec koji počinje danom `start` (korak 31d), iz spremljenih
 * dijagnoza. `null` kad mjesečne dijagnoze nema.
 */
export async function loadMonthWriteReportData(
  db: RitamDb,
  userId: string,
  start: LocalDate,
): Promise<WriteMonthReportData | null> {
  const row = await db.select().from(reports).where(reportOf(userId, 'month', start)).get();
  if (!row) return null;
  const diagnosis = parseMonthDiagnosis(row.sections);
  const stats = storedWeekStats(row.stats);
  if (diagnosis === null || stats === null) return null;
  const days = await storedPeriodDays(db, userId, diagnosis.start, diagnosis.end);
  const earlier = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, 'month'), lt(reports.periodStart, start)))
    .orderBy(desc(reports.periodStart))
    .limit(LLM_PREVIOUS_MONTHS)
    .all();
  const previousReports: LlmPreviousMonthReport[] = [];
  for (const report of earlier) {
    const earlierDiagnosis = parseMonthDiagnosis(report.sections);
    if (!earlierDiagnosis) continue;
    previousReports.push({
      start: report.periodStart,
      diagnosis: earlierDiagnosis,
      helpful: report.helpful,
      comment: report.feedbackComment,
    });
  }
  return {
    diagnosis,
    current: stats.current,
    previous: stats.previous,
    days,
    previousReports,
    basis: monthBasis(row.stats, diagnosis),
  };
}

/** Spremi riječi modela uz mjesečnu dijagnozu; ne sprema ako su se statistika ili smjer promijenili. */
export function saveMonthReportText(
  db: RitamDb,
  userId: string,
  start: LocalDate,
  text: LlmMonthText,
  basis: string,
  deps: RepoDeps = defaultRepoDeps,
): MonthDiagnosis | null {
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, 'month', start)).get();
    if (!row) return null;
    const diagnosis = parseMonthDiagnosis(row.sections);
    if (diagnosis === null || monthBasis(row.stats, diagnosis) !== basis) return null;
    const next: MonthDiagnosis = { ...diagnosis, llm: llmMonthTextSchema.parse(text) };
    if (!sameJson(diagnosis.llm, next.llm)) {
      tx.update(reports)
        .set({ sections: next, updatedAt: deps.now().toISOString() })
        .where(eq(reports.id, row.id))
        .run();
    }
    return next;
  });
}

export type WriteYearReportData = {
  diagnosis: YearDiagnosis;
  current: PeriodStats;
  previous: PeriodStats | null;
  /** Mjesečne dijagnoze te godine (za sažetke mjeseci), po redu. */
  months: { month: string; diagnosis: MonthDiagnosis }[];
  previousReports: LlmPreviousYearReport[];
  basis: string;
};

/** Koliko ranijih godišnjih dijagnoza ide modelu. */
const LLM_PREVIOUS_YEARS = 2;

const yearBasis = (stats: unknown, diagnosis: YearDiagnosis) => JSON.stringify({ stats, ideas: diagnosis.ideas });

/**
 * Sve što `write-report` treba za godinu koja počinje danom `start` (korak 31e), iz spremljenih
 * dijagnoza: statistika godine, mjesečne dijagnoze te godine i ranije godišnje. Bez pojedinačnih
 * dana. `null` kad godišnje dijagnoze nema.
 */
export async function loadYearWriteReportData(
  db: RitamDb,
  userId: string,
  start: LocalDate,
): Promise<WriteYearReportData | null> {
  const row = await db.select().from(reports).where(reportOf(userId, 'year', start)).get();
  if (!row) return null;
  const diagnosis = parseYearDiagnosis(row.sections);
  const stats = storedWeekStats(row.stats);
  if (diagnosis === null || stats === null) return null;
  const monthRows = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.userId, userId),
        eq(reports.period, 'month'),
        gte(reports.periodStart, diagnosis.start),
        lte(reports.periodStart, diagnosis.end),
      ),
    )
    .orderBy(reports.periodStart)
    .all();
  const months: WriteYearReportData['months'] = [];
  for (const monthRow of monthRows) {
    const monthDiagnosis = parseMonthDiagnosis(monthRow.sections);
    if (monthDiagnosis) months.push({ month: monthRow.periodStart.slice(0, 7), diagnosis: monthDiagnosis });
  }
  const earlier = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.period, 'year'), lt(reports.periodStart, start)))
    .orderBy(desc(reports.periodStart))
    .limit(LLM_PREVIOUS_YEARS)
    .all();
  const previousReports: LlmPreviousYearReport[] = [];
  for (const report of earlier) {
    const earlierDiagnosis = parseYearDiagnosis(report.sections);
    if (!earlierDiagnosis) continue;
    previousReports.push({
      start: report.periodStart,
      diagnosis: earlierDiagnosis,
      helpful: report.helpful,
      comment: report.feedbackComment,
    });
  }
  return {
    diagnosis,
    current: stats.current,
    previous: stats.previous,
    months,
    previousReports,
    basis: yearBasis(row.stats, diagnosis),
  };
}

/** Spremi riječi modela uz godišnju dijagnozu; ne sprema ako su se statistika ili smjer promijenili. */
export function saveYearReportText(
  db: RitamDb,
  userId: string,
  start: LocalDate,
  text: LlmYearText,
  basis: string,
  deps: RepoDeps = defaultRepoDeps,
): YearDiagnosis | null {
  return db.transaction((tx) => {
    const row = tx.select().from(reports).where(reportOf(userId, 'year', start)).get();
    if (!row) return null;
    const diagnosis = parseYearDiagnosis(row.sections);
    if (diagnosis === null || yearBasis(row.stats, diagnosis) !== basis) return null;
    const next: YearDiagnosis = { ...diagnosis, llm: llmYearTextSchema.parse(text) };
    if (!sameJson(diagnosis.llm, next.llm)) {
      tx.update(reports)
        .set({ sections: next, updatedAt: deps.now().toISOString() })
        .where(eq(reports.id, row.id))
        .run();
    }
    return next;
  });
}
