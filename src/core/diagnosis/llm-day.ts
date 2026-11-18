import { z } from 'zod';

import { dayScore, type ScorePart } from '../progress';
import { addDays } from '../time/local-date';

import type {
  ReportDay,
  ReportHistoryDay,
  ReportPrevious,
  WriteReportRequest,
} from '../../../supabase/functions/_shared/report-logic';
import type { DayStats } from './day-stats';
import type { DayDiagnosis, DiagnosisLine } from './day-diagnosis';

/** Verzija prompta `write-report` (isto kao `DAY_REPORT_PROMPT_VERSION` na serveru). */
export const LLM_DAY_DIAGNOSIS_VERSION = 'llm-day-v1' as const;

/** Granice teksta modela — iste kao `REPORT_LIMITS` u `_shared/report-logic.ts`. */
const LINE_MAX = 280;
const SUMMARY_MAX = 240;
const HISTORY_DAYS = 14;
const PREVIOUS_REPORTS = 5;

const lineSchema = z.string().trim().min(1).max(LINE_MAX);

/**
 * Tekst dnevne dijagnoze koji je napisao model (korak 31). Sprema se uz lokalnu dijagnozu
 * (`sections.llm`): brojke i trend ostaju lokalni, riječi dolaze od modela.
 */
export const llmDayTextSchema = z.object({
  version: z.literal(LLM_DAY_DIAGNOSIS_VERSION),
  summary: z.string().trim().min(1).max(SUMMARY_MAX),
  praise: z.array(lineSchema).max(3),
  noticed: z.array(lineSchema).max(3),
  problems: z.array(lineSchema).max(2),
  ideas: z.array(lineSchema).min(1).max(2),
});
export type LlmDayText = z.infer<typeof llmDayTextSchema>;

/** Odgovor funkcije `{ report }` → tekst, ili `null` (greška, krivi oblik, model nije uspio). */
export function readWriteReportResponse(data: unknown): LlmDayText | null {
  if (typeof data !== 'object' || data === null || !('report' in data)) return null;
  const result = llmDayTextSchema.safeParse((data as { report: unknown }).report);
  return result.success ? result.data : null;
}

/** Koliko dana unatrag se dijagnoza još dopisuje modelom (danas i jučer — upit poslije ponoći). */
const WRITE_WINDOW_DAYS = 1;

/**
 * Piše li se dijagnoza dana `date` modelom: samo svježa (danas ili jučer). Stare dijagnoze iz
 * arhive ostaju lokalne — otvaranje arhive ne smije trošiti pozive modela.
 */
export function isFreshForWriting(date: string, today: string): boolean {
  const from = addDays(today, -WRITE_WINDOW_DAYS);
  return from !== null && date >= from && date <= today;
}

export type LlmPreviousReport = {
  date: string;
  diagnosis: DayDiagnosis;
  helpful: boolean | null;
  comment: string | null;
  suggestionAccepted: boolean | null;
};

export type WriteReportInput = {
  date: string;
  locale: 'hr' | 'en';
  diagnosis: DayDiagnosis;
  today: DayStats;
  yesterday: DayStats | null;
  /** Statistike ranijih dana (spremljene uz njihove dijagnoze), bilo kojim redom. */
  history: readonly DayStats[];
  previous: readonly LlmPreviousReport[];
  areas: readonly ScorePart[];
  /** Lokalni redak dijagnoze kao tekst na jeziku appa (i18n). */
  renderLine: (line: DiagnosisLine) => string;
};

const scoreOf = (stats: DayStats, areas: readonly ScorePart[]): number | null => {
  const { score } = dayScore(stats, areas);
  return score === null ? null : Math.round(score);
};

const ratingOf = (rating: number | null): number | null =>
  rating === null ? null : Math.min(5, Math.max(1, Math.round(rating)));

function reportDay(stats: DayStats, areas: readonly ScorePart[]): ReportDay {
  return {
    date: stats.date,
    score: scoreOf(stats, areas),
    plan: {
      total: stats.plan.total,
      done: stats.plan.done,
      partial: stats.plan.partial,
      missed: stats.plan.missed,
      moved: stats.plan.moved,
    },
    comments: stats.comments,
    misses: stats.misses,
    rules: { active: stats.rules.active, kept: stats.rules.kept, broken: stats.rules.brokenRules },
    sleep: stats.sleep
      ? {
          minutes: Math.round(stats.sleep.minutes),
          onTarget: stats.sleep.onTarget,
          deviationMinutes: stats.sleep.deviationMinutes === null ? null : Math.round(stats.sleep.deviationMinutes),
        }
      : null,
    xp: Math.max(0, Math.round(stats.xp)),
    rating: ratingOf(stats.rating),
    note: stats.note,
    streak: stats.streak,
    gaveUp: stats.gaveUp === true,
    gaveUpNote: stats.gaveUpNote ?? null,
  };
}

/**
 * Zahtjev za `write-report` iz lokalnih podataka: danas i jučer u cijelosti, do 14 ranijih dana
 * ukratko (najnoviji prvo; jučer se ne ponavlja), do 5 ranijih dijagnoza s odgovorom Pomoglo /
 * Nije pomoglo i komentarom. Raniji tekst dijagnoze je onaj koji je korisnik vidio: modelov ako
 * postoji, inače lokalni redak na jeziku appa.
 */
export function writeReportRequest(input: WriteReportInput): WriteReportRequest {
  const { date, areas } = input;
  const history: ReportHistoryDay[] = input.history
    .filter((stats) => stats.date < date && stats.date !== input.yesterday?.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, HISTORY_DAYS)
    .map((stats) => ({
      date: stats.date,
      score: scoreOf(stats, areas),
      rating: ratingOf(stats.rating),
      comments: stats.comments.slice(0, 3),
      broken: stats.rules.brokenRules.slice(0, 3),
    }));
  const previous: ReportPrevious[] = input.previous
    .filter((report) => report.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PREVIOUS_REPORTS)
    .map((report) => {
      const llm = report.diagnosis.llm;
      return {
        date: report.date,
        summary: llm ? llm.summary : input.renderLine(report.diagnosis.summary),
        ideas: llm ? llm.ideas : report.diagnosis.ideas.map(input.renderLine),
        helpful: report.helpful,
        comment: report.comment,
        suggestionAccepted: report.suggestionAccepted,
      };
    });
  return {
    date,
    locale: input.locale,
    trend: input.diagnosis.trend,
    today: reportDay(input.today, areas),
    yesterday: input.yesterday ? reportDay(input.yesterday, areas) : null,
    history,
    previous,
  };
}
