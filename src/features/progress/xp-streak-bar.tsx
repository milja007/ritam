import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';
import { XpPop } from '@/ui/xp-pop';

import { streakHintKey } from './streak-hint';
import { useProgress } from './use-progress';
import { useXpGain } from './use-xp-gain';

/**
 * Kompaktna XP traka + glavni streak na vrhu taba Danas. Dok se učitava ili kod greške — ništa.
 * Kad XP naraste dok je ekran otvoren (Gotovo, večernji upit), uz ukupni XP iskoči „+N XP“
 * (korak 35) i dobitak se javi čitaču zaslona.
 */
export function XpStreakBar({ today, checkinDay }: { today: string; checkinDay: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const progress = useProgress(today, checkinDay);
  const { gain, id } = useXpGain(progress.status === 'ready' ? progress.summary.totalXp : null);
  const gainAnnouncement = gain > 0 ? t('progress.xpGainA11y', { xp: gain }) : null;

  useEffect(() => {
    if (gainAnnouncement !== null) AccessibilityInfo.announceForAccessibility(gainAnnouncement);
  }, [gainAnnouncement, id]);

  if (progress.status !== 'ready') return null;

  const { totalXp, level, todayXp, streak } = progress.summary;
  const xpLabel = t('progress.totalXp', { xp: totalXp });
  const valueText = t('progress.toNextLevel', {
    xp: level.xpIntoLevel,
    total: level.xpForNext,
    level: level.level + 1,
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.xp}>
          <Text variant="bodyStrong">{xpLabel}</Text>
          <XpPop gain={gain} trigger={id} text={t('progress.xpGain', { xp: gain })} />
        </View>
        <Text
          variant="bodyStrong"
          tone={streak.current > 0 ? 'accent' : 'textMuted'}
          accessibilityLabel={t('progress.streak.a11y', { count: streak.current })}>
          {t('progress.streak.short', { count: streak.current })}
        </Text>
      </View>
      <ProgressBar fraction={level.fraction} accessibilityLabel={xpLabel} valueText={valueText} />
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
  xp: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
});
