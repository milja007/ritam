import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WeekTaskPlan } from '@/core/plans';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { createBlocks } from '@/db/repos';
import { dayLong } from '@/features/ember/format';
import { notifyBlocksChanged, syncNotificationsNow } from '@/features/notifications';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

type TaskProposalProps = {
  plan: WeekTaskPlan;
  onAccepted: () => void;
  onClose: () => void;
};

/**
 * Prijedlog termina tjednih zadataka (korak 25). Ništa se ne sprema dok korisnik ne potvrdi;
 * potvrda dodaje blokove vrste Zadatak s `task_id` u plan tih dana (s podsjetnicima kao i ostali).
 */
export function TaskProposal({ plan, onAccepted, onClose }: TaskProposalProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [error, setError] = useState(false);
  const count = plan.placements.length;
  const days = [...new Set(plan.placements.map((placement) => placement.date))];
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  function accept() {
    setError(false);
    try {
      createBlocks(
        getDb(),
        LOCAL_USER_ID,
        plan.placements.map((placement) => ({
          date: placement.date,
          title: placement.title,
          start: placement.start,
          end: placement.end,
          taskId: placement.taskId,
          kind: 'task' as const,
          source: 'user' as const,
          status: 'planned' as const,
        })),
      );
      void syncNotificationsNow();
      notifyBlocksChanged();
      AccessibilityInfo.announceForAccessibility(t('tasks.proposal.added', { count }));
      onAccepted();
    } catch (failure: unknown) {
      console.error('Adding task blocks failed', failure);
      setError(true);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="overline" tone="accent">
              {t('tasks.proposal.overline')}
            </Text>
            <Text variant="title" accessibilityRole="header">
              {t('tasks.proposal.title')}
            </Text>
            <Text tone="textMuted">{t('tasks.proposal.body')}</Text>

            {count === 0 && plan.unplaced.length === 0 ? <Text>{t('tasks.proposal.nothing')}</Text> : null}

            {days.map((date) => (
              <View key={date} style={card}>
                <Text variant="bodyStrong" accessibilityRole="header">
                  {dayLong(date, i18n.language)}
                </Text>
                {plan.placements
                  .filter((placement) => placement.date === date)
                  .map((placement) => (
                    <View
                      key={`${placement.taskId}|${placement.start}`}
                      style={styles.row}
                      accessible
                      accessibilityLabel={`${placement.start}–${placement.end}, ${placement.title}`}>
                      <Text tone="textMuted" style={styles.time}>
                        {placement.start}–{placement.end}
                      </Text>
                      <Text style={styles.flex}>{placement.title}</Text>
                    </View>
                  ))}
              </View>
            ))}

            {plan.unplaced.length > 0 ? (
              <View style={card}>
                <Text variant="bodyStrong" accessibilityRole="header">
                  {t('tasks.proposal.unplacedHeading')}
                </Text>
                {plan.unplaced.map((item) => (
                  <Text key={item.taskId} tone="textMuted">
                    {t(item.reason === 'no-days' ? 'tasks.proposal.noDays' : 'tasks.proposal.noTime', {
                      title: item.title,
                      count: item.missing,
                    })}
                  </Text>
                ))}
                <Text variant="caption" tone="textMuted">
                  {t('tasks.proposal.unplacedHint')}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {error ? (
              <Text tone="danger" accessibilityLiveRegion="polite">
                {t('tasks.proposal.failed')}
              </Text>
            ) : null}
            {count > 0 ? <Button label={t('tasks.proposal.accept', { count })} onPress={accept} /> : null}
            <Button variant="secondary" label={t('tasks.proposal.back')} onPress={onClose} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'baseline' },
  time: { fontVariant: ['tabular-nums'], minWidth: 96 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
