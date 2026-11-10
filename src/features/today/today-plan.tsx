import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScheduleBlock } from '@/core/domain';
import {
  ideaDraft,
  isTodayPlanValid,
  occupiedSlots,
  rankIdeas,
  startsInPast,
  todayPlanStart,
  typedTodayDraft,
  type BlockDraft,
  type PlanIdea,
} from '@/core/schedule';
import { formatClock } from '@/core/time/clock';
import { spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { BlockEditor } from './block-editor';
import { formatDay } from './format-day';
import { Chip, DraftRow, ExistingRow } from './plan-parts';
import { useTodayPlan } from './use-today-plan';

type TodayPlanProps = {
  /** Današnji dan ("YYYY-MM-DD"). */
  date: string;
  /** Trenutna minuta u danu (osvježava se dok je ekran otvoren). */
  nowMinutes: number;
  /** Blokovi koji su danas već u planu (npr. san, premješteni) — termini se slažu oko njih. */
  existing: readonly ScheduleBlock[];
  /** Pozove se nakon spremanja (osvježi timeline). */
  onSaved: () => void;
  onClose: () => void;
};

type Item = { key: number; draft: BlockDraft };

/**
 * Plan za danas (korak 17b): od sada prema naprijed. Glavni unos je tipkanje (što + od–do ili
 * trajanje, opcionalno doba dana); ispod su zapamćene ideje (ono što si već upisivao) i samo
 * jedan redak s primjerima kako se piše. Pregled s uređivanjem; Potvrdi sprema sve odjednom.
 */
export function TodayPlan({ date, nowMinutes, existing, onSaved, onClose }: TodayPlanProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const visibleExisting = existing.filter((block) => block.kind !== 'sleep');
  const plan = useTodayPlan(
    date,
    visibleExisting.map((block) => block.title),
  );
  const [items, setItems] = useState<Item[]>([]);
  const nextKey = useRef(1);
  const [typed, setTyped] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [noRoom, setNoRoom] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const drafts = items.map((item) => item.draft);
  const occupied = occupiedSlots(existing, drafts);
  const addedTitles = drafts.map((draft) => draft.title);
  const own = rankIdeas(plan.own, nowMinutes, addedTitles);
  const startLabel = formatClock(Math.min(todayPlanStart(nowMinutes), 23 * 60 + 59)) ?? '';

  function add(draft: BlockDraft | null) {
    setNoRoom(draft === null);
    if (draft === null) return false;
    const key = nextKey.current++;
    setItems((current) => [...current, { key, draft }]);
    return true;
  }

  function addIdea(idea: PlanIdea) {
    add(ideaDraft(idea, occupied, nowMinutes));
  }

  function addTyped() {
    if (typed.trim().length === 0) return;
    if (add(typedTodayDraft(typed, occupied, nowMinutes))) setTyped('');
  }

  function replace(key: number, draft: BlockDraft) {
    setItems((current) => current.map((item) => (item.key === key ? { key, draft } : item)));
  }

  function remove(key: number) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function confirm() {
    setSaving(true);
    setSaveError(false);
    try {
      setSavedCount(plan.confirm(drafts));
      onSaved();
    } catch (error: unknown) {
      console.error('Saving today plan failed', error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const sortedItems = [...items].sort((a, b) => a.draft.start.localeCompare(b.draft.start) || a.key - b.key);
  const hasPast = drafts.some((draft) => startsInPast(draft, nowMinutes));

  function ideaChip(idea: PlanIdea) {
    return (
      <Chip
        key={idea.key}
        label={t('todayPlan.ideaLabel', {
          title: idea.title,
          minutes: idea.minutes,
          part: t(`todayPlan.part.${idea.bestPart}`),
        })}
        hint={t('todayPlan.ideaHint')}
        onPress={() => addIdea(idea)}
      />
    );
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {savedCount !== null ? (
              <View style={styles.done}>
                <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
                  {t('todayPlan.doneTitle')}
                </Text>
                <Text tone="textMuted">{t('todayPlan.doneBody', { count: savedCount })}</Text>
                <Button label={t('todayPlan.close')} onPress={onClose} style={styles.primary} />
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                  <View style={styles.topRow}>
                    <Text variant="overline" tone="textMuted">
                      {t('todayPlan.overline', { day: formatDay(date, i18n.language) })}
                    </Text>
                    <Button variant="ghost" label={t('evening.close')} onPress={onClose} disabled={saving} />
                  </View>
                  <Text variant="title" accessibilityRole="header">
                    {t('todayPlan.title')}
                  </Text>
                  <Text tone="textMuted">{t('todayPlan.subtitle', { start: startLabel })}</Text>

                  {plan.status === 'loading' ? (
                    <ActivityIndicator color={colors.accent} style={styles.section} />
                  ) : plan.status === 'error' ? (
                    <View style={styles.section}>
                      <Text tone="danger">{t('todayPlan.loadError')}</Text>
                      <Button variant="secondary" label={t('today.retry')} onPress={plan.reload} />
                    </View>
                  ) : (
                    <>
                      <View style={styles.section}>
                        <TextField
                          label={t('todayPlan.typeLabel')}
                          placeholder={t('todayPlan.typePlaceholder')}
                          value={typed}
                          onChangeText={setTyped}
                          onSubmitEditing={addTyped}
                          maxLength={200}
                          returnKeyType="done"
                          submitBehavior="submit"
                        />
                        <Button
                          variant="secondary"
                          label={t('todayPlan.add')}
                          onPress={addTyped}
                          disabled={typed.trim().length === 0}
                        />
                        <Text variant="caption" tone="textMuted">
                          {t('todayPlan.examplesHint')}
                        </Text>
                      </View>

                      {visibleExisting.length > 0 ? (
                        <View style={styles.section}>
                          <Text variant="caption" tone="textMuted">
                            {t('todayPlan.existing')}
                          </Text>
                          {visibleExisting.map((block) => (
                            <ExistingRow key={block.id} block={block} />
                          ))}
                        </View>
                      ) : null}

                      {own.length > 0 ? (
                        <View style={styles.section}>
                          <Text variant="caption" tone="textMuted">
                            {t('todayPlan.ownIdeas')}
                          </Text>
                          <View style={styles.chips}>{own.map(ideaChip)}</View>
                        </View>
                      ) : null}

                      {noRoom ? (
                        <Text tone="danger" accessibilityLiveRegion="polite">
                          {t('todayPlan.noRoom')}
                        </Text>
                      ) : null}

                      <View style={styles.section}>
                        <Text variant="caption" tone="textMuted">
                          {t('todayPlan.newItems')}
                        </Text>
                        {sortedItems.length === 0 ? (
                          <Text tone="textMuted">{t('todayPlan.empty')}</Text>
                        ) : (
                          sortedItems.map((item) => (
                            <DraftRow
                              key={item.key}
                              draft={item.draft}
                              onEdit={() => setEditing(item)}
                              onRemove={() => remove(item.key)}
                            />
                          ))
                        )}
                      </View>
                    </>
                  )}
                </ScrollView>

                <View style={styles.footer}>
                  {hasPast ? (
                    <Text tone="danger" accessibilityLiveRegion="polite">
                      {t('todayPlan.pastWarning')}
                    </Text>
                  ) : null}
                  {saveError ? (
                    <Text tone="danger" accessibilityLiveRegion="assertive">
                      {t('todayPlan.saveError')}
                    </Text>
                  ) : null}
                  <View style={styles.buttons}>
                    <Button variant="ghost" label={t('todayPlan.later')} onPress={onClose} disabled={saving} />
                    <Button
                      label={t('todayPlan.confirm')}
                      disabled={plan.status !== 'ready' || !isTodayPlanValid(drafts, nowMinutes)}
                      loading={saving}
                      onPress={confirm}
                      style={styles.primary}
                    />
                  </View>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>

      {editing ? (
        <BlockEditor
          mode="edit"
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            replace(editing.key, draft);
            return Promise.resolve();
          }}
          onDelete={() => {
            remove(editing.key);
            return Promise.resolve();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primary: { minWidth: 140 },
  done: { flex: 1, justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
});
