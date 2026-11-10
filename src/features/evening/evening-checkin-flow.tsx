import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createEveningDraft,
  eveningSteps,
  isEveningStepValid,
  type ChecklistAnswer,
  type EveningDraft,
  type RuleAnswer,
  type SavedEveningCheckin,
} from '@/core/checkin';
import type { Rule, ScheduleBlock } from '@/core/domain';
import { spacing } from '@/core/theme';
import { DayDiagnosisView } from '@/features/diagnosis';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';

import { ChecklistStep, RatingStep, RulesStep } from './steps';
import type { EveningSaveResult } from './use-evening';

type EveningCheckinFlowProps = {
  /** Dan na koji se upit odnosi (prije 04:00 jučerašnji). */
  date: string;
  blocks: readonly ScheduleBlock[];
  activeRules: readonly Rule[];
  saved: SavedEveningCheckin | null;
  /** Sprema upit i vraća zarađeni XP i dijagnozu dana; baca grešku ako spremanje ne uspije. */
  onSave: (draft: EveningDraft) => EveningSaveResult;
  onClose: () => void;
  /** Nakon spremanja: prijeđi na "Što imaš sutra?". */
  onPlanTomorrow: () => void;
};

/**
 * Večernji upit, korak po korak: checklist dana → zabrane (ako danas vrijede) → ocjena dana.
 * Nakon spremanja: zarađeni XP i dijagnoza dana, pa "Što imaš sutra?" (koncept). Montira se pri
 * svakom otvaranju (svjež nacrt).
 */
export function EveningCheckinFlow({
  date,
  blocks,
  activeRules,
  saved,
  onSave,
  onClose,
  onPlanTomorrow,
}: EveningCheckinFlowProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<EveningDraft>(() =>
    createEveningDraft(date, blocks, activeRules, saved),
  );
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [result, setResult] = useState<EveningSaveResult | null>(null);

  const steps = eveningSteps(draft);
  const step = steps[index] ?? 'checklist';
  const isLast = index === steps.length - 1;

  function updateItem(blockId: string, patch: Partial<ChecklistAnswer>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.blockId === blockId ? { ...item, ...patch } : item)),
    }));
  }

  function updateRule(ruleId: string, patch: Partial<RuleAnswer>) {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.ruleId === ruleId ? { ...rule, ...patch } : rule)),
    }));
  }

  function finish() {
    setSaving(true);
    setSaveError(false);
    try {
      setResult(onSave(draft));
    } catch (error: unknown) {
      console.error('Saving evening check-in failed', error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {result !== null ? (
              <>
                <ScrollView contentContainerStyle={styles.content}>
                  <Text variant="display" tone="accent" accessibilityLiveRegion="polite">
                    {t('evening.done.xp', { xp: result.xp })}
                  </Text>
                  <Text variant="title" accessibilityRole="header">
                    {result.diagnosis ? t('evening.done.diagnosisTitle') : t('evening.done.title')}
                  </Text>
                  {result.diagnosis ? (
                    <View style={styles.body}>
                      <DayDiagnosisView diagnosis={result.diagnosis} />
                    </View>
                  ) : (
                    <Text tone="textMuted">{t('evening.done.body')}</Text>
                  )}
                </ScrollView>
                <View style={styles.footer}>
                  <Button label={t('evening.done.planTomorrow')} onPress={onPlanTomorrow} />
                  <Button variant="ghost" label={t('evening.done.close')} onPress={onClose} />
                </View>
              </>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                  <View style={styles.topRow}>
                    <Text variant="overline" tone="textMuted">
                      {t('evening.progress', { current: index + 1, total: steps.length })}
                    </Text>
                    <Button variant="ghost" label={t('evening.close')} onPress={onClose} disabled={saving} />
                  </View>
                  <Text variant="title" accessibilityRole="header">
                    {t(`evening.${step}.title`)}
                  </Text>
                  <Text tone="textMuted">{t(`evening.${step}.subtitle`)}</Text>
                  <View style={styles.body}>
                    {step === 'checklist' ? (
                      <ChecklistStep draft={draft} blocks={blocks} onChange={updateItem} />
                    ) : step === 'rules' ? (
                      <RulesStep draft={draft} rules={activeRules} onChange={updateRule} />
                    ) : (
                      <RatingStep draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
                    )}
                  </View>
                </ScrollView>

                <View style={styles.footer}>
                  {saveError ? (
                    <Text tone="danger" accessibilityLiveRegion="assertive">
                      {t('evening.saveError')}
                    </Text>
                  ) : null}
                  <View style={styles.buttons}>
                    {index > 0 ? (
                      <Button
                        variant="ghost"
                        label={t('evening.back')}
                        onPress={() => setIndex(index - 1)}
                        disabled={saving}
                      />
                    ) : (
                      <View />
                    )}
                    <Button
                      label={isLast ? t('evening.finish') : t('evening.next')}
                      disabled={!isEveningStepValid(step, draft)}
                      loading={saving}
                      onPress={isLast ? finish : () => setIndex(index + 1)}
                      style={styles.primary}
                    />
                  </View>
                </View>
              </>
            )}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { marginTop: spacing.lg },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primary: { minWidth: 140 },
});
