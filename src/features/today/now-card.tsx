import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { ScheduleBlock } from '@/core/domain';
import { formatClockSeconds, formatCountdown, type DaySchedule } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

type NowCardProps = {
  view: DaySchedule<ScheduleBlock>;
  nowSeconds: number;
  onDone: (block: ScheduleBlock) => void;
  onOpen: (block: ScheduleBlock) => void;
};

/**
 * "Trenutno: …" na vrhu Danas (17c): živi sat u sekundama, aktivnost koja traje,
 * odbrojavanje do kraja s trakom, i sljedeća aktivnost s odbrojavanjem do početka.
 */
export function NowCard({ view, nowSeconds, onDone, onOpen }: NowCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { current, next, secondsLeft, secondsUntilNext, progress } = view;
  const clock = formatClockSeconds(nowSeconds);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: current ? colors.accent : colors.border }]}
      accessibilityLabel={t('today.nowCard.label')}>
      <View style={styles.topRow}>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: current ? colors.accent : colors.textMuted }]} />
          <Text variant="overline" tone={current ? 'accent' : 'textMuted'}>
            {t('today.nowCard.current')}
          </Text>
        </View>
        <Text
          variant="bodyStrong"
          tone="textMuted"
          style={styles.tabular}
          accessibilityLabel={t('today.nowCard.clockLabel', { time: clock.slice(0, 5) })}>
          {clock}
        </Text>
      </View>

      {current ? (
        <>
          <View style={styles.titleBlock}>
            <Text variant="title" numberOfLines={2} accessibilityRole="header">
              {current.title}
            </Text>
            <Text variant="caption" tone="textMuted" style={styles.tabular}>
              {t('today.timeRange', { start: current.start, end: current.end })}
            </Text>
          </View>

          <View style={styles.countdownRow}>
            <Text
              variant="display"
              tone="accent"
              style={[styles.countdown, styles.tabular]}
              accessibilityLabel={t('today.nowCard.leftLabel', {
                minutes: Math.ceil((secondsLeft ?? 0) / 60),
              })}>
              {formatCountdown(secondsLeft ?? 0)}
            </Text>
            <Text tone="textMuted">{t('today.nowCard.untilEnd')}</Text>
          </View>
          <ProgressBar
            fraction={progress ?? 0}
            height={6}
            accessibilityLabel={t('today.nowCard.progressLabel', { title: current.title })}
            valueText={t('today.nowCard.progressValue', { percent: Math.round((progress ?? 0) * 100) })}
          />

          {current.note ? (
            <Text variant="caption" tone="textMuted" numberOfLines={2}>
              {t('today.note.preview', { note: current.note })}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={current.status === 'done' ? t('today.nowCard.doneAlready') : t('today.nowCard.done')}
              variant={current.status === 'done' ? 'secondary' : 'primary'}
              onPress={() => onDone(current)}
              style={styles.action}
            />
            <Button
              label={t('today.nowCard.more')}
              variant="secondary"
              accessibilityHint={t('today.nowCard.moreHint')}
              onPress={() => onOpen(current)}
              style={styles.action}
            />
          </View>
        </>
      ) : (
        <View style={styles.titleBlock}>
          <Text variant="title" accessibilityRole="header">
            {next ? t('today.nowCard.free') : t('today.nowCard.allDone')}
          </Text>
          <Text tone="textMuted">{next ? t('today.nowCard.freeBody') : t('today.nowCard.allDoneBody')}</Text>
        </View>
      )}

      {next ? (
        <View style={[styles.next, { borderTopColor: colors.border }]}>
          <View style={styles.nextText}>
            <Text variant="overline" tone="textMuted">
              {t('today.nowCard.next')}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {next.title}
            </Text>
            <Text variant="caption" tone="textMuted" style={styles.tabular}>
              {t('today.timeRange', { start: next.start, end: next.end })}
            </Text>
          </View>
          <View style={styles.nextCountdown}>
            <Text variant="caption" tone="textMuted">
              {t('today.nowCard.startsIn')}
            </Text>
            <Text variant={current ? 'heading' : 'display'} tone={current ? 'text' : 'accent'} style={styles.tabular}>
              {formatCountdown(secondsUntilNext ?? 0)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: radius.pill },
  tabular: { fontVariant: ['tabular-nums'] },
  titleBlock: { gap: spacing.xs },
  countdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  countdown: { fontSize: 48, lineHeight: 54 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  next: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextText: { flex: 1, gap: spacing.xxs },
  nextCountdown: { alignItems: 'flex-end' },
});
