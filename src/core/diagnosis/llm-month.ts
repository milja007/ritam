/**
 * Mjesečna dijagnoza riječima (korak 31d): oblik teksta modela uz lokalnu mjesečnu dijagnozu i
 * zahtjev za `write-report` (`period: 'month'`). Brojke, trend i smjer (ideje) ostaju lokalni.
 * Čista logika, bez React importa.
 */
import { z } from 'zod';

import { addDays } from '../time/local-date';

import type {
  ReportHistoryDay,
  ReportPrevious,
  WriteMonthReportRequest,
} from '../../../supabase/functions/_shared/report-logic';
import { reportPeriodStats, type LlmWeekDay } from './llm-week';
import type { MonthDiagnosis, MonthLine } from './month-diagnosis';
import type { PeriodStats } from './period-stats';

/** Verzija prompta (isto kao `MONTH_REPORT_PROMPT_VERSION` na serveru). */
export const LLM_MONTH_DIAGNOSIS_VERSION = 'llm-month-v1' as const;

const lineSchema = z.string().trim().min(1).max(280);

export const llmMonthTextSchema = z.object({
  version: z.literal(LLM_MONTH_DIAGNOSIS_VERSION),
  summary: z.string().trim().min(1).max(240),
  praise: z.array(lineSchema).max(3),
  noticed: z.array(lineSchema).max(3),
  problems: z.array(lineSchema).max(2),
  /** Zašto je smjer za idući mjesec dobar; `null` bez rečenice. */
  ideasWhy: lineSchema.nullable(),
});
export type LlmMonthText = z.infer<typeof llmMonthTextSchema>;

/** Odgovor funkcije `{ report }` → tekst mjesečne dijagnoze, ili `null`. */
export function readWriteMonthReportResponse(data: unknown): LlmMonthText | null {
  if (typeof data !== 'object' || data === null || !('report' in data)) return null;
  const result = llmMonthTextSchema.safeParse((data as { report: unknown }).report);
  return result.success ? result.data : null;
}

/**
 * Piše li se mjesečna dijagnoza (prvi dan `start`, zadnji `end`) modelom: samo na zadnji dan
 * mjeseca (uz dnevnu) i dan poslije. Stariji mjeseci ostaju lokalni.
 */
export function isMonthFreshForWriting(end: string, today: string): boolean {
  const after = addDays(end, 1);
  return after !== null && today >= end && today <= after;
}

export type LlmPreviousMonthReport = {
  /** Prvi dan tog mjeseca. */
  start: string;
  diagnosis: MonthDiagnosis;
  helpful: boolean | null;
  comment: string | null;
};

export type WriteMonthReportInput = {
  locale: 'hr' | 'en';
  diagnosis: MonthDiagnosis;
  current: PeriodStats;
  previous: PeriodStats | null;
  days: readonly LlmWeekDay[];
  previousReports: readonly LlmPreviousMonthReport[];
  /** Lokalni redak mjesečne dijagnoze kao tekst na jeziku appa (i18n). */
  renderLine: (line: MonthLine) => string;
};

const PREVIOUS_MONTHS = 3;
const DAY_COMMENTS = 2;

const ratingOf = (rating: number | null): number | null =>
  rating === null ? null : Math.min(5, Math.max(1, Math.round(rating)));

/**
 * Zahtjev za `write-report` (mjesec): statistika mjeseca i prošlog, zaključeni dani ukratko (do 2
 * komentara i prekršaja po danu), lokalni smjer, odgovori na tjedne promjene i do 3 ranije
 * mjesečne dijagnoze s odgovorom.
 */
export function writeMonthReportRequest(input: WriteMonthReportInput): WriteMonthReportRequest {
  const { diagnosis, renderLine } = input;
  const days: ReportHistoryDay[] = input.days
    .filter(({ stats }) => stats.date >= diagnosis.start && stats.date <= diagnosis.end)
    .sort((a, b) => a.stats.date.localeCompare(b.stats.date))
    .map(({ stats, score }) => ({
      date: stats.date,
      score: score === null ? null : Math.min(100, Math.max(0, Math.round(score))),
      rating: ratingOf(stats.rating),
      comments: stats.comments.slice(0, DAY_COMMENTS),
      broken: stats.rules.brokenRules.slice(0, DAY_COMMENTS),
    }));
  const previous: ReportPrevious[] = input.previousReports
    .filter((report) => report.start < diagnosis.start)
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, PREVIOUS_MONTHS)
    .map((report) => ({
      date: report.start,
      summary: report.diagnosis.llm ? report.diagnosis.llm.summary : renderLine(report.diagnosis.summary),
      ideas: report.diagnosis.ideas.map(renderLine),
      helpful: report.helpful,
      comment: report.comment,
      suggestionAccepted: null,
    }));
  return {
    period: 'month',
    start: diagnosis.start,
    locale: input.locale,
    trend: diagnosis.trend,
    month: reportPeriodStats(input.current),
    previousMonth: input.previous && input.previous.recorded > 0 ? reportPeriodStats(input.previous) : null,
    days,
    ideas: diagnosis.ideas.map(renderLine),
    changes: diagnosis.changes,
    previous,
  };
}
