import type { TFunction } from 'i18next';

import type { DiagnosisLine } from '@/core/diagnosis';
import { formatEuro } from '@/features/trackers/format';

/**
 * Redak dnevne dijagnoze kao tekst na jeziku appa. Parametri `…Cents` (iznosi, korak 31b)
 * postaju formatirani euri pod imenom bez nastavka (`diffCents` → `diff`).
 */
export function diagnosisLineText(t: TFunction, line: DiagnosisLine, language: string): string {
  const params: Record<string, string | number> = { ...(line.params ?? {}) };
  for (const [key, value] of Object.entries(line.params ?? {})) {
    if (key.endsWith('Cents') && typeof value === 'number') params[key.slice(0, -'Cents'.length)] = formatEuro(value, language);
  }
  return t(`diagnosis.lines.${line.key}`, params);
}
