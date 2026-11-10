import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BlockStatus, ScheduleBlock } from '@/core/domain';
import { blockActions, isCancelled, type BlockPhase } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { ReportPills } from './report-pills';

type BlockCardProps = {
  block: ScheduleBlock;
  phase: BlockPhase;
  /** Zadnji redak rasporeda (bez linije prema dolje). */
  last?: boolean;
  onPress: () => void;
  /** Prijava prošle aktivnosti izravno na rasporedu. */
  onReport: (status: BlockStatus) => void;
};

/**
 * Redak velikog rasporeda (17c): vrijeme lijevo, točka i linija vremena, naziv i tip;
 * prošle se prijavljuju U redu / Djelomično / Nije izravno; otkazane su prekrižene.
 */
export function BlockCard({ block, phase, last = false, onPress, onReport }: BlockCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const cancelled = isCancelled(block) && phase !== 'past';
  const reportable = blockActions(block, phase).report.length > 1;
  const settled = block.status !== 'planned';
  const dimmed = cancelled || (phase === 'past' && settled) || block.kind === 'sleep';
  const time = t('today.timeRange', { start: block.start, end: block.end });
  const dotColor =
    block.status === 'done'
      ? colors.success
      : block.status === 'partial'
        ? colors.accent
        : block.status === 'skipped'
          ? colors.danger
          : colors.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text variant="bodyStrong" style={styles.tabular} tone={dimmed ? 'textMuted' : 'text'}>
          {block.start}
        </Text>
        <Text variant="caption" tone="textMuted" style={styles.tabular}>
          {block.end}
        </Text>
      </View>

      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            { borderColor: dotColor, backgroundColor: settled ? dotColor : 'transparent' },
          ]}
        />
        {last ? null : <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>

      <View style={[styles.body, { opacity: dimmed ? 0.65 : 1 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('today.editBlockLabel', { title: block.title, time })}
          accessibilityHint={t('today.blockHint')}
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}>
          <View style={styles.titleRow}>
            <Text
              variant="bodyStrong"
              numberOfLines={2}
              style={[styles.title, cancelled || block.status === 'done' ? styles.struck : null]}>
              {block.title}
            </Text>
            {cancelled ? (
              <Text variant="caption" tone="danger">
                {t('today.status.cancelled')}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" tone="textMuted">
            {t(`today.kind.${block.kind}`)}
          </Text>
          {block.note ? (
            <Text variant="caption" tone="textMuted" numberOfLines={2} style={styles.note}>
              {t('today.note.preview', { note: block.note })}
            </Text>
          ) : null}
          {reportable ? (
            <View style={styles.report}>
              <ReportPills compact status={block.status} onReport={onReport} />
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  timeCol: { width: 48, alignItems: 'flex-end', paddingTop: spacing.md },
  tabular: { fontVariant: ['tabular-nums'] },
  rail: { width: 12, alignItems: 'center', paddingTop: spacing.md + 5 },
  dot: { width: 12, height: 12, borderRadius: radius.pill, borderWidth: 2 },
  line: { flex: 1, width: 2, marginTop: spacing.xs, borderRadius: 1 },
  body: { flex: 1, paddingBottom: spacing.sm },
  card: {
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  note: { fontStyle: 'italic' },
  report: { marginTop: spacing.sm },
});
