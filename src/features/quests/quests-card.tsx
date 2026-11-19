import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Quest, QuestMilestone, QuestStatus } from '@/core/domain';
import { emberColor } from '@/core/ember';
import {
  MAX_ACTIVE_QUESTS,
  canStartQuest,
  questDaysLeft,
  questProgress,
} from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { QuestLimitError, setQuestMilestoneDone, setQuestStatus } from '@/db/repos';
import { dayMonth } from '@/features/ember/format';
import { notifyProgressChanged } from '@/features/progress';
import { Button } from '@/ui/button';
import { Ember } from '@/ui/ember';
import { Flare } from '@/ui/flare';
import { playHaptic } from '@/ui/haptics';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { QuestEditor } from './quest-editor';
import { useQuests } from './use-quests';

const DOT = 16;

type Editing = { quest: Quest | null } | null;

/**
 * Epski questovi na Profilu (korak 34): questovi u tijeku s etapama (dodir pali žar etape; bez XP-a od koraka 34c),
 * trakom napretka i rokom; ostvareni ispod; arhiva skrivena. Najviše `MAX_ACTIVE_QUESTS` u tijeku.
 */
export function QuestsCard({ today }: { today: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const state = useQuests();
  const [editing, setEditing] = useState<Editing>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [error, setError] = useState<'limit' | 'failed' | null>(null);

  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (state.status !== 'ready') {
    return (
      <View style={cardStyle}>
        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text tone="danger">{t('quests.loadError')}</Text>
        )}
      </View>
    );
  }

  const active = state.quests.filter((quest) => quest.status === 'active');
  const done = state.quests.filter((quest) => quest.status === 'done');
  const archived = state.quests.filter((quest) => quest.status === 'archived');
  const canStart = canStartQuest(state.quests);

  /** Izvrši promjenu questa; `true` ako je uspjela. */
  function run(action: () => void): boolean {
    setError(null);
    try {
      action();
      notifyProgressChanged();
      return true;
    } catch (failure: unknown) {
      if (failure instanceof QuestLimitError) {
        setError('limit');
        return false;
      }
      console.error('Updating quest failed', failure);
      setError('failed');
      return false;
    }
  }

  function toggleMilestone(quest: Quest, milestone: QuestMilestone) {
    const nowDone = milestone.doneOn === null;
    const ok = run(() => setQuestMilestoneDone(getDb(), LOCAL_USER_ID, quest.id, milestone.id, nowDone, today));
    if (ok) playHaptic(nowDone ? 'done' : 'skip');
    if (ok && nowDone) AccessibilityInfo.announceForAccessibility(t('quests.milestoneDoneA11y'));
  }

  function setStatus(quest: Quest, status: QuestStatus) {
    const ok = run(() => setQuestStatus(getDb(), LOCAL_USER_ID, quest.id, status, today));
    if (ok && status === 'done') playHaptic('achievement');
    if (ok && status === 'done') AccessibilityInfo.announceForAccessibility(t('quests.doneA11y'));
  }

  function confirmDone(quest: Quest) {
    Alert.alert(t('quests.confirmDoneTitle'), t('quests.confirmDoneMessage', { title: quest.title }), [
      { text: t('quests.editor.cancel'), style: 'cancel' },
      { text: t('quests.markDone'), onPress: () => setStatus(quest, 'done') },
    ]);
  }

  return (
    <View style={styles.list}>
      {active.length === 0 ? (
        <View style={cardStyle}>
          <Text variant="bodyStrong">{t('quests.emptyTitle')}</Text>
          <Text tone="textMuted">{t('quests.emptyBody')}</Text>
        </View>
      ) : (
        active.map((quest) => (
          <ActiveQuest
            key={quest.id}
            quest={quest}
            today={today}
            onToggle={(milestone) => toggleMilestone(quest, milestone)}
            onEdit={() => setEditing({ quest })}
            onDone={() => confirmDone(quest)}
          />
        ))
      )}

      {canStart ? (
        <Button variant="secondary" label={t('quests.new')} onPress={() => setEditing({ quest: null })} />
      ) : (
        <Text variant="caption" tone="textMuted">
          {t('quests.limitHint', { max: MAX_ACTIVE_QUESTS })}
        </Text>
      )}

      {error !== null ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t(error === 'limit' ? 'quests.limit' : 'quests.editor.failed')}
        </Text>
      ) : null}

      {done.length > 0 ? (
        <View style={cardStyle}>
          <Text variant="overline" tone="textMuted">
            {t('quests.doneHeading')}
          </Text>
          {done.map((quest) => (
            <ClosedQuest
              key={quest.id}
              quest={quest}
              actions={[
                { label: t('quests.archive'), onPress: () => setStatus(quest, 'archived') },
                { label: t('quests.reopen'), onPress: () => setStatus(quest, 'active') },
              ]}
            />
          ))}
        </View>
      ) : null}

      {archived.length > 0 ? (
        <View style={cardStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchive }}
            onPress={() => setShowArchive((open) => !open)}
            style={styles.archiveToggle}>
            <Text variant="bodyStrong">{t('quests.archiveHeading', { count: archived.length })}</Text>
            <Text tone="textMuted">{showArchive ? '▴' : '▾'}</Text>
          </Pressable>
          {showArchive
            ? archived.map((quest) => (
                <ClosedQuest
                  key={quest.id}
                  quest={quest}
                  actions={[{ label: t('quests.reopen'), onPress: () => setStatus(quest, 'active') }]}
                />
              ))
            : null}
        </View>
      ) : null}

      {editing !== null ? (
        <QuestEditor
          quest={editing.quest}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      ) : null}
    </View>
  );
}

