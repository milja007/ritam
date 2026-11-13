import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { scorePill, type ScoreTrend } from '@/core/progress';
import { radius, spacing } from '@/core/theme';
import { useDayScore, useProgress } from '@/features/progress';
import { RailDot } from '@/ui/ember';
import { Text, type TextProps } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

const TREND_ARROW: Record<ScoreTrend, string> = { better: '↑', same: '→', worse: '↓' };
// Bez crvenog: slabiji dan je informacija, ne kazna.
const TREND_TONE: Record<ScoreTrend, NonNullable<TextProps['tone']>> = {
  better: 'success',
  same: 'info',
  worse: 'textMuted',
};

/**
 * Pilule u zaglavlju Dana (smjer „Žar“): niz dana (žar svijetli dok niz traje) i dnevni rezultat
 * sa strelicom trenda. Dok se podaci učitavaju ili kod greške pilule nema — detalji su na karticama niže.
 */
export function DayPills({ today, checkinDay }: { today: string; checkinDay: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const progress = useProgress(today, checkinDay);
  const score = useDayScore(checkinDay);

  const streak = progress.status === 'ready' ? progress.summary.streak.current : null;
  const pill = score.status === 'ready' ? scorePill(score.headline) : null;
  if (streak === null && pill === null) return null;

  const pillStyle = [styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }];
  const number = (value: number) => value.toLocaleString(i18n.language);
  const trendText =
    pill === null
      ? ''
      : t(`${pill.yesterday ? 'score.trendPrev' : 'score.trend'}.${pill.trend ?? 'first'}`);

  return (
    <View style={styles.row}>
      {streak !== null ? (
        <View
          style={pillStyle}
          accessible
          accessibilityLabel={t('progress.streak.a11y', { count: streak })}>
          <RailDot state={streak > 0 ? 'lit' : 'unlit'} />
          <Text variant="caption" tone={streak > 0 ? 'text' : 'textMuted'} style={styles.value}>
            {t('today.header.streak', { count: streak })}
          </Text>
        </View>
      ) : null}
      {pill !== null ? (
        <View
          style={pillStyle}
          accessible
          accessibilityLabel={t(pill.yesterday ? 'today.header.scoreYesterday' : 'score.a11y', {
            score: number(pill.score),
            trend: trendText,
          })}>
          <Text variant="bodyStrong" style={styles.value}>
            {number(pill.score)}
          </Text>
          {pill.trend !== null ? (
            <Text variant="caption" tone={TREND_TONE[pill.trend]} style={styles.value}>
              {TREND_ARROW[pill.trend]}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xxs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  value: { fontVariant: ['tabular-nums'], fontWeight: '600' },
});
