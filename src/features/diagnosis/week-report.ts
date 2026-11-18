import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isWeekFreshForWriting, type WeekDiagnosis } from '@/core/diagnosis';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { answerReportSuggestion, generateWeekReport, markReportSeen } from '@/db/repos';
import { syncNotificationsNow } from '@/features/notifications';

import { weekLineParams } from './week-diagnosis-view';
import { canWriteReport, refineWeekDiagnosis } from './write-report-client';

type Loaded = {
  key: string;
  status: 'ready' | 'none' | 'error';
  diagnosis: WeekDiagnosis | null;
  accepted: boolean | null;
  seen: boolean;
};

export type WeekReportState = {
  /** `none`: dijagnoza još nije dostupna (tjedan traje ili nema zaključenih dana). */
  status: 'loading' | 'ready' | 'none' | 'error';
  diagnosis: WeekDiagnosis | null;
  /** Odgovor na prijedlog: `true` prihvaćen, `false` odbijen, `null` bez odgovora. */
  accepted: boolean | null;
  seen: boolean;
  /** Čekaju se riječi modela (korak 31c); lokalna dijagnoza je već tu. */
  writing: boolean;
  /** Spremi odgovor na prijedlog; vraća je li uspjelo. */
  answer: (accepted: boolean) => boolean;
  markSeen: () => void;
};

/**
 * Dijagnoza tjedna koji počinje ponedjeljkom `start` (korak 36): napravi je (ili osvježi) iz
 * lokalnih podataka čim je dostupna. `refresh` je bilo koja vrijednost koja se promijeni kad se
 * podaci tjedna promijene (npr. učitani podaci taba) — tada se dijagnoza ponovno provjeri.
 *
 * Korak 31c: za svjež tjedan (nedjelja ili ponedjeljak poslije) s oblakom dopiše riječi modela;
 * dok se čeka, `writing` je `true`, a lokalna dijagnoza je na ekranu.
 */
export function useWeekReport(start: string, today: string, refresh: unknown): WeekReportState {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en' : 'hr';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [written, setWritten] = useState<{ base: WeekDiagnosis; diagnosis: WeekDiagnosis | null } | null>(null);
  const key = `${start}|${today}`;

  useEffect(() => {
    let active = true;
    // Čitanje baze odgodi iza crtanja taba.
    const handle = setTimeout(() => {
      let next: Loaded;
      try {
        const result = generateWeekReport(getDb(), LOCAL_USER_ID, start, today);
        next = result
          ? {
              key,
              status: 'ready',
              diagnosis: result.diagnosis,
              accepted: result.report.suggestionAccepted,
              seen: result.report.seenAt !== null,
            }
          : { key, status: 'none', diagnosis: null, accepted: null, seen: false };
      } catch (error: unknown) {
        console.error('Generating week diagnosis failed', error);
        next = { key, status: 'error', diagnosis: null, accepted: null, seen: false };
      }
      if (active) setLoaded(next);
    }, 0);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [key, start, today, refresh]);

  const answer = useCallback(
    (accepted: boolean): boolean => {
      try {
        if (!answerReportSuggestion(getDb(), LOCAL_USER_ID, 'week', start, accepted)) return false;
      } catch (error: unknown) {
        console.error('Saving week suggestion answer failed', error);
        return false;
      }
      setLoaded((current) => (current !== null && current.key === key ? { ...current, accepted } : current));
      return true;
    },
    [key, start],
  );

  const markSeen = useCallback(() => {
    try {
      if (!markReportSeen(getDb(), LOCAL_USER_ID, 'week', start)) return;
    } catch (error: unknown) {
      console.error('Marking week diagnosis seen failed', error);
      return;
    }
    void syncNotificationsNow(); // ponedjeljkom jutarnja obavijest više ne javlja tjednu
    setLoaded((current) => (current !== null && current.key === key ? { ...current, seen: true } : current));
  }, [key, start]);

  const current = loaded !== null && loaded.key === key ? loaded : null;
  const base = current?.status === 'ready' ? current.diagnosis : null;
  const wanted = base !== null && base.llm === undefined && isWeekFreshForWriting(start, today) && canWriteReport();

  useEffect(() => {
    if (!wanted || base === null) return;
    let active = true;
    void refineWeekDiagnosis(start, locale, (line) =>
      t(`diagnosis.week.lines.${line.key}`, weekLineParams(line, locale)),
    ).then((diagnosis) => {
      if (active) setWritten({ base, diagnosis });
    });
    return () => {
      active = false;
    };
  }, [base, locale, start, t, wanted]);

  // Tekst modela vrijedi samo za dijagnozu iz koje je zatražen (osvježena dijagnoza ga ne nasljeđuje).
  const writtenNow = written !== null && written.base === base ? written : null;
  return {
    status: current?.status ?? 'loading',
    diagnosis: writtenNow?.diagnosis ?? current?.diagnosis ?? null,
    writing: wanted && writtenNow === null,
    accepted: current?.accepted ?? null,
    seen: current?.seen ?? false,
    answer,
    markSeen,
  };
}
