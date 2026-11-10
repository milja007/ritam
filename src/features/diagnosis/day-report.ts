import { useEffect, useState } from 'react';

import { parseDayDiagnosis, type DayDiagnosis } from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { generateDayReport, getReport } from '@/db/repos';

/**
 * Napravi (ili osvježi) lokalnu dijagnozu dana nakon spremanja upita. Greška se samo zapiše —
 * upit je već spremljen, a dijagnoza se može napraviti kasnije s kartice.
 */
export function generateDayDiagnosis(date: string): DayDiagnosis | null {
  try {
    return generateDayReport(getDb(), LOCAL_USER_ID, date).diagnosis;
  } catch (error: unknown) {
    console.error('Generating day diagnosis failed', error);
    return null;
  }
}

type State = { date: string; status: 'ready' | 'error'; diagnosis: DayDiagnosis | null };

/**
 * Dijagnoza dana iz `reports`. Ako je nema (upit spremljen prije koraka 16) ili je starije
 * verzije, napravi se sada iz spremljenih podataka.
 */
export function useDayReport(date: string) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let active = true;
    getReport(getDb(), LOCAL_USER_ID, 'day', date)
      .then((report) => {
        const stored = report ? parseDayDiagnosis(report.sections) : null;
        const diagnosis = stored ?? generateDayReport(getDb(), LOCAL_USER_ID, date).diagnosis;
        if (active) setState({ date, status: 'ready', diagnosis });
      })
      .catch((error: unknown) => {
        console.error('Loading day diagnosis failed', error);
        if (active) setState({ date, status: 'error', diagnosis: null });
      });
    return () => {
      active = false;
    };
  }, [date]);

  const current = state?.date === date ? state : null;
  return { status: current?.status ?? 'loading', diagnosis: current?.diagnosis ?? null };
}
