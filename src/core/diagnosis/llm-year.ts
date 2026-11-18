/**
 * Godišnja dijagnoza riječima (korak 31e): oblik teksta modela uz lokalnu godišnju dijagnozu i
 * zahtjev za `write-report` (`period: 'year'`). Brojke, trend, traka mjeseci i smjer ostaju
 * lokalni. Model ne dobiva pojedinačne dane — samo godinu, mjesece (prosjek i sažetak mjesečne
 * dijagnoze) i ranije godišnje dijagnoze. Čista logika, bez React importa.
 */
import { z } from 'zod';

import { addDays } from '../time/local-date';

import type {
  ReportPrevious,
  ReportYearMonth,
  WriteYearReportRequest,
} from '../../../supabase/functions/_shared/report-logic';
import { reportPeriodStats } from './llm-week';
import type { PeriodStats } from './period-stats';
import type { YearDiagnosis, YearLine } from './year-diagnosis';

/** Verzija prompta (isto kao `YEAR_REPORT_PROMPT_VERSION` na serveru). */
export const LLM_YEAR_DIAGNOSIS_VERSION = 'llm-year-v1' as const;

const lineSchema = z.string().trim().min(1).max(280);

export const llmYearTextSchema = z.object({
  version: z.literal(LLM_YEAR_DIAGNOSIS_VERSION),
  summary: z.string().trim().min(1).max(240),
  praise: z.array(lineSchema).max(3),
  noticed: z.array(lineSchema).max(3),
  problems: z.array(lineSchema).max(2),
  /** Zašto je smjer za iduću godinu dobar; `null` bez rečenice. */
  ideasWhy: lineSchema.nullable(),
});
export type LlmYearText = z.infer<typeof llmYearTextSchema>;

/** Odgovor funkcije `{ report }` → tekst godišnje dijagnoze, ili `null`. */
export function readWriteYearReportResponse(data: unknown): LlmYearText | null {
  if (typeof data !== 'object' || data === null || !('report' in data)) return null;
  const result = llmYearTextSchema.safeParse((data as { report: unknown }).report);
  return result.success ? result.data : null;
}

/**
 * Piše li se godišnja dijagnoza (zadnji dan `end`) modelom: samo 31. 12. (uz dnevnu) i 1. 1.
 * Starije godine ostaju lokalne.
 */
export function isYearFreshForWriting(end: string, today: string): boolean {
  const after = addDays(end, 1);
  return after !== null && today >= end && today <= after;
}

export type LlmPreviousYearReport = {
  /** 1. 1. te godine. */
  start: string;
  diagnosis: YearDiagnosis;
  helpful: boolean | null;
  comment: string | null;
};

/** Sažetak mjesečne dijagnoze te godine (riječi modela ako postoje, inače lokalni redak). */
export type LlmYearMonthSummary = { month: string; summary: string };

export type WriteYearReportInput = {
  locale: 'hr' | 'en';
  diagnosis: YearDiagnosis;
  current: PeriodStats;
  previous: PeriodStats | null;
  monthSummaries: readonly LlmYearMonthSummary[];
  previousReports: readonly LlmPreviousYearReport[];
  /** Lokalni redak godišnje dijagnoze kao tekst na jeziku appa (i18n). */
  renderLine: (line: YearLine) => string;
};

const PREVIOUS_YEARS = 2;

/**
 * Zahtjev za `write-report` (godina): statistika godine i prošle, dvanaest mjeseci (prosjek iz
 * lokalne dijagnoze i sažetak mjesečne dijagnoze kad postoji), lokalni smjer, odgovori na tjedne
 * promjene i do 2 ranije godišnje dijagnoze s odgovorom.
 */
export function writeYearReportRequest(input: WriteYearReportInput): WriteYearReportRequest {
  const { diagnosis, renderLine } = input;
  const summaries = new Map(input.monthSummaries.map((item) => [item.month, item.summary]));
  const months: ReportYearMonth[] = diagnosis.months.map((average, index) => {
    const month = `${diagnosis.year}-${String(index + 1).padStart(2, '0')}`;
    return {
      month,
      average: average === null ? null : Math.min(100, Math.max(0, Math.round(average))),
      summary: summaries.get(month) ?? null,
    };
  });
  const previous: ReportPrevious[] = input.previousReports
    .filter((report) => report.start < diagnosis.start)
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, PREVIOUS_YEARS)
    .map((report) => ({
      date: report.start,
      summary: report.diagnosis.llm ? report.diagnosis.llm.summary : renderLine(report.diagnosis.summary),
      ideas: report.diagnosis.ideas.map(renderLine),
      helpful: report.helpful,
      comment: report.comment,
      suggestionAccepted: null,
    }));
  return {
    period: 'year',
    start: diagnosis.start,
    locale: input.locale,
    trend: diagnosis.trend,
    year: reportPeriodStats(input.current),
    previousYear: input.previous && input.previous.recorded > 0 ? reportPeriodStats(input.previous) : null,
    months,
    ideas: diagnosis.ideas.map(renderLine),
    changes: diagnosis.changes,
    previous,
  };
}
