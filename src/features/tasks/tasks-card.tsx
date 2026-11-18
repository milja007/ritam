import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MAX_TASKS_PER_WEEK, type ScheduleBlock, type Task } from '@/core/domain';
import type { EmberLevel } from '@/core/ember';
import { placementDays, placeWeekTasks, taskProgress, type WeekTaskPlan } from '@/core/plans';
import { radius, spacing } from '@/core/theme';
import { useSettings } from '@/features/settings';
import { Button } from '@/ui/button';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { taskSummary } from './format';
import { TaskEditor } from './task-editor';
import { TaskProposal } from './task-proposal';
import { useTasks } from './use-tasks';

const DOT = 12;

type TasksCardProps = {
  /** Ponedjeljak prikazanog tjedna. */
  weekStart: string;
  /** Dani tjedna (pon–ned). */
  dates: readonly string[];
  today: string;
  nowMinutes: number;
  /** Blokovi prikazanog tjedna (za napredak i slobodno vrijeme). */
  blocks: readonly ScheduleBlock[];
  /** Blokovi su dodani — Tjedan neka ponovo učita. */
  onBlocksChanged: () => void;
};

/**
 * Tjedni zadaci (korak 25): popis s napretkom (žar po svakom putu: odrađen svijetli, u planu je
 * prigušen, nesmješten ugašen), dodavanje uz pitanja i „Predloži termine“ — lokalno smještanje
 * (pravila iz odgovora su tvrda) koje korisnik odobrava. Prošli tjedan je samo za čitanje.
 */
export function TasksCard({ weekStart, dates, today, nowMinutes, blocks, onBlocksChanged }: TasksCardProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const state = useTasks(weekStart);
  const settings = useSettings();
  // `undefined` = zatvoreno, `null` = novi zadatak.
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const [proposal, setProposal] = useState<WeekTaskPlan | null>(null);
  const weekEnd = dates[dates.length - 1] ?? weekStart;
  const past = weekEnd < today;
  const future = weekStart > today;
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (state.status !== 'ready') {
    return (
      <View style={cardStyle}>
        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text tone="danger">{t('tasks.loadError')}</Text>
        )}
      </View>
    );
  }

  const tasks = state.tasks;
  const missing = tasks.some((task) => taskProgress(task, blocks).placed < task.timesPerWeek);

  function propose() {
    if (settings.settings === null) return;
    setProposal(placeWeekTasks(tasks, placementDays(dates, today, nowMinutes, settings.settings, blocks)));
  }

  return (
    <View style={cardStyle}>
      <Text variant="overline" tone="textMuted" accessibilityRole="header">
        {t('tasks.heading')}
      </Text>

      {tasks.length === 0 ? (
        <Text tone="textMuted">{t(past ? 'tasks.emptyPast' : future ? 'tasks.introNext' : 'tasks.intro')}</Text>
      ) : (
        <View style={styles.rows}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              summary={taskSummary(t, task, i18n.language)}
              blocks={blocks}
              onPress={past ? undefined : () => setEditing(task)}
            />
          ))}
        </View>
      )}

      {past ? null : (
        <View style={styles.actions}>
          {tasks.length < MAX_TASKS_PER_WEEK ? (
            <Button variant="secondary" label={t('tasks.add')} onPress={() => setEditing(null)} />
          ) : (
            <Text variant="caption" tone="textMuted">
              {t('tasks.limitHint', { max: MAX_TASKS_PER_WEEK })}
            </Text>
          )}
          {tasks.length > 0 && missing ? (
            <>
              <Button
                label={t('tasks.place')}
                onPress={propose}
                disabled={settings.settings === null}
                accessibilityHint={t('tasks.placeHint')}
              />
              <Text variant="caption" tone="textMuted">
                {t('tasks.placeHint')}
              </Text>
            </>
          ) : tasks.length > 0 ? (
            <Text variant="caption" tone="textMuted">
              {t('tasks.allPlaced')}
            </Text>
          ) : null}
        </View>
      )}

      {editing !== undefined ? (
        <TaskEditor
          task={editing}
          weekStart={weekStart}
          dates={dates}
          today={today}
          onSaved={() => {
            setEditing(undefined);
            state.reload();
          }}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {proposal !== null ? (
        <TaskProposal
          plan={proposal}
          onAccepted={() => {
            setProposal(null);
            onBlocksChanged();
          }}
          onClose={() => setProposal(null)}
        />
      ) : null}
    </View>
  );
}

function TaskRow({
  task,
  summary,
  blocks,
  onPress,
}: {
  task: Task;
  summary: string;
  blocks: readonly ScheduleBlock[];
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const progress = taskProgress(task, blocks);
  const progressText = t('tasks.progress', { done: progress.done, target: progress.target });
  // Jedan žar po putu: odrađeni svijetle, smješteni (još neodrađeni) tinjaju, ostali su ugašeni.
  const dots = Array.from({ length: Math.max(progress.target, progress.placed) }, (_, index) =>
    index < progress.done ? 'bright' : index < progress.placed ? 'faint' : 'unlit',
  ) as EmberLevel[];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${task.title}. ${summary}. ${t('tasks.progressA11y', { ...progress })}`}
      accessibilityHint={onPress ? t('tasks.editHint') : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <View style={styles.rowHead}>
        <Text variant="bodyStrong" style={styles.flex}>
          {task.title}
        </Text>
        <Text variant="caption" tone="textMuted" style={styles.tabular}>
          {progressText}
        </Text>
      </View>
      <View style={styles.dots}>
        {dots.map((level, index) => (
          <Ember key={index} level={level} size={DOT} glow={level === 'bright'} />
        ))}
      </View>
      <Text variant="caption" tone="textMuted">
        {summary}
      </Text>
      {task.needs.length > 0 ? (
        <Text variant="caption" tone="textMuted">
          {task.needs}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  rows: { gap: spacing.xs },
  row: { gap: spacing.xxs, minHeight: 44, paddingVertical: spacing.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dots: { flexDirection: 'row', gap: spacing.xs },
  pressed: { opacity: 0.7 },
  actions: { gap: spacing.sm },
});
