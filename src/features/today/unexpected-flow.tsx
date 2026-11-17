import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { otherDayOptions } from '@/core/checkin';
import type { ScheduleBlock } from '@/core/domain';
import {
  defaultUnexpectedChoice,
  planUnexpected,
  UNEXPECTED_DURATIONS,
  type UnexpectedChoice,
  type UnexpectedDuration,
} from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import type { UnexpectedAnswer, UnexpectedInput, UnexpectedResult } from '@/db/repos';
import { formatShortDay } from '@/features/evening/steps';
import { Button } from '@/ui/button';
import { ChoiceGroup } from '@/ui/choice-group';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

const WHAT_MAX = 2000;

type UnexpectedFlowProps = {
  date: string;
  /** Minute od ponoći kad je flow otvoren — početak prozora (ne pomiče se dok je otvoren). */
  nowMinutes: number;
  blocks: readonly ScheduleBlock[];
  /** Spremi; baca grešku ako spremanje ne uspije. */
  onApply: (input: Omit<UnexpectedInput, 'date'>) => UnexpectedResult;
  onClose: () => void;
  /** Unaprijed popunjen razlog (npr. „Loš san“ iz jutarnjeg briefa, korak 29). */
  initialWhat?: string;
  initialDuration?: UnexpectedDuration;
};

/**
 * „Nešto je iskrslo“ (korak 27): što i koliko dugo → za svaku pogođenu aktivnost kasnije danas
 * (s točnim terminom) / sutra / drugi dan / preskoči. Bez osude: niz ostaje, a iskreno
 * preraspoređivanje donosi malo XP-a. Glasovni unos dolazi s korakom 30.
 */
