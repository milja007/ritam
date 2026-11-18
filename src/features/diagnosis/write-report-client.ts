import type { WriteReportRequest } from '../../../supabase/functions/_shared/report-logic';
import {
  readWriteReportResponse,
  writeReportRequest,
  type DayDiagnosis,
  type DiagnosisLine,
  type LlmDayText,
} from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { loadWriteReportData, saveDayReportText } from '@/db/repos';
import { getSupabase } from '@/features/auth/supabase';

/** Dulje od ovoga se ne čeka — lokalna dijagnoza je već na ekranu. */
export const WRITE_REPORT_TIMEOUT_MS = 20_000;

/** Može li se dijagnoza uopće pisati modelom (oblak uključen). Prijava se provjerava pri pozivu. */
export const canWriteReport = (): boolean => getSupabase() !== null;

/**
 * Korak 31: činjenice dana → riječi dijagnoze kroz Edge Function `write-report`. Samo s oblakom
 * i prijavom (funkcija traži JWT). Greška, istek vremena ili krivi oblik → `null`.
 */
export async function requestWriteReport(body: WriteReportRequest): Promise<LlmDayText | null> {
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
    return readWriteReportResponse(data);
  } catch (error: unknown) {
    console.warn('write-report failed, keeping local diagnosis', error);
    return null;
  }
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
