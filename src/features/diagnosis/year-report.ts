import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isYearFreshForWriting, type YearDiagnosis } from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { generateYearReport, markReportSeen } from '@/db/repos';

import { capitalize, monthLineParams } from './month-diagnosis-view';
import { canWriteReport, refineYearDiagnosis } from './write-report-client';
import { yearLineParams } from './year-line-params';

type Loaded = { key: string; status: 'ready' | 'none' | 'error'; diagnosis: YearDiagnosis | null; seen: boolean };

export type YearReportState = {
  /** `none`: dijagnoza još nije dostupna (godina traje ili nema zaključenih dana). */
  status: 'loading' | 'ready' | 'none' | 'error';
  diagnosis: YearDiagnosis | null;
  seen: boolean;
  /** Čekaju se riječi modela (korak 31e); lokalna dijagnoza je već tu. */
  writing: boolean;
  markSeen: () => void;
};

/**
 * Dijagnoza godine `year` ("YYYY", korak 37b): napravi je (ili osvježi) iz lokalnih podataka čim
 * je dostupna. `refresh` se promijeni kad se podaci godine promijene (učitani podaci taba).
 * `enabled = false`: ne čita bazu (npr. prošla godina izvan siječnja).
 */
export function useYearReport(year: string, today: string, refresh: unknown, enabled = true): YearReportState {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en' : 'hr';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [written, setWritten] = useState<{ base: YearDiagnosis; diagnosis: YearDiagnosis | null } | null>(null);
  const key = `${year}|${today}|${enabled ? 1 : 0}`;

  useEffect(() => {
    let active = true;
    // Čitanje baze odgodi iza crtanja taba.
    const handle = setTimeout(() => {
      let next: Loaded;
      if (!enabled) {
        if (active) setLoaded({ key, status: 'none', diagnosis: null, seen: false });
        return;
      }
      try {
        const result = generateYearReport(getDb(), LOCAL_USER_ID, year, today);
        next = result
          ? { key, status: 'ready', diagnosis: result.diagnosis, seen: result.report.seenAt !== null }
          : { key, status: 'none', diagnosis: null, seen: false };
      } catch (error: unknown) {
        console.error('Generating year diagnosis failed', error);
        next = { key, status: 'error', diagnosis: null, seen: false };
      }
      if (active) setLoaded(next);
    }, 0);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [key, year, today, refresh, enabled]);

  const markSeen = useCallback(() => {
    const start = `${year}-01-01`;
    try {
      if (!markReportSeen(getDb(), LOCAL_USER_ID, 'year', start)) return;
    } catch (error: unknown) {
      console.error('Marking year diagnosis seen failed', error);
      return;
    }
    setLoaded((current) => (current !== null && current.key === key ? { ...current, seen: true } : current));
  }, [key, year]);

  const current = loaded !== null && loaded.key === key ? loaded : null;
  const base = current?.status === 'ready' ? current.diagnosis : null;
  // Korak 31e: riječi modela samo za svježu godinu (31. 12. ili 1. 1.) i s oblakom.
  const wanted = base !== null && base.llm === undefined && isYearFreshForWriting(base.end, today) && canWriteReport();

  useEffect(() => {
    if (!wanted || base === null) return;
    let active = true;
    void refineYearDiagnosis(
      base.start,
      locale,
      (line) => capitalize(t(`diagnosis.year.lines.${line.key}`, yearLineParams(line, locale))),
      (line) => capitalize(t(`diagnosis.month.lines.${line.key}`, monthLineParams(line, locale))),
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
