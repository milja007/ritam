import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/text';

import { useHealthTotal } from './health-prefs';
import { useHealthSourceName } from './health-toggle';

const locale = (language: string) => (language.startsWith('en') ? 'en-IE' : 'hr-HR');

/**
 * Korak 39: aktivne kalorije i koraci danas iz Healtha, uz tracker kalorija. Samo prikaz — ne
 * mijenja zbroj pojedenog, rezultat dana ni dijagnozu. Ništa se ne prikazuje dok je Health
 * isključen ili podatka nema.
 */
export function HealthTodayLine({ date }: { date: string }) {
  const { t, i18n } = useTranslation();
  const source = useHealthSourceName();
  const kcal = useHealthTotal('activeKcal', date);
  const steps = useHealthTotal('steps', date);
  if (kcal === null && steps === null) return null;

  const number = (value: number) => new Intl.NumberFormat(locale(i18n.language), { maximumFractionDigits: 0 }).format(value);
  const text =
    kcal !== null && steps !== null
      ? t('health.today.both', { source, kcal: number(kcal), steps: number(steps) })
      : kcal !== null
        ? t('health.today.kcal', { source, kcal: number(kcal) })
        : t('health.today.steps', { source, steps: number(steps ?? 0) });

  return (
    <Text variant="caption" tone="textMuted">
      {text}
    </Text>
  );
}
