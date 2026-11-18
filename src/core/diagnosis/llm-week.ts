/**
 * Tjedna dijagnoza riječima (korak 31c): oblik teksta modela uz lokalnu tjednu dijagnozu i
 * zahtjev za `write-report` (`period: 'week'`) iz lokalne statistike. Brojke, trend i promjena
 * tjedna ostaju lokalni. Čista logika, bez React importa.
 */
import { z } from 'zod';

import { addDays } from '../time/local-date';

import type {
  ReportHistoryDay,
  ReportPrevious,
  ReportWeek,
  WriteWeekReportRequest,
} from '../../../supabase/functions/_shared/report-logic';
import type { DayStats } from './day-stats';
import type { PeriodStats } from './period-stats';
import type { WeekDiagnosis, WeekLine } from './week-diagnosis';

/** Verzija prompta (isto kao `WEEK_REPORT_PROMPT_VERSION` na serveru). */
export const LLM_WEEK_DIAGNOSIS_VERSION = 'llm-week-v1' as const;

const lineSchema = z.string().trim().min(1).max(280);

export const llmWeekTextSchema = z.object({
  version: z.literal(LLM_WEEK_DIAGNOSIS_VERSION),
  summary: z.string().trim().min(1).max(240),
  praise: z.array(lineSchema).max(3),
  noticed: z.array(lineSchema).max(3),
  problems: z.array(lineSchema).max(2),
  /** Zašto baš promjena tjedna (ili zadržati ritam); `null` bez rečenice. */
  ideaWhy: lineSchema.nullable(),
});
export type LlmWeekText = z.infer<typeof llmWeekTextSchema>;

/** Odgovor funkcije `{ report }` → tekst tjedne dijagnoze, ili `null`. */
export function readWriteWeekReportResponse(data: unknown): LlmWeekText | null {
  if (typeof data !== 'object' || data === null || !('report' in data)) return null;
  const result = llmWeekTextSchema.safeParse((data as { report: unknown }).report);
  return result.success ? result.data : null;
}

/**
 * Piše li se tjedna dijagnoza modelom: samo za svjež tjedan — na njegovu nedjelju (uz dnevnu) i
 * u ponedjeljak poslije (jutarnja obavijest). Stariji tjedni ostaju lokalni (arhiva i listanje
 * ne troše pozive).
 */
export function isWeekFreshForWriting(start: string, today: string): boolean {
  const end = addDays(start, 6);
  const after = addDays(start, 7);
  return end !== null && after !== null && today >= end && today <= after;
}

export type LlmPreviousWeekReport = {
  /** Ponedjeljak tog tjedna. */
  start: string;
  diagnosis: WeekDiagnosis;
  helpful: boolean | null;
  comment: string | null;
  suggestionAccepted: boolean | null;
};

/** Zaključen dan tjedna iz spremljene dnevne dijagnoze: statistika i rezultat koji je korisnik vidio. */
export type LlmWeekDay = { stats: DayStats; score: number | null };

export type WriteWeekReportInput = {
  locale: 'hr' | 'en';
  diagnosis: WeekDiagnosis;
  current: PeriodStats;
  previous: PeriodStats | null;
  days: readonly LlmWeekDay[];
  previousReports: readonly LlmPreviousWeekReport[];
  /** Lokalni redak tjedne dijagnoze kao tekst na jeziku appa (i18n). */
  renderLine: (line: WeekLine) => string;
};

const PREVIOUS_WEEKS = 4;
const int = (value: number) => Math.max(0, Math.round(value));

function reportWeek(stats: PeriodStats): ReportWeek {
  return {
    start: stats.start,
    end: stats.end,
    recorded: stats.recorded,
    average: stats.average,
    best: stats.best,
    worst: stats.worst,
    plan: {
      total: stats.plan.total,
      done: stats.plan.done,
      partial: stats.plan.partial,
      missed: stats.plan.missed,
      moved: stats.plan.moved,
    },
    rules: {
      active: stats.rules.active,
      kept: stats.rules.kept,
      broken: stats.rules.broken,
      byRule: stats.rules.byRule.slice(0, 6).map((rule) => ({
        title: rule.title,
        weight: rule.weight,
        broken: rule.broken,
        triggers: rule.triggers.slice(0, 3),
      })),
    },
    sleep: stats.sleep
      ? {
          nights: stats.sleep.nights,
          averageMinutes: int(stats.sleep.averageMinutes),
          shortNights: stats.sleep.shortNights,
          onTarget: stats.sleep.onTarget,
          withTarget: stats.sleep.withTarget,
        }
      : null,
    xp: int(stats.xp),
    rating: stats.rating?.average ?? null,
    gaveUpDays: stats.gaveUpDays,
    misses: { ...stats.misses },
    repeatedMisses: stats.repeatedMisses.slice(0, 5),
    calories: stats.calories ?? null,
    money: stats.money ?? null,
  };
}

const ratingOf = (rating: number | null): number | null =>
  rating === null ? null : Math.min(5, Math.max(1, Math.round(rating)));

/**
 * Zahtjev za `write-report` (tjedan): statistika tjedna i prošlog, dani tjedna ukratko (iz
 * dnevnih dijagnoza), lokalno odabrana promjena tjedna i do 4 ranije tjedne dijagnoze s
 * odgovorom. Raniji tekst je onaj koji je korisnik vidio (modelov ako postoji).
 */
export function writeWeekReportRequest(input: WriteWeekReportInput): WriteWeekReportRequest {
  const { diagnosis, renderLine } = input;
  const start = diagnosis.start;
  const days: ReportHistoryDay[] = input.days
    .filter(({ stats }) => stats.date >= diagnosis.start && stats.date <= diagnosis.end)
    .sort((a, b) => a.stats.date.localeCompare(b.stats.date))
    .map(({ stats, score }) => ({
      date: stats.date,
      score: score === null ? null : Math.min(100, int(score)),
      rating: ratingOf(stats.rating),
      comments: stats.comments.slice(0, 3),
      broken: stats.rules.brokenRules.slice(0, 3),
    }));
  const previous: ReportPrevious[] = input.previousReports
    .filter((report) => report.start < start)
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, PREVIOUS_WEEKS)
    .map((report) => ({
      date: report.start,
      summary: report.diagnosis.llm ? report.diagnosis.llm.summary : renderLine(report.diagnosis.summary),
      ideas: report.diagnosis.ideas.map(renderLine),
      helpful: report.helpful,
      comment: report.comment,
      suggestionAccepted: report.suggestionAccepted,
    }));
  const idea = diagnosis.ideas[0];
  return {
    period: 'week',
    start,
    locale: input.locale,
    trend: diagnosis.trend,
    betterWeeks: diagnosis.betterWeeks,
    week: reportWeek(input.current),
    previousWeek: input.previous && input.previous.recorded > 0 ? reportWeek(input.previous) : null,
    days,
    idea: diagnosis.suggestion === null || idea === undefined ? null : { text: renderLine(idea), carried: diagnosis.carried },
    previous,
  };
}
