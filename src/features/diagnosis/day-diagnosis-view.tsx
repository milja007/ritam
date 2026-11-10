import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { DayDiagnosis, DiagnosisLine, ProgressRow, Trend } from '@/core/diagnosis';
import { radius, spacing } from '@/core/theme';
import { Text, type TextProps } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

const TREND_ARROW: Record<Trend, string> = { better: '↑', same: '→', worse: '↓', first: '✦' };
// Bez crvenog: "lošije" je informacija, ne kazna.
const TREND_TONE: Record<Trend, NonNullable<TextProps['tone']>> = {
  better: 'success',
  same: 'info',
  worse: 'textMuted',
  first: 'accent',
};
const CHANGE_ARROW = { up: '↑', down: '↓', same: '→' } as const;

type LineSection = 'praise' | 'noticed' | 'problems' | 'ideas';
const LINE_SECTIONS: readonly LineSection[] = ['praise', 'noticed', 'problems', 'ideas'];

/**
 * Prikaz dnevne dijagnoze redom iz koncepta: Ukratko → Napredak → Pohvale → Što smo primijetili →
 * Veliki problemi → Ideje za napredak. Retci su i18n ključevi, pa se prikazuju na jeziku appa.
 */
export function DayDiagnosisView({ diagnosis }: { diagnosis: DayDiagnosis }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = (line: DiagnosisLine) => t(`diagnosis.lines.${line.key}`, line.params ?? {});

  return (
    <View style={styles.root}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.summary')}
        </Text>
        <View style={styles.summaryRow} accessible accessibilityLabel={`${t(`diagnosis.trend.${diagnosis.trend}`)}. ${lineText(diagnosis.summary)}`}>
          <Text variant="title" tone={TREND_TONE[diagnosis.trend]}>
            {TREND_ARROW[diagnosis.trend]}
          </Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone={TREND_TONE[diagnosis.trend]}>
              {t(`diagnosis.trend.${diagnosis.trend}`)}
            </Text>
            <Text>{lineText(diagnosis.summary)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.progress')}
        </Text>
        {diagnosis.progress.map((row) => (
          <ProgressRowView key={row.metric} row={row} />
        ))}
      </View>

      {LINE_SECTIONS.map((section) => (
        <View
          key={section}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="overline" tone={section === 'ideas' ? 'accent' : 'textMuted'} accessibilityRole="header">
            {t(`diagnosis.sections.${section}`)}
          </Text>
          {diagnosis[section].map((line, index) => (
            <View key={`${line.key}-${index}`} style={styles.bulletRow}>
              <Text tone={section === 'ideas' ? 'accent' : 'textMuted'} importantForAccessibility="no">
                •
              </Text>
              <View style={styles.flex}>
                <Text>{lineText(line)}</Text>
                {typeof line.params?.repeatedDays === 'number' ? (
                  <Text variant="caption" tone="textMuted">
                    {t('diagnosis.repeated', { count: line.params.repeatedDays })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ProgressRowView({ row }: { row: ProgressRow }) {
  const { t, i18n } = useTranslation();
  const number = (value: number) => value.toLocaleString(i18n.language);

  const format = (value: number, total?: number): string => {
    switch (row.metric) {
      case 'score':
        return t('diagnosis.value.score', { score: number(value) });
      case 'plan':
      case 'rules':
        return t('diagnosis.value.ofTotal', { value: number(value), total: number(total ?? 0) });
      case 'sleep':
        return t('diagnosis.value.duration', { hours: Math.floor(value / 60), minutes: value % 60 });
      case 'xp':
        return t('diagnosis.value.xp', { xp: number(value) });
      case 'rating':
        return t('diagnosis.value.rating', { rating: value });
      case 'streak':
        return t('diagnosis.value.days', { days: number(value) });
    }
  };

  const today = format(row.value, row.total);
  const previous =
    row.previous === null ? null : t('diagnosis.yesterday', { value: format(row.previous, row.previousTotal) });
  const tone: NonNullable<TextProps['tone']> =
    row.good === true ? 'success' : row.good === false ? 'textMuted' : 'info';
  const label = t(`diagnosis.metric.${row.metric}`);

  return (
    <View
      style={styles.metricRow}
      accessible
      accessibilityLabel={[label, today, previous].filter((part) => part !== null).join(', ')}>
      <Text style={styles.flex} tone="textMuted">
        {label}
      </Text>
      <View style={styles.metricValues}>
        <Text variant="bodyStrong">
          {today}
          {row.change !== null ? <Text tone={tone}>{` ${CHANGE_ARROW[row.change]}`}</Text> : null}
        </Text>
        {previous !== null ? (
          <Text variant="caption" tone="textMuted">
            {previous}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metricValues: { alignItems: 'flex-end' },
});
