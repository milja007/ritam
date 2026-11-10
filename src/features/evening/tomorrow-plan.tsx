import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScheduleBlock } from '@/core/domain';
import {
  isTomorrowPlanValid,
  occupiedSlots,
  pickKey,
  QUICK_PICKS,
  quickPickDraft,
  typedDraft,
  type BlockDraft,
  type LearnedPick,
} from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { BlockEditor } from '@/features/today/block-editor';
import { formatDay } from '@/features/today/format-day';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { useTomorrowPlan } from './use-tomorrow';

type TomorrowPlanProps = {
  /** Sutrašnji dan ("YYYY-MM-DD"). */
  date: string;
  /** Pozove se nakon spremanja (osvježi timeline). */
  onSaved: () => void;
  onClose: () => void;
};

type Item = { key: number; draft: BlockDraft };

/**
 * "Što imaš sutra?": brzi odabiri i tipkanje dodaju blokove za sutra (termini se slažu iza
 * zadnjeg bloka od buđenja), pregled s uređivanjem, Potvrdi sprema sve odjednom.
 */
export function TomorrowPlan({ date, onSaved, onClose }: TomorrowPlanProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const plan = useTomorrowPlan(date);
  const [items, setItems] = useState<Item[]>([]);
  const nextKey = useRef(1);
  const [typed, setTyped] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const drafts = items.map((item) => item.draft);
  const occupied = occupiedSlots(plan.existing, drafts);

  function add(draft: BlockDraft) {
    const key = nextKey.current++;
    setItems((current) => [...current, { key, draft }]);
  }

  function addPick(pick: (typeof QUICK_PICKS)[number]) {
    add(quickPickDraft(pick, t(`evening.tomorrow.pick.${pick.id}`), occupied, plan.wakeTime));
  }

  /** Naučeni odabir dolazi u svom uobičajenom terminu (korisnik ga mijenja u editoru). */
  function addLearned(pick: LearnedPick) {
    add({ title: pick.title, kind: pick.kind, start: pick.start, end: pick.end });
  }

  // Naučeni odabir koji je već dodan se skriva.
  const added = new Set(drafts.map((draft) => pickKey(draft.title)));
  const learned = plan.learned.filter((pick) => !added.has(pick.key));

  function addTyped() {
    const draft = typedDraft(typed, occupied, plan.wakeTime);
    if (!draft) return;
    add(draft);
    setTyped('');
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
      console.error('Saving tomorrow plan failed', error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const sortedItems = [...items].sort((a, b) => a.draft.start.localeCompare(b.draft.start) || a.key - b.key);

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {savedCount !== null ? (
              <View style={styles.done}>
                <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
                  {t('evening.tomorrow.doneTitle')}
                </Text>
                <Text tone="textMuted">{t('evening.tomorrow.doneBody', { count: savedCount })}</Text>
                <Button label={t('evening.tomorrow.close')} onPress={onClose} style={styles.primary} />
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                  <View style={styles.topRow}>
                    <Text variant="overline" tone="textMuted">
                      {t('evening.tomorrow.overline', {
                        day: formatDay(date, i18n.language),
                      })}
                    </Text>
                    <Button variant="ghost" label={t('evening.close')} onPress={onClose} disabled={saving} />
                  </View>
                  <Text variant="title" accessibilityRole="header">
                    {t('evening.tomorrow.title')}
                  </Text>
                  <Text tone="textMuted">{t('evening.tomorrow.subtitle')}</Text>

                  {plan.status === 'loading' ? (
                    <ActivityIndicator color={colors.accent} style={styles.section} />
                  ) : plan.status === 'error' ? (
                    <View style={styles.section}>
                      <Text tone="danger">{t('evening.tomorrow.loadError')}</Text>
                      <Button variant="secondary" label={t('today.retry')} onPress={plan.reload} />
                    </View>
                  ) : (
                    <>
                      {plan.existing.length > 0 ? (
                        <View style={styles.section}>
                          <Text variant="caption" tone="textMuted">
                            {t('evening.tomorrow.existing')}
                          </Text>
                          {plan.existing.map((block) => (
                            <ExistingRow key={block.id} block={block} />
                          ))}
                        </View>
                      ) : null}

                      {learned.length > 0 ? (
                        <View style={styles.section}>
                          <Text variant="caption" tone="textMuted">
                            {t('evening.tomorrow.learned')}
                          </Text>
                          <View style={styles.chips}>
                            {learned.map((pick) => (
                              <Chip
                                key={pick.key}
                                label={t('evening.tomorrow.learnedPick', {
                                  title: pick.title,
                                  start: pick.start,
                                })}
                                hint={t('evening.tomorrow.learnedHint', { start: pick.start, end: pick.end })}
                                onPress={() => addLearned(pick)}
                              />
                            ))}
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.section}>
                        <Text variant="caption" tone="textMuted">
                          {t('evening.tomorrow.quickPicks')}
                        </Text>
                        <View style={styles.chips}>
                          {QUICK_PICKS.map((pick) => (
                            <Chip
                              key={pick.id}
                              label={t(`evening.tomorrow.pick.${pick.id}`)}
                              hint={t('evening.tomorrow.pickHint')}
                              onPress={() => addPick(pick)}
                            />
                          ))}
                        </View>
                      </View>

                      <View style={styles.section}>
                        <TextField
                          label={t('evening.tomorrow.typeLabel')}
                          placeholder={t('evening.tomorrow.typePlaceholder')}
                          value={typed}
                          onChangeText={setTyped}
                          onSubmitEditing={addTyped}
                          maxLength={200}
                          returnKeyType="done"
                          submitBehavior="submit"
                        />
                        <Button
                          variant="secondary"
                          label={t('evening.tomorrow.add')}
                          onPress={addTyped}
                          disabled={typed.trim().length === 0}
                        />
                      </View>

                      <View style={styles.section}>
                        <Text variant="caption" tone="textMuted">
                          {t('evening.tomorrow.newItems')}
                        </Text>
                        {sortedItems.length === 0 ? (
                          <Text tone="textMuted">{t('evening.tomorrow.empty')}</Text>
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
                  {saveError ? (
                    <Text tone="danger" accessibilityLiveRegion="assertive">
                      {t('evening.tomorrow.saveError')}
                    </Text>
                  ) : null}
                  <View style={styles.buttons}>
                    <Button
                      variant="ghost"
                      label={t('evening.tomorrow.skip')}
                      onPress={onClose}
                      disabled={saving}
                    />
                    <Button
                      label={t('evening.tomorrow.confirm', {
                        count: items.length,
                      })}
                      disabled={plan.status !== 'ready' || !isTomorrowPlanValid(drafts)}
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

function Chip({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
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

function ExistingRow({ block }: { block: ScheduleBlock }) {
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

function DraftRow({
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
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primary: { minWidth: 140 },
  done: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
