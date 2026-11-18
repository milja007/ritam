import type {
  WriteMonthReportRequest,
  WriteReportRequest,
  WriteWeekReportRequest,
} from '../../../supabase/functions/_shared/report-logic';
import {
  readWriteMonthReportResponse,
  readWriteReportResponse,
  readWriteWeekReportResponse,
  writeMonthReportRequest,
  writeReportRequest,
  writeWeekReportRequest,
  type DayDiagnosis,
  type DiagnosisLine,
  type LlmDayText,
  type LlmMonthText,
  type LlmWeekText,
  type MonthDiagnosis,
  type MonthLine,
  type WeekDiagnosis,
  type WeekLine,
} from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import {
  loadMonthWriteReportData,
  loadWeekWriteReportData,
  loadWriteReportData,
  saveDayReportText,
  saveMonthReportText,
  saveWeekReportText,
} from '@/db/repos';
import { getSupabase } from '@/features/auth/supabase';

/** Dulje od ovoga se ne čeka — lokalna dijagnoza je već na ekranu. */
export const WRITE_REPORT_TIMEOUT_MS = 20_000;

/** Može li se dijagnoza uopće pisati modelom (oblak uključen). Prijava se provjerava pri pozivu. */
export const canWriteReport = (): boolean => getSupabase() !== null;

/** Poziv `write-report` s provjerom odgovora; greška, istek vremena ili krivi oblik → `null`. */
async function invokeWriteReport<T>(body: object, read: (data: unknown) => T | null): Promise<T | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const { data, error } = await supabase.functions.invoke('write-report', {
      body,
      timeout: WRITE_REPORT_TIMEOUT_MS,
    });
    if (error) {
      console.warn('write-report failed, keeping local diagnosis', error.message);
      return null;
    }
    return read(data);
  } catch (error: unknown) {
    console.warn('write-report failed, keeping local diagnosis', error);
    return null;
  }
}

/**
 * Korak 31: činjenice dana → riječi dijagnoze kroz Edge Function `write-report`. Samo s oblakom
 * i prijavom (funkcija traži JWT). Greška, istek vremena ili krivi oblik → `null`.
 */
export function requestWriteReport(body: WriteReportRequest): Promise<LlmDayText | null> {
  return invokeWriteReport(body, readWriteReportResponse);
}

/** Korak 31d: isto za mjesec (`period: 'month'`). */
export function requestWriteMonthReport(body: WriteMonthReportRequest): Promise<LlmMonthText | null> {
  return invokeWriteReport(body, readWriteMonthReportResponse);
}

/** Korak 31c: isto za tjedan (`period: 'week'`). */
export function requestWriteWeekReport(body: WriteWeekReportRequest): Promise<LlmWeekText | null> {
  return invokeWriteReport(body, readWriteWeekReportResponse);
}

/**
 * Dopiši riječi modela uz spremljenu dijagnozu dana `date`. Vraća dijagnozu s tekstom, ili `null`
 * kad nema oblaka, prijave, dijagnoze, kad tekst već postoji ili poziv ne uspije — tada ostaje
 * lokalna dijagnoza. Odgovor za podatke koji su se u međuvremenu promijenili se ne sprema.
 */
export async function refineDayDiagnosis(
  date: string,
  locale: 'hr' | 'en',
  renderLine: (line: DiagnosisLine) => string,
): Promise<DayDiagnosis | null> {
  if (!canWriteReport()) return null;
  try {
    const data = await loadWriteReportData(getDb(), LOCAL_USER_ID, date);
    if (data === null || data.diagnosis.llm !== undefined) return null;
    const text = await requestWriteReport(
      writeReportRequest({
        date,
        locale,
        diagnosis: data.diagnosis,
        today: data.today,
        yesterday: data.yesterday,
        history: data.history,
        previous: data.previous,
        areas: data.areas,
        renderLine,
      }),
    );
    if (text === null) return null;
    return saveDayReportText(getDb(), LOCAL_USER_ID, date, text, data.basis);
  } catch (error: unknown) {
    console.warn('Writing day diagnosis failed, keeping local diagnosis', error);
    return null;
  }
}

/**
 * Dopiši riječi modela uz spremljenu tjednu dijagnozu (tjedan od ponedjeljka `start`). `null` kad
 * nema oblaka, prijave, dijagnoze, kad tekst već postoji ili poziv ne uspije — tada ostaje
 * lokalna. Odgovor za tjedan koji se u međuvremenu promijenio se ne sprema.
 */
export async function refineWeekDiagnosis(
  start: string,
  locale: 'hr' | 'en',
  renderLine: (line: WeekLine) => string,
): Promise<WeekDiagnosis | null> {
  if (!canWriteReport()) return null;
  try {
    const data = await loadWeekWriteReportData(getDb(), LOCAL_USER_ID, start);
    if (data === null || data.diagnosis.llm !== undefined) return null;
    const text = await requestWriteWeekReport(
      writeWeekReportRequest({
        locale,
        diagnosis: data.diagnosis,
        current: data.current,
        previous: data.previous,
        days: data.days,
        previousReports: data.previousReports,
        renderLine,
      }),
    );
    if (text === null) return null;
    return saveWeekReportText(getDb(), LOCAL_USER_ID, start, text, data.basis);
  } catch (error: unknown) {
    console.warn('Writing week diagnosis failed, keeping local diagnosis', error);
    return null;
  }
}

/** Dopiši riječi modela uz spremljenu mjesečnu dijagnozu (prvi dan `start`); kao za tjedan. */
export async function refineMonthDiagnosis(
  start: string,
  locale: 'hr' | 'en',
  renderLine: (line: MonthLine) => string,
): Promise<MonthDiagnosis | null> {
  if (!canWriteReport()) return null;
  try {
    const data = await loadMonthWriteReportData(getDb(), LOCAL_USER_ID, start);
    if (data === null || data.diagnosis.llm !== undefined) return null;
    const text = await requestWriteMonthReport(
      writeMonthReportRequest({
        locale,
        diagnosis: data.diagnosis,
        current: data.current,
        previous: data.previous,
        days: data.days,
        previousReports: data.previousReports,
        renderLine,
      }),
    );
    if (text === null) return null;
    return saveMonthReportText(getDb(), LOCAL_USER_ID, start, text, data.basis);
  } catch (error: unknown) {
    console.warn('Writing month diagnosis failed, keeping local diagnosis', error);
    return null;
  }
}
