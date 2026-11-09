import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ScheduleBlock } from '@/core/domain';
import { isDone, type BlockPhase } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

type BlockCardProps = {
  block: ScheduleBlock;
  phase: BlockPhase;
  /** Trenutni blok (istaknut). */
  isCurrent: boolean;
  onPress: () => void;
  onToggleDone: () => void;
};

/** Jedan blok na timelineu: vrijeme, naziv, tip; kvačica za Gotovo; trenutni blok istaknut. */
export function BlockCard({ block, phase, isCurrent, onPress, onToggleDone }: BlockCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const done = isDone(block);
  const dimmed = !isCurrent && (done || phase === 'past');
  const time = t('today.timeRange', { start: block.start, end: block.end });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isCurrent ? colors.surfaceRaised : colors.surface,
          borderColor: isCurrent ? colors.accent : colors.border,
          borderWidth: isCurrent ? 2 : StyleSheet.hairlineWidth,
          opacity: dimmed ? 0.6 : 1,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.editBlockLabel', { title: block.title, time })}
        accessibilityHint={t('today.editBlockHint')}
        onPress={onPress}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.meta}>
          <Text variant="caption" tone={isCurrent ? 'accent' : 'textMuted'} style={styles.time}>
            {time}
          </Text>
          {isCurrent ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text variant="overline" tone="onAccent">
                {t('today.now')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          style={done ? styles.doneTitle : undefined}>
          {block.title}
        </Text>
        <Text variant="caption" tone="textMuted">
          {t(`today.kind.${block.kind}`)}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={t('today.markDone', { title: block.title })}
        accessibilityState={{ checked: done }}
        hitSlop={spacing.sm}
        onPress={onToggleDone}
        style={({ pressed }) => [
          styles.check,
          {
            borderColor: done ? colors.success : colors.textMuted,
            backgroundColor: done ? colors.success : 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        {done ? (
          <Text variant="bodyStrong" tone="onAccent">
            ✓
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: radius.md,
  },
  main: {
    flex: 1,
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { fontVariant: ['tabular-nums'] },
  badge: { paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  doneTitle: { textDecorationLine: 'line-through' },
  check: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