function ActiveQuest({
  quest,
  today,
  onToggle,
  onEdit,
  onDone,
}: {
  quest: Quest;
  today: string;
  onToggle: (milestone: QuestMilestone) => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const progress = questProgress(quest);
  const daysLeft = questDaysLeft(quest, today);
  const progressText =
    progress.total > 0 ? t('quests.progress', { done: progress.done, total: progress.total }) : t('quests.noMilestones');
  const deadlineText =
    daysLeft === null || quest.targetDate === null
      ? null
      : daysLeft >= 0
        ? t('quests.daysLeft', { count: daysLeft, date: dayMonth(quest.targetDate, i18n.language) })
        : t('quests.pastDeadline', { date: dayMonth(quest.targetDate, i18n.language) });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="overline" tone="accent">
        {t('quests.overline')}
      </Text>
      <Text variant="heading" accessibilityRole="header">
        {quest.title}
      </Text>
      {quest.why.length > 0 ? <Text tone="textMuted">{quest.why}</Text> : null}
      <ProgressBar fraction={progress.fraction} accessibilityLabel={quest.title} valueText={progressText} height={6} />
      <View style={styles.meta}>
        <Text variant="caption" tone="textMuted" style={styles.tabular}>
          {progressText}
        </Text>
        {deadlineText !== null ? (
          <Text variant="caption" tone={daysLeft !== null && daysLeft < 0 ? 'accent' : 'textMuted'}>
            {deadlineText}
          </Text>
        ) : null}
      </View>

      {quest.milestones.length > 0 ? (
        <View style={styles.milestones}>
          {quest.milestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone} onPress={() => onToggle(milestone)} />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button variant="ghost" label={t('quests.edit')} onPress={onEdit} style={styles.action} />
        <Button variant="secondary" label={t('quests.markDone')} onPress={onDone} style={styles.action} />
      </View>
    </View>
  );
}

function MilestoneRow({ milestone, onPress }: { milestone: QuestMilestone; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const { scheme, flame, colors } = useAppTheme();
  const done = milestone.doneOn !== null;
  // Bljesne samo kad se etapa upali dok je ekran otvoren (ne pri prvom crtanju).
  const [seen, setSeen] = useState({ done, flare: 0 });
  if (seen.done !== done) setSeen({ done, flare: done ? seen.flare + 1 : 0 });
  const glow = emberColor('bright', scheme, flame).fill ?? colors.accent;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={milestone.title}
      accessibilityHint={done ? t('quests.milestoneUndoHint') : t('quests.milestoneHint')}
      onPress={onPress}
      style={styles.milestone}>
      <Flare trigger={seen.flare} size={DOT} color={glow}>
        <Ember level={done ? 'bright' : 'unlit'} size={DOT} glow={done} />
      </Flare>
      <View style={styles.flex}>
        <Text tone={done ? 'textMuted' : 'text'} style={done ? styles.doneText : null}>
          {milestone.title}
        </Text>
        {milestone.doneOn !== null ? (
          <Text variant="caption" tone="textMuted">
            {t('quests.milestoneDoneOn', { date: dayMonth(milestone.doneOn, i18n.language) })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ClosedQuest({ quest, actions }: { quest: Quest; actions: { label: string; onPress: () => void }[] }) {
  const { t, i18n } = useTranslation();
  const progress = questProgress(quest);
  return (
    <View style={styles.closed}>
      <View style={styles.closedHead}>
        <Ember level={quest.doneOn !== null ? 'bright' : 'faint'} size={12} glow={false} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{quest.title}</Text>
          <Text variant="caption" tone="textMuted">
            {quest.doneOn !== null
              ? t('quests.doneOn', { date: dayMonth(quest.doneOn, i18n.language) })
              : t('quests.progress', { done: progress.done, total: progress.total })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Button key={action.label} variant="ghost" label={action.label} onPress={action.onPress} style={styles.action} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  milestones: { gap: spacing.xxs, marginTop: spacing.xs },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingVertical: spacing.xs },
  doneText: { textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  action: { minHeight: 44 },
  archiveToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  closed: { gap: spacing.xs, paddingVertical: spacing.xs },
  closedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
