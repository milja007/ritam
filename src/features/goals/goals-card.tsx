import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { MAX_GOALS_PER_PERIOD, type Goal, type GoalPeriod } from '@/core/domain';
import { emberColor } from '@/core/ember';
import { goalProgress } from '@/core/plans';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { GoalLimitError, createGoal, deleteGoal, setGoalDone } from '@/db/repos';
import { Button } from '@/ui/button';
import { Ember } from '@/ui/ember';
import { Flare } from '@/ui/flare';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { useGoals } from './use-goals';

const DOT = 16;

type GoalsCardProps = {
  period: GoalPeriod;
  /** Prvi dan prikazanog razdoblja. */
  periodStart: string;
  /** Zadnji dan prikazanog razdoblja — razdoblje koje je prošlo je samo za čitanje. */
  periodEnd: string;
  today: string;
};

/**
 * Ciljevi razdoblja (korak 25: tjedan; 25b koristi isto za mjesec i godinu): kratki popis s
 * žarom koji se upali kad je cilj ostvaren. Najviše `MAX_GOALS_PER_PERIOD`; ne mora se sve
 * ispuniti. Prošlo razdoblje je samo za čitanje; buduće se može puniti, ali ne i označavati.
 */
export function GoalsCard({ period, periodStart, periodEnd, today }: GoalsCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const state = useGoals(period, periodStart);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<'limit' | 'failed' | null>(null);
  const past = periodEnd < today;
  const started = periodStart <= today;
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const k = <K extends 'heading' | 'empty' | 'emptyPast' | 'placeholder'>(key: K) => `goals.${period}.${key}` as const;

  /** Izvrši promjenu; `true` ako je uspjela. */
  function run(action: () => void): boolean {
    setError(null);
    try {
      action();
      state.reload();
      return true;
    } catch (failure: unknown) {
      if (failure instanceof GoalLimitError) {
        setError('limit');
        return false;
      }
      console.error('Updating goal failed', failure);
      setError('failed');
      return false;
    }
  }

  function add() {
    const title = typed.trim();
    if (title.length === 0) return;
    if (run(() => createGoal(getDb(), LOCAL_USER_ID, { period, periodStart, title }))) {
      setTyped('');
      AccessibilityInfo.announceForAccessibility(t('goals.addedA11y', { title }));
    }
  }

  function toggle(goal: Goal) {
    const nowDone = goal.doneOn === null;
    if (run(() => setGoalDone(getDb(), LOCAL_USER_ID, goal.id, nowDone ? today : null)) && nowDone) {
      AccessibilityInfo.announceForAccessibility(t('goals.doneA11y', { title: goal.title }));
    }
  }

  function confirmRemove(goal: Goal) {
    Alert.alert(t('goals.removeTitle'), t('goals.removeMessage', { title: goal.title }), [
      { text: t('goals.cancel'), style: 'cancel' },
      { text: t('goals.remove'), style: 'destructive', onPress: () => void run(() => deleteGoal(getDb(), LOCAL_USER_ID, goal.id)) },
    ]);
  }

  if (state.status !== 'ready') {
    return (
      <View style={cardStyle}>
        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text tone="danger">{t('goals.loadError')}</Text>
        )}
      </View>
    );
  }

  const goals = state.goals;
  const progress = goalProgress(goals);
  const canAdd = !past && goals.length < MAX_GOALS_PER_PERIOD;

  return (
    <View style={cardStyle}>
      <View style={styles.head}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header" style={styles.flex}>
          {t(k('heading'))}
        </Text>
        {goals.length > 0 ? (
          <Text variant="caption" tone="textMuted" style={styles.tabular}>
            {t('goals.progress', { done: progress.done, total: progress.total })}
          </Text>
        ) : null}
      </View>

      {goals.length > 0 ? (
        <ProgressBar
          fraction={progress.done / progress.total}
          accessibilityLabel={t(k('heading'))}
          valueText={t('goals.progress', { done: progress.done, total: progress.total })}
          height={6}
        />
      ) : (
        <Text tone="textMuted">{t(past ? k('emptyPast') : k('empty'))}</Text>
      )}

      {goals.length > 0 ? (
        <View style={styles.rows}>
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              canToggle={started && !past}
              onToggle={() => toggle(goal)}
              onRemove={past ? undefined : () => confirmRemove(goal)}
            />
          ))}
        </View>
      ) : null}

      {canAdd ? (
        <View style={styles.addRow}>
          <TextField
            label={t('goals.addLabel')}
            placeholder={t(k('placeholder'))}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={add}
            returnKeyType="done"
            maxLength={120}
            style={styles.flex}
          />
          <Button variant="secondary" label={t('goals.add')} onPress={add} disabled={typed.trim().length === 0} />
        </View>
      ) : !past ? (
        <Text variant="caption" tone="textMuted">
          {t('goals.limitHint', { max: MAX_GOALS_PER_PERIOD })}
        </Text>
      ) : null}

      {error !== null ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t(error === 'limit' ? 'goals.limit' : 'goals.failed', { max: MAX_GOALS_PER_PERIOD })}
        </Text>
      ) : null}
    </View>
  );
}

function GoalRow({
  goal,
  canToggle,
  onToggle,
  onRemove,
}: {
  goal: Goal;
  canToggle: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const { scheme, flame, colors } = useAppTheme();
  const done = goal.doneOn !== null;
  // Bljesne samo kad se cilj upali dok je ekran otvoren (ne pri prvom crtanju).
  const [seen, setSeen] = useState({ done, flare: 0 });
  if (seen.done !== done) setSeen({ done, flare: done ? seen.flare + 1 : 0 });
  const glow = emberColor('bright', scheme, flame).fill ?? colors.accent;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !canToggle }}
        accessibilityLabel={goal.title}
        accessibilityHint={canToggle ? t(done ? 'goals.undoHint' : 'goals.doneHint') : undefined}
        disabled={!canToggle}
        onPress={onToggle}
        style={styles.toggle}>
        <Flare trigger={seen.flare} size={DOT} color={glow}>
          <Ember level={done ? 'bright' : 'unlit'} size={DOT} glow={done} />
        </Flare>
        <Text tone={done ? 'textMuted' : 'text'} style={[styles.flex, done ? styles.doneText : null]}>
          {goal.title}
        </Text>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('goals.removeLabel', { title: goal.title })}
          onPress={onRemove}
          hitSlop={8}
          style={styles.remove}>
          <Text tone="textMuted">×</Text>
        </Pressable>
      ) : null}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  rows: { gap: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingVertical: spacing.xs },
  doneText: { textDecorationLine: 'line-through' },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
});
