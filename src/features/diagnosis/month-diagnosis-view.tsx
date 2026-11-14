import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { MonthDiagnosis, MonthLine } from '@/core/diagnosis';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { dayMonthName, WEEK_TREND_ARROW, WEEK_TREND_TONE, WeekProgressRowView, weekdayName } from './week-diagnosis-view';

type LineSection = 'praise' | 'noticed' | 'problems' | 'ideas';
const LINE_SECTIONS: readonly LineSection[] = ['praise', 'noticed', 'problems', 'ideas'];

/**
 * Parametri retka mjesečne dijagnoze za prikaz: `…Date` postaje datum („12. studenoga“), a
 * `…Weekday` naziv dana u tjednu („srijeda“).
 */
export function monthLineParams(line: MonthLine, language: string): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(line.params ?? {})) {
    if (typeof value === 'string' && name.endsWith('Date')) params[name] = dayMonthName(value, language);
    else if (typeof value === 'string' && name.endsWith('Weekday')) params[name] = weekdayName(value, language);
    else params[name] = value;
  }
  return params;
}

/** Prvo slovo veliko (HR nazivi dana na početku rečenice). */
export const capitalize = (text: string): string => (text.length > 0 ? text[0]?.toUpperCase() + text.slice(1) : text);

/** Tekst retka mjesečne dijagnoze na jeziku appa. */
export function useMonthLineText(): (line: MonthLine) => string {
  const { t, i18n } = useTranslation();
  return (line) => capitalize(t(`diagnosis.month.lines.${line.key}`, monthLineParams(line, i18n.language)));
}

/**
 * Prikaz mjesečne dijagnoze istim redom kao tjedna: Ukratko → Napredak → Pohvale → Što smo
 * primijetili → Veliki problemi → Smjer za idući mjesec. Ideje (najviše dvije) su smjer, bez
 * „Probat ću“: nove promjene i dalje dolaze jedna po jedna kroz tjednu dijagnozu.
 */
export function MonthDiagnosisView({ diagnosis }: { diagnosis: MonthDiagnosis }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = useMonthLineText();
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const trendLabel = t(`diagnosis.month.trend.${diagnosis.trend}`);

  return (
    <View style={styles.root}>
      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.summary')}
        </Text>
        <View style={styles.summaryRow} accessible accessibilityLabel={`${trendLabel}. ${lineText(diagnosis.summary)}`}>
          <Text variant="title" tone={WEEK_TREND_TONE[diagnosis.trend]}>
            {WEEK_TREND_ARROW[diagnosis.trend]}
          </Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone={WEEK_TREND_TONE[diagnosis.trend]}>
              {trendLabel}
            </Text>
            <Text>{lineText(diagnosis.summary)}</Text>
          </View>
        </View>
      </View>

      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.progress')}
        </Text>
        {diagnosis.progress.map((row) => (
          <WeekProgressRowView key={row.metric} row={row} period="month" />
        ))}
      </View>

      {LINE_SECTIONS.map((section) => (
        <View
          key={section}
          style={[card, section === 'ideas' ? { borderColor: colors.accent, borderWidth: 1 } : null]}>
          <Text variant="overline" tone={section === 'ideas' ? 'accent' : 'textMuted'} accessibilityRole="header">
            {t(`diagnosis.sections.${section}`)}
          </Text>
          {diagnosis[section].map((line, index) => (
            <View key={`${line.key}-${index}`} style={styles.bulletRow}>
              <Text tone={section === 'ideas' ? 'accent' : 'textMuted'} importantForAccessibility="no">
                •
              </Text>
              <Text style={styles.flex}>{lineText(line)}</Text>
            </View>
          ))}
          {section === 'ideas' ? (
            <Text variant="caption" tone="textMuted">
              {t('diagnosis.month.ideasNote')}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
});
