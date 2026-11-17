import { useTranslation } from 'react-i18next';

import type { YearLine } from '@/core/diagnosis';
import { monthName } from '@/features/ember/format';

import { capitalize } from './month-diagnosis-view';
import { dayMonthName, weekdayName } from './week-diagnosis-view';

/** Naziv mjeseca u rečenici: HR malim slovom („studeni“), EN velikim („November“). */
function monthInSentence(month: string, language: string): string {
  const name = monthName(month, language);
  return language === 'hr' ? name.toLowerCase() : name;
}

/**
 * Parametri retka godišnje dijagnoze za prikaz: `…Date` → datum („12. studenoga“), `…Weekday` →
 * naziv dana, `…Month` ("YYYY-MM") → naziv mjeseca.
 */
export function yearLineParams(line: YearLine, language: string): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(line.params ?? {})) {
    if (typeof value === 'string' && name.endsWith('Date')) params[name] = dayMonthName(value, language);
    else if (typeof value === 'string' && name.endsWith('Weekday')) params[name] = weekdayName(value, language);
    else if (typeof value === 'string' && name.endsWith('Month')) params[name] = monthInSentence(value, language);
    else params[name] = value;
  }
  return params;
}

/** Tekst retka godišnje dijagnoze na jeziku appa. */
export function useYearLineText(): (line: YearLine) => string {
  const { t, i18n } = useTranslation();
  return (line) => capitalize(t(`diagnosis.year.lines.${line.key}`, yearLineParams(line, i18n.language)));
}
