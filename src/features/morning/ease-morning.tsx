import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { MorningSleepSettings } from '@/core/checkin';
import type { Checkin, ScheduleBlock } from '@/core/domain';
import { planUnexpected } from '@/core/schedule';
import { assessNight } from '@/core/sleep';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** Prozor „lakšeg jutra“: ono što je u sljedećem satu može ići kasnije. */
export const EASE_MORNING_MINUTES = 60;

/**
 * „Lakše jutro“ (korak 29): nakon prijave kratkog sna brief predloži da se ono što je u sljedećem
 * satu pomakne kasnije. Ništa se ne mijenja samo — gumb otvara „Nešto je iskrslo“ s razlogom
 * „Loš san“, gdje korisnik bira za svaku aktivnost. Bez osude; niz se ne dira.
 */
export function EaseMorning({
  settings,
  saved,
  blocks,
  nowMinutes,
  onEase,
}: {
  settings: MorningSleepSettings;
  saved: Checkin | null;
  blocks: readonly ScheduleBlock[];
  nowMinutes: number;
  onEase?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const night = assessNight(settings, saved);
  if (night === null || night.level === 'rested') return null;

  const affected = planUnexpected(blocks, nowMinutes, EASE_MORNING_MINUTES)?.affected.length ?? 0;
  const hours = Math.floor(night.deficit / 60);
  const minutes = night.deficit % 60;
  const deficit =
    minutes === 0 ? t('morning.ease.hours', { count: hours }) : t('morning.sleep.duration', { hours, minutes });

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}
      accessibilityLiveRegion="polite">
      <Text variant="overline" tone="accent">
        {t('morning.ease.overline')}
      </Text>
      <Text variant="heading" accessibilityRole="header">
        {t('morning.ease.title', { deficit })}
      </Text>
      <Text tone="textMuted">
        {t(night.level === 'veryShort' ? 'morning.ease.bodyVeryShort' : 'morning.ease.body')}
      </Text>
      {affected > 0 && onEase ? (
        <Button
          variant="secondary"
          label={t('morning.ease.action', { count: affected })}
          accessibilityHint={t('morning.ease.actionHint')}
          onPress={onEase}
        />
      ) : (
        <Text tone="textMuted">{t('morning.ease.nothing')}</Text>
      )}
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
});
