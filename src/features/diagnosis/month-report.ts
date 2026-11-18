import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isMonthFreshForWriting, type MonthDiagnosis } from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { generateMonthReport, markReportSeen } from '@/db/repos';

import { capitalize, monthLineParams } from './month-diagnosis-view';
import { canWriteReport, refineMonthDiagnosis } from './write-report-client';

type Loaded = { key: string; status: 'ready' | 'none' | 'error'; diagnosis: MonthDiagnosis | null; seen: boolean };

export type MonthReportState = {
  /** `none`: dijagnoza još nije dostupna (mjesec traje ili nema zaključenih dana). */
  status: 'loading' | 'ready' | 'none' | 'error';
  diagnosis: MonthDiagnosis | null;
  seen: boolean;
  /** Čekaju se riječi modela (korak 31d); lokalna dijagnoza je već tu. */
  writing: boolean;
  markSeen: () => void;
};

/**
 * Dijagnoza mjeseca `month` ("YYYY-MM", korak 37): napravi je (ili osvježi) iz lokalnih podataka
 * čim je dostupna. `refresh` se promijeni kad se podaci mjeseca promijene (učitani podaci taba).
 */
export function useMonthReport(month: string, today: string, refresh: unknown): MonthReportState {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en' : 'hr';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [written, setWritten] = useState<{ base: MonthDiagnosis; diagnosis: MonthDiagnosis | null } | null>(null);
  const key = `${month}|${today}`;

  useEffect(() => {
    let active = true;
    // Čitanje baze odgodi iza crtanja taba.
    const handle = setTimeout(() => {
      let next: Loaded;
      try {
        const result = generateMonthReport(getDb(), LOCAL_USER_ID, month, today);
        next = result
          ? { key, status: 'ready', diagnosis: result.diagnosis, seen: result.report.seenAt !== null }
          : { key, status: 'none', diagnosis: null, seen: false };
      } catch (error: unknown) {
        console.error('Generating month diagnosis failed', error);
        next = { key, status: 'error', diagnosis: null, seen: false };
      }
      if (active) setLoaded(next);
    }, 0);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [key, month, today, refresh]);

  const markSeen = useCallback(() => {
    const start = `${month}-01`;
    try {
      if (!markReportSeen(getDb(), LOCAL_USER_ID, 'month', start)) return;
    } catch (error: unknown) {
      console.error('Marking month diagnosis seen failed', error);
      return;
    }
    setLoaded((current) => (current !== null && current.key === key ? { ...current, seen: true } : current));
  }, [key, month]);

  const current = loaded !== null && loaded.key === key ? loaded : null;
  const base = current?.status === 'ready' ? current.diagnosis : null;
  // Korak 31d: riječi modela samo za svjež mjesec (zadnji dan ili dan poslije) i s oblakom.
  const wanted = base !== null && base.llm === undefined && isMonthFreshForWriting(base.end, today) && canWriteReport();

  useEffect(() => {
    if (!wanted || base === null) return;
    let active = true;
    void refineMonthDiagnosis(base.start, locale, (line) =>
      capitalize(t(`diagnosis.month.lines.${line.key}`, monthLineParams(line, locale))),
    ).then((diagnosis) => {
      if (active) setWritten({ base, diagnosis });
    });
    return () => {
      active = false;
    };
  }, [base, locale, t, wanted]);

  const writtenNow = written !== null && written.base === base ? written : null;
  return {
    status: current?.status ?? 'loading',
    diagnosis: writtenNow?.diagnosis ?? current?.diagnosis ?? null,
    writing: wanted && writtenNow === null,
    seen: current?.seen ?? false,
    markSeen,
  };
}