export function UnexpectedFlow({
  date,
  nowMinutes,
  blocks,
  onApply,
  onClose,
  initialWhat = '',
  initialDuration = 60,
}: UnexpectedFlowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [what, setWhat] = useState(initialWhat);
  const [duration, setDuration] = useState<UnexpectedDuration>(initialDuration);
  const [answers, setAnswers] = useState<Record<string, UnexpectedAnswer>>({});
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<UnexpectedResult | null>(null);

  const plan = useMemo(() => planUnexpected(blocks, nowMinutes, duration), [blocks, nowMinutes, duration]);
  const affected = plan?.affected ?? [];
  const days = otherDayOptions(date);

  const durationLabel = (value: UnexpectedDuration) =>
    value === 'rest'
      ? t('unexpected.durationRest')
      : value < 60
        ? t('unexpected.durationMinutes', { count: value })
        : t('unexpected.durationHours', { count: value / 60 });

  function choiceOf(entry: (typeof affected)[number]): UnexpectedChoice {
    const chosen = answers[entry.block.id]?.choice;
    if (chosen === 'laterToday' && entry.laterToday === null) return defaultUnexpectedChoice(entry);
    return chosen ?? defaultUnexpectedChoice(entry);
  }

  function select(blockId: string, choice: UnexpectedChoice) {
    setAnswers((current) => ({
      ...current,
      [blockId]: { choice, otherDate: choice === 'other' ? (current[blockId]?.otherDate ?? days[0] ?? null) : null },
    }));
  }

  function save() {
    setFailed(false);
    const resolved: Record<string, UnexpectedAnswer> = {};
    for (const entry of affected) {
      const choice = choiceOf(entry);
      resolved[entry.block.id] = { choice, otherDate: answers[entry.block.id]?.otherDate ?? null };
    }
    try {
      setDone(onApply({ nowMinutes, duration, what, answers: resolved }));
    } catch (error: unknown) {
      console.error('Applying "something came up" failed', error);
      setFailed(true);
    }
  }

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {done !== null ? (
              <View style={[styles.content, styles.flex]}>
                <Text variant="overline" tone="textMuted">
                  {t('unexpected.overline')}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {t('unexpected.doneTitle')}
                </Text>
                <View style={card} accessible>
                  {done.laterToday > 0 ? <Text>{t('unexpected.doneLater', { count: done.laterToday })}</Text> : null}
                  {done.moved > 0 ? <Text>{t('unexpected.doneMoved', { count: done.moved })}</Text> : null}
                  {done.skipped > 0 ? <Text>{t('unexpected.doneSkipped', { count: done.skipped })}</Text> : null}
                  <Text tone="textMuted">{t('unexpected.factStreak')}</Text>
                  {done.xp > 0 ? (
                    <Text variant="bodyStrong" tone="accent">
                      {t('unexpected.doneXp', { xp: done.xp })}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text variant="overline" tone="textMuted">
                  {t('unexpected.overline')}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {t('unexpected.title')}
                </Text>
                <Text tone="textMuted">{t('unexpected.body')}</Text>

                <TextField
                  label={t('unexpected.whatLabel')}
                  placeholder={t('unexpected.whatPlaceholder')}
                  value={what}
                  onChangeText={setWhat}
                  maxLength={WHAT_MAX}
                  multiline
                  style={styles.whatInput}
                />

                <Text variant="bodyStrong">{t('unexpected.durationLabel')}</Text>
                <ChoiceGroup<UnexpectedDuration>
                  accessibilityLabel={t('unexpected.durationLabel')}
                  choices={UNEXPECTED_DURATIONS.map((value) => ({ value, label: durationLabel(value) }))}
                  selected={duration}
                  onSelect={setDuration}
                />

                <Text variant="bodyStrong" accessibilityRole="header">
                  {t('unexpected.affectedTitle', { count: affected.length })}
                </Text>
                {affected.length === 0 ? <Text tone="textMuted">{t('unexpected.noneAffected')}</Text> : null}
                {affected.map((entry) => {
                  const choice = choiceOf(entry);
                  const { block, laterToday } = entry;
                  const choices = [
                    ...(laterToday !== null
                      ? [{ value: 'laterToday' as const, label: t('unexpected.laterToday', { time: laterToday.start }) }]
                      : []),
                    { value: 'tomorrow' as const, label: t('unexpected.tomorrow') },
                    { value: 'other' as const, label: t('unexpected.other') },
                    { value: 'skip' as const, label: t('unexpected.skip') },
                  ];
                  return (
                    <View key={block.id} style={card}>
                      <Text variant="bodyStrong">{block.title}</Text>
                      <Text variant="caption" tone="textMuted">
                        {`${block.start}–${block.end}`}
                      </Text>
                      <ChoiceGroup<UnexpectedChoice>
                        accessibilityLabel={t('unexpected.whenLabel', { title: block.title })}
                        choices={choices}
                        selected={choice}
                        onSelect={(value) => select(block.id, value)}
                      />
                      {choice === 'other' ? (
                        <ChoiceGroup<string>
                          accessibilityLabel={t('unexpected.otherDayLabel')}
                          choices={days.map((day) => ({ value: day, label: formatShortDay(day, i18n.language) }))}
                          selected={answers[block.id]?.otherDate ?? days[0] ?? null}
                          onSelect={(otherDate) =>
                            setAnswers((current) => ({ ...current, [block.id]: { choice: 'other', otherDate } }))
                          }
                        />
                      ) : null}
                      {laterToday === null ? (
                        <Text variant="caption" tone="textMuted">
                          {t('unexpected.noSlotToday')}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.footer}>
              {failed ? (
                <Text tone="danger" accessibilityLiveRegion="assertive">
                  {t('unexpected.saveError')}
                </Text>
              ) : null}
              {done !== null ? (
                <Button label={t('unexpected.close')} onPress={onClose} />
              ) : (
                <>
                  <Button
                    label={t('unexpected.confirm')}
                    disabled={affected.length === 0}
                    onPress={save}
                  />
                  <Button variant="ghost" label={t('unexpected.cancel')} onPress={onClose} />
                </>
              )}
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
  whatInput: { minHeight: 72, textAlignVertical: 'top' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
