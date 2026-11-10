import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ScheduleBlock } from '@/core/domain';
import type { BlockDraft } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** Zajednički dijelovi izrade plana ("Što imaš sutra?" i plan za danas). */
export function Chip({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text variant="bodyStrong">+ {label}</Text>
    </Pressable>
  );
}

export function ExistingRow({ block }: { block: ScheduleBlock }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowMain}>
        <Text variant="caption" tone="textMuted">
          {t('today.timeRange', { start: block.start, end: block.end })} · {t(`today.kind.${block.kind}`)}
        </Text>
        <Text>{block.title}</Text>
      </View>
    </View>
  );
}

export function DraftRow({
  draft,
  onEdit,
  onRemove,
}: {
  draft: BlockDraft;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const time = t('today.timeRange', { start: draft.start, end: draft.end });
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.editBlockLabel', {
          title: draft.title,
          time,
        })}
        accessibilityHint={t('today.editBlockHint')}
        onPress={onEdit}
        style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}>
        <Text variant="caption" tone="accent">
          {time} · {t(`today.kind.${draft.kind}`)}
        </Text>
        <Text variant="bodyStrong">{draft.title}</Text>
      </Pressable>
      <Button
        variant="ghost"
        label={t('evening.tomorrow.remove')}
        accessibilityLabel={t('evening.tomorrow.removeLabel', {
          title: draft.title,
        })}
        onPress={onRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: spacing.xs, paddingVertical: spacing.md },
});
