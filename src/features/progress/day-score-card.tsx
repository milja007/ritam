import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { ScoreComparison, ScoreTrend } from '@/core/progress';
import { radius, spacing } from '@/core/theme';
import { Text, type TextProps } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { useDayScore } from './use-day-score';

type Trend = ScoreTrend | 'first';

const TREND_ARROW: Record<Trend, string> = { better: '↑', same: '→', worse: '↓', first: '✦' };
// Bez crvenog: "slabije" je informacija, ne kazna.
const TREND_TONE: Record<Trend, NonNullable<TextProps['tone']>> = {
  better: 'success',
  same: 'info',
  worse: 'textMuted',
  first: 'accent',
};

/**
 * Dnevni rezultat 0–100 na tabu Danas (korak 16b): broj, strelica trenda naspram dana prije, isti dan
 * prošli tjedan, prosjek 7 dana naspram 7 prije i osobni rekord. Do večernjeg upita velik je
 * jučerašnji konačni rezultat, a današnji "u tijeku" manji ispod (korak 16c, odluka P43).
 * Dok se učitava ili kod greške — ništa.
 */
export function DayScoreCard({ checkinDay }: { checkinDay: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const state = useDayScore(checkinDay);
  if (state.status !== 'ready') return null;

  const number = (value: number) => value.toLocaleString(i18n.language);
  const signed = (comparison: ScoreComparison) =>
    comparison.diff > 0 ? `+${number(comparison.diff)}` : comparison.diff < 0 ? `−${number(-comparison.diff)}` : '±0';

  const { featured, featuresYesterday, todayInProgress } = state.headline;
  const { today, vsYesterday, vsLastWeek, last7, prev7, last7Trend, records, isDayRecord } = featured;
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (today === null) {
    return (
      <View style={cardStyle}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('score.title')}
        </Text>
        <Text variant="caption" tone="textMuted">
          {t('score.empty')}
        </Text>
      </View>
    );
  }

  const trend: Trend = vsYesterday?.trend ?? 'first';
  const trendText = featuresYesterday ? t(`score.trendPrev.${trend}`) : t(`score.trend.${trend}`);
  const details = [
    vsYesterday
      ? t(featuresYesterday ? 'score.dayBefore' : 'score.yesterday', { score: number(vsYesterday.previous) })
      : null,
    vsLastWeek ? t('score.lastWeek', { score: number(vsLastWeek.previous) }) : null,
    last7 !== null
      ? prev7 !== null
        ? `${last7Trend ? `${TREND_ARROW[last7Trend]} ` : ''}${t('score.last7vs', { avg: number(last7), prev: number(prev7) })}`
        : t('score.last7', { avg: number(last7) })
      : null,
  ].filter((line): line is string => line !== null);
  const record = isDayRecord
    ? t('score.newRecord')
    : records.day && records.day.date !== today.date
      ? t('score.record', { score: number(records.day.score) })
      : null;

  const todayLine = featuresYesterday
    ? todayInProgress
      ? t('score.todayProgress', { score: number(todayInProgress.score) })
      : t('score.todayEmpty')
    : null;

  return (
    <View
      style={cardStyle}
      accessible
      accessibilityLabel={[
        featuresYesterday
          ? t('score.a11yYesterday', {
              score: today.score,
              trend: trendText,
              today: todayInProgress ? todayInProgress.score : '—',
            })
          : t('score.a11y', { score: today.score, trend: trendText }),
        featuresYesterday || today.final ? null : t('score.inProgress'),
        ...details,
        record,
      ]
        .filter(Boolean)
        .join('. ')}>
      <View style={styles.row}>
        <Text variant="overline" tone="textMuted">
          {t('score.title')}
        </Text>
        <Text variant="caption" tone="textMuted">
          {featuresYesterday ? t('score.yesterdayFinal') : today.final ? t('score.final') : t('score.inProgress')}
        </Text>
      </View>
      <View style={styles.scoreRow}>
        <Text variant="display">{number(today.score)}</Text>
        <Text variant="caption" tone="textMuted" style={styles.outOf}>
          {t('score.outOf')}
        </Text>
        <View style={styles.trend}>
          <Text variant="heading" tone={TREND_TONE[trend]}>
            {TREND_ARROW[trend]}
            {vsYesterday ? ` ${signed(vsYesterday)}` : ''}
          </Text>
          <Text variant="caption" tone={TREND_TONE[trend]}>
            {trendText}
          </Text>
        </View>
      </View>
      {todayLine ? (
        <View style={[styles.todayRow, { borderColor: colors.border }]}>
          <Text variant="bodyStrong">{todayLine}</Text>
          <Text variant="caption" tone="textMuted">
            {t('score.inProgress')}
          </Text>
        </View>
      ) : null}
      {details.length > 0 ? (
        <View style={styles.details}>
          {details.map((line) => (
            <Text key={line} variant="caption" tone="textMuted">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {record ? (
        <Text variant="caption" tone="accent">
          {record}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  outOf: { marginBottom: spacing.xs },
  trend: { flex: 1, alignItems: 'flex-end' },
  details: { gap: spacing.xs },
  todayRow: {
    gap: spacing.xxs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
