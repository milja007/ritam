import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAX_QUEST_MILESTONES, type Quest } from '@/core/domain';
import { QUEST_DEADLINES, questDeadlineDate, type QuestDeadline } from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { createQuest, deleteQuest, QuestLimitError, updateQuest, type QuestMilestoneInput } from '@/db/repos';
import { dayMonth } from '@/features/ember/format';
import { notifyProgressChanged } from '@/features/progress';
import { Button } from '@/ui/button';
import { ChoiceGroup } from '@/ui/choice-group';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

const TITLE_MAX = 120;
const WHY_MAX = 300;

type Draft = { key: string; id?: string; title: string };
type DeadlineChoice = QuestDeadline | 'keep';

type Props = {
  /** Quest koji se uređuje; `null` = novi. */
  quest: Quest | null;
  today: string;
  onClose: () => void;
  onSaved: () => void;
};

let draftKey = 0;
const nextKey = () => `draft-${++draftKey}`;

/**
 * Uređivač epskog questa (puni ekran): naslov, zašto, okvirni rok (brzi izbor u mjesecima, bez
 * kalendara) i etape. Postojeće etape čuvaju dan ostvarenja. Novi quest ima jednu praznu etapu.
 */
export function QuestEditor({ quest, today, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [title, setTitle] = useState(quest?.title ?? '');
  const [why, setWhy] = useState(quest?.why ?? '');
  const [deadline, setDeadline] = useState<DeadlineChoice>(quest?.targetDate ? 'keep' : 'none');
  const [milestones, setMilestones] = useState<Draft[]>(() =>
    quest
      ? quest.milestones.map((milestone) => ({ key: milestone.id, id: milestone.id, title: milestone.title }))
      : [{ key: nextKey(), title: '' }],
  );
  const [error, setError] = useState<'limit' | 'failed' | null>(null);

  const cleanTitle = title.trim();
  const canSave = cleanTitle.length > 0;

  const deadlineChoices: { value: DeadlineChoice; label: string }[] = [
    ...(quest?.targetDate
      ? [{ value: 'keep' as const, label: t('quests.editor.deadline.keep', { date: dayMonth(quest.targetDate, i18n.language) }) }]
      : []),
    ...QUEST_DEADLINES.map((value) => ({ value, label: t(`quests.editor.deadline.${value}`) })),
  ];

  function setMilestone(key: string, text: string) {
    setMilestones((items) => items.map((item) => (item.key === key ? { ...item, title: text } : item)));
  }

  function save() {
    if (!canSave) return;
    const targetDate = deadline === 'keep' ? (quest?.targetDate ?? null) : questDeadlineDate(deadline, today);
    const input = {
      title: cleanTitle,
      why: why.trim(),
      targetDate,
      milestones: milestones
        .map((item): QuestMilestoneInput => ({ id: item.id, title: item.title.trim() }))
        .filter((item) => item.title.length > 0),
    };
    setError(null);
    try {
      const db = getDb();
      if (quest) updateQuest(db, LOCAL_USER_ID, quest.id, input);
      else createQuest(db, LOCAL_USER_ID, input);
      notifyProgressChanged();
      onSaved();
    } catch (failure: unknown) {
      if (failure instanceof QuestLimitError) {
        setError('limit');
        return;
      }
      console.error('Saving quest failed', failure);
      setError('failed');
    }
  }

  function confirmDelete() {
    if (!quest) return;
    Alert.alert(t('quests.editor.deleteTitle'), t('quests.editor.deleteMessage', { title: quest.title }), [
      { text: t('quests.editor.cancel'), style: 'cancel' },
      {
        text: t('quests.editor.delete'),
        style: 'destructive',
        onPress: () => {
          try {
            deleteQuest(getDb(), LOCAL_USER_ID, quest.id);
            notifyProgressChanged();
            onSaved();
          } catch (failure: unknown) {
            console.error('Deleting quest failed', failure);
            setError('failed');
          }
        },
      },
    ]);
  }

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="overline" tone="accent">
                {t('quests.overline')}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {quest ? t('quests.editor.editTitle') : t('quests.editor.newTitle')}
              </Text>
              <Text tone="textMuted">{t('quests.editor.body')}</Text>

              <TextField
                label={t('quests.editor.titleLabel')}
                placeholder={t('quests.editor.titlePlaceholder')}
                value={title}
                onChangeText={setTitle}
                maxLength={TITLE_MAX}
                autoFocus={!quest}
                returnKeyType="next"
              />
              <TextField
                label={t('quests.editor.whyLabel')}
                placeholder={t('quests.editor.whyPlaceholder')}
                value={why}
                onChangeText={setWhy}
                maxLength={WHY_MAX}
                multiline
                style={styles.multiline}
              />

              <Text variant="bodyStrong">{t('quests.editor.deadlineLabel')}</Text>
              <ChoiceGroup<DeadlineChoice>
                accessibilityLabel={t('quests.editor.deadlineLabel')}
                choices={deadlineChoices}
                selected={deadline}
                onSelect={setDeadline}
              />

              <Text variant="bodyStrong">{t('quests.editor.milestonesLabel')}</Text>
              <Text variant="caption" tone="textMuted">
                {t('quests.editor.milestonesHint')}
              </Text>
              <View style={card}>
                {milestones.map((item, index) => (
                  <View key={item.key} style={styles.milestoneRow}>
                    <View style={styles.flex}>
                      <TextField
                        label={t('quests.editor.milestoneLabel', { n: index + 1 })}
                        placeholder={t('quests.editor.milestonePlaceholder')}
                        value={item.title}
                        onChangeText={(text) => setMilestone(item.key, text)}
                        maxLength={TITLE_MAX}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('quests.editor.removeMilestone', { n: index + 1 })}
                      hitSlop={8}
                      onPress={() => setMilestones((items) => items.filter((other) => other.key !== item.key))}
                      style={styles.remove}>
                      <Text tone="textMuted">✕</Text>
                    </Pressable>
                  </View>
                ))}
                {milestones.length < MAX_QUEST_MILESTONES ? (
                  <Button
                    variant="ghost"
                    label={t('quests.editor.addMilestone')}
                    onPress={() => setMilestones((items) => [...items, { key: nextKey(), title: '' }])}
                  />
                ) : (
                  <Text variant="caption" tone="textMuted">
                    {t('quests.editor.milestonesMax', { max: MAX_QUEST_MILESTONES })}
                  </Text>
                )}
              </View>

              {quest ? <Button variant="ghost" label={t('quests.editor.delete')} onPress={confirmDelete} /> : null}
            </ScrollView>

            <View style={styles.footer}>
              {error !== null ? (
                <Text tone="danger" accessibilityLiveRegion="polite">
                  {t(error === 'limit' ? 'quests.limit' : 'quests.editor.failed')}
                </Text>
              ) : null}
              <Button label={t('quests.editor.save')} onPress={save} disabled={!canSave} />
              <Button variant="secondary" label={t('quests.editor.cancel')} onPress={onClose} />
            </View>
          </KeyboardAvoidingView>
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
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
