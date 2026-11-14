import { useCallback, useEffect, useState } from 'react';

import type { MonthDiagnosis } from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { generateMonthReport, markReportSeen } from '@/db/repos';

type Loaded = { key: string; status: 'ready' | 'none' | 'error'; diagnosis: MonthDiagnosis | null; seen: boolean };

export type MonthReportState = {
  /** `none`: dijagnoza još nije dostupna (mjesec traje ili nema zaključenih dana). */
  status: 'loading' | 'ready' | 'none' | 'error';
  diagnosis: MonthDiagnosis | null;
  seen: boolean;
  markSeen: () => void;
};

/**
 * Dijagnoza mjeseca `month` ("YYYY-MM", korak 37): napravi je (ili osvježi) iz lokalnih podataka
 * čim je dostupna. `refresh` se promijeni kad se podaci mjeseca promijene (učitani podaci taba).
 */
export function useMonthReport(month: string, today: string, refresh: unknown): MonthReportState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
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
  return {
    status: current?.status ?? 'loading',
    diagnosis: current?.diagnosis ?? null,
    seen: current?.seen ?? false,
    markSeen,
  };
}
