import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isFreshForWriting, type DayDiagnosis } from '@/core/diagnosis';
import { localDateOf } from '@/core/time/local-date';

import { canWriteReport, refineDayDiagnosis } from './write-report-client';

type Result = { date: string; diagnosis: DayDiagnosis | null };

/**
 * Lokalna dijagnoza dana odmah, a riječi modela (`write-report`, korak 31) kad stignu. Bez oblaka,
 * kad tekst već postoji, za stare dane iz arhive ili kad poziv ne uspije, ostaje lokalna.
 * `writing` je `true` dok se čeka.
 */
export function useWrittenDiagnosis(date: string, base: DayDiagnosis | null) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en' : 'hr';
  const [result, setResult] = useState<Result | null>(null);
  const wanted =
    base !== null && base.llm === undefined && isFreshForWriting(date, localDateOf(new Date())) && canWriteReport();

  useEffect(() => {
    if (!wanted) return;
    let active = true;
    void refineDayDiagnosis(date, locale, (line) => t(`diagnosis.lines.${line.key}`, line.params ?? {})).then(
      (diagnosis) => {
        if (active) setResult({ date, diagnosis });
      },
    );
    return () => {
      active = false;
    };
  }, [date, locale, t, wanted]);

  const current = result?.date === date ? result : null;
  return {
    diagnosis: current?.diagnosis ?? base,
    writing: wanted && current === null,
  };
}
