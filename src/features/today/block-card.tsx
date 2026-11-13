import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BlockStatus, ScheduleBlock } from '@/core/domain';
import { railLine, railState } from '@/core/ember';
import { blockActions, isCancelled, type BlockPhase } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Orb, RailDot, RailLineView } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { ReportPills } from './report-pills';

type BlockCardProps = {
  block: ScheduleBlock;
  phase: BlockPhase;
  /** Prvi redak trake (bez linije prema gore). */
  first?: boolean;
  /** Zadnji redak trake (bez linije prema dolje). */
  last?: boolean;
  onPress: () => void;
  /** Prijava prošle aktivnosti izravno na rasporedu. */
  onReport: (status: BlockStatus) => void;
};

/**
 * Redak trake dana (17c, smjer „Žar“): vrijeme lijevo, točka i linija vremena, naziv i tip.
 * Iza plamena linija je izgorjela, a odrađeno svijetli; ispred njega plan je tek ocrtan.
 * Neodrađeno i otkazano su ugašen žar (bez crvene); prošle se prijavljuju izravno na traci.
 */
export function BlockCard({ block, phase, first = false, last = false, onPress, onReport }: BlockCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const cancelled = isCancelled(block) && phase !== 'past';
  const reportable = blockActions(block, phase).report.length > 1;
  const settled = block.status !== 'planned';
  const dimmed = cancelled || (phase === 'past' && settled) || block.kind === 'sleep';
  const time = t('today.timeRange', { start: block.start, end: block.end });
  const state = railState(block, phase);
  const line = railLine(phase);
  // Riješena prošla aktivnost je sažeta u jedan redak bez kartice.
  const compact = phase === 'past' && settled;

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
        <View style={styles.railTop}>{first ? null : <RailLineView kind={line} />}</View>
        {state === 'now' ? <Orb size={14} /> : <RailDot state={state} />}
        {last ? <View style={styles.railEnd} /> : <RailLineView kind={line} />}
      </View>

      <View style={[styles.body, { opacity: dimmed ? 0.65 : 1 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('today.editBlockLabel', { title: block.title, time })}
          accessibilityHint={t('today.blockHint')}
          onPress={onPress}
          style={({ pressed }) => [
            compact
              ? styles.compact
              : [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }],
            { opacity: pressed ? 0.75 : 1 },
          ]}>
          <View style={styles.titleRow}>
            <Text
              variant={compact ? 'body' : 'bodyStrong'}
              tone={compact ? 'textMuted' : 'text'}
              numberOfLines={compact ? 1 : 2}
              style={[styles.title, cancelled ? styles.struck : null]}>
              {block.title}
            </Text>
            {cancelled ? (
              <Text variant="caption" tone="textMuted">
                {t('today.status.cancelled')}
              </Text>
            ) : null}
          </View>
          {compact ? null : (
            <Text variant="caption" tone="textMuted">
              {t(`today.kind.${block.kind}`)}
            </Text>
          )}
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

export const TIME_WIDTH = 48;
/** Širina trake vremena; ista za redak „Sada“ s orbom. */
export const RAIL_WIDTH = 26;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  timeCol: { width: TIME_WIDTH, alignItems: 'flex-end', paddingTop: spacing.md },
  tabular: { fontVariant: ['tabular-nums'] },
  rail: { width: RAIL_WIDTH, alignItems: 'center' },
  railTop: { height: spacing.md + 5, alignItems: 'center' },
  railEnd: { flex: 1 },
  body: { flex: 1, paddingBottom: spacing.sm },
  compact: { minHeight: 44, justifyContent: 'center', paddingVertical: spacing.xs },
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
