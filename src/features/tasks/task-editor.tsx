import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MAX_TASKS_PER_WEEK,
  TASK_ENERGIES,
  TASK_MAX_TIMES,
  TASK_NEEDS_MAX,
  TASK_PARTS_OF_DAY,
  type Task,
  type TaskEnergy,
  type TaskPartOfDay,
} from '@/core/domain';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { TaskLimitError, createTask, deleteTask, updateTask } from '@/db/repos';
import { weekdayName } from '@/features/ember/format';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { durationText } from './format';

const TITLE_MAX = 120;
const DURATIONS = [15, 30, 45, 60, 90, 120, 180] as const;
const NO_DEADLINE = 'none';

type TaskEditorProps = {
  /** `null` = novi zadatak. */
  task: Task | null;
  weekStart: string;
  /** Dani tjedna (pon–ned). */
  dates: readonly string[];
  today: string;
  onSaved: () => void;
  onClose: () => void;
};

type Choice<T> = { value: T; label: string };

/**
 * Pitanja kod unosa tjednog zadatka (koncept: trajanje, rok, koliko puta, doba dana, što treba,
 * energija). Sve osim naslova i „što treba“ su dodiri — bez tipkanja. Odgovori su tvrda pravila
 * smještanja.
 */
export function TaskEditor({ task, weekStart, dates, today, onSaved, onClose }: TaskEditorProps) {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState(task?.title ?? '');
  const [duration, setDuration] = useState(task?.durationMinutes ?? 60);
  const [times, setTimes] = useState(task?.timesPerWeek ?? 1);
  const [deadline, setDeadline] = useState<string>(task?.deadline ?? NO_DEADLINE);
  const [part, setPart] = useState<TaskPartOfDay>(task?.partOfDay ?? 'any');
  const [energy, setEnergy] = useState<TaskEnergy>(task?.energy ?? 'medium');
  const [needs, setNeeds] = useState(task?.needs ?? '');
  const [error, setError] = useState<'limit' | 'failed' | null>(null);
  const language = i18n.language;

  const durations = [...new Set<number>([...DURATIONS, duration])].sort((a, b) => a - b);
  // Rok: dani od danas (ili od početka budućeg tjedna) do nedjelje; spremljeni rok ostaje izbor.
  const deadlineDates = dates.filter((date) => date >= today || date === task?.deadline);
  const canSave = title.trim().length > 0;

  function save() {
    if (!canSave) return;
    const answers = {
      title: title.trim(),
      durationMinutes: duration,
      timesPerWeek: times,
      deadline: deadline === NO_DEADLINE ? null : deadline,
      partOfDay: part,
      energy,
      needs: needs.trim(),
    };
    setError(null);
    try {
      if (task) updateTask(getDb(), LOCAL_USER_ID, task.id, answers);
      else createTask(getDb(), LOCAL_USER_ID, { ...answers, weekStart });
      onSaved();
    } catch (failure: unknown) {
      if (failure instanceof TaskLimitError) {
        setError('limit');
        return;
      }
      console.error('Saving task failed', failure);
      setError('failed');
    }
  }

  function confirmDelete() {
    if (!task) return;
    Alert.alert(t('tasks.editor.deleteTitle'), t('tasks.editor.deleteMessage', { title: task.title }), [
      { text: t('tasks.editor.cancel'), style: 'cancel' },
      {
        text: t('tasks.editor.delete'),
        style: 'destructive',
        onPress: () => {
          try {
            deleteTask(getDb(), LOCAL_USER_ID, task.id);
            onSaved();
          } catch (failure: unknown) {
            console.error('Deleting task failed', failure);
            setError('failed');
          }
        },
      },
    ]);
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="overline" tone="accent">
                {t('tasks.editor.overline')}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {task ? t('tasks.editor.editTitle') : t('tasks.editor.newTitle')}
              </Text>
              <Text tone="textMuted">{t('tasks.editor.body')}</Text>

              <TextField
                label={t('tasks.editor.titleLabel')}
                placeholder={t('tasks.editor.titlePlaceholder')}
                value={title}
                onChangeText={setTitle}
                maxLength={TITLE_MAX}
                autoFocus={!task}
                returnKeyType="done"
              />

              <Question label={t('tasks.editor.durationLabel')}>
                <Chips
                  label={t('tasks.editor.durationLabel')}
                  choices={durations.map((value) => ({ value, label: durationText(t, value) }))}
                  selected={duration}
                  onSelect={setDuration}
                />
              </Question>

              <Question label={t('tasks.editor.timesLabel')}>
                <Chips
                  label={t('tasks.editor.timesLabel')}
                  choices={Array.from({ length: TASK_MAX_TIMES }, (_, index) => ({
                    value: index + 1,
                    label: `${index + 1}×`,
                  }))}
                  selected={times}
                  onSelect={setTimes}
                />
              </Question>

              <Question label={t('tasks.editor.deadlineLabel')}>
                <Chips
                  label={t('tasks.editor.deadlineLabel')}
                  choices={[
                    { value: NO_DEADLINE, label: t('tasks.editor.noDeadline') },
                    ...deadlineDates.map((date) => ({ value: date, label: weekdayName(date, language) })),
                  ]}
                  selected={deadline}
                  onSelect={setDeadline}
                />
              </Question>

              <Question label={t('tasks.editor.partLabel')}>
                <Chips
                  label={t('tasks.editor.partLabel')}
                  choices={TASK_PARTS_OF_DAY.map((value) => ({ value, label: t(`tasks.editor.part.${value}`) }))}
                  selected={part}
                  onSelect={setPart}
                />
              </Question>

              <Question label={t('tasks.editor.energyLabel')} hint={t('tasks.editor.energyHint')}>
                <Chips
                  label={t('tasks.editor.energyLabel')}
                  choices={TASK_ENERGIES.map((value) => ({ value, label: t(`tasks.editor.energy.${value}`) }))}
                  selected={energy}
                  onSelect={setEnergy}
                />
              </Question>

              <TextField
                label={t('tasks.editor.needsLabel')}
                placeholder={t('tasks.editor.needsPlaceholder')}
                value={needs}
                onChangeText={setNeeds}
                maxLength={TASK_NEEDS_MAX}
                returnKeyType="done"
              />

              {task ? <Button variant="ghost" label={t('tasks.editor.delete')} onPress={confirmDelete} /> : null}
            </ScrollView>

            <View style={styles.footer}>
              {error !== null ? (
                <Text tone="danger" accessibilityLiveRegion="polite">
                  {error === 'limit' ? t('tasks.limit', { max: MAX_TASKS_PER_WEEK }) : t('tasks.editor.failed')}
                </Text>
              ) : null}
              <Button label={t('tasks.editor.save')} onPress={save} disabled={!canSave} />
              <Button variant="secondary" label={t('tasks.editor.cancel')} onPress={onClose} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}

function Question({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <Text variant="bodyStrong">{label}</Text>
      {hint ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Odabir jedne opcije kao niz čipova koji se lome u redove (radio grupa, 44 pt). */
function Chips<T extends string | number>({
  label,
  choices,
  selected,
  onSelect,
}: {
  label: string;
  choices: readonly Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
      {choices.map((choice) => {
        const on = choice.value === selected;
        return (
          <Pressable
            key={String(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={choice.label}
            onPress={() => onSelect(choice.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? colors.accent : colors.surface,
                borderColor: on ? colors.accent : colors.border,
              },
              pressed ? styles.pressed : null,
            ]}>
            <Text variant={on ? 'bodyStrong' : 'body'} tone={on ? 'onAccent' : 'text'}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  question: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
