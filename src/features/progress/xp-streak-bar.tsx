import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { streakHintKey } from './streak-hint';
import { useProgress } from './use-progress';

/** Kompaktna XP traka + glavni streak na vrhu taba Danas. Dok se učitava ili kod greške — ništa. */
export function XpStreakBar({ today, checkinDay }: { today: string; checkinDay: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const progress = useProgress(today, checkinDay);
  if (progress.status !== 'ready') return null;

  const { level, todayXp, streak } = progress.summary;
  const levelLabel = t('progress.level', { level: level.level });
  const valueText = t('progress.toNext', {
    xp: level.xpIntoLevel,
    total: level.xpForNext,
    next: level.level + 1,
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Text variant="bodyStrong">{levelLabel}</Text>
        <Text
          variant="bodyStrong"
          tone={streak.current > 0 ? 'accent' : 'textMuted'}
          accessibilityLabel={t('progress.streak.a11y', { count: streak.current })}>
          {t('progress.streak.short', { count: streak.current })}
        </Text>
      </View>
      <ProgressBar fraction={level.fraction} accessibilityLabel={levelLabel} valueText={valueText} />
      <View style={styles.row}>
        <Text variant="caption" tone={todayXp > 0 ? 'accent' : 'textMuted'}>
          {t('progress.todayXp', { xp: todayXp })}
        </Text>
        <Text variant="caption" tone="textMuted">
          {valueText}
        </Text>
      </View>
      <Text variant="caption" tone="textMuted">
        {t(streakHintKey(streak))}
      </Text>
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
});
