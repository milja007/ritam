import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RULE_WEIGHTS, type RulePeriod, type RuleWeight } from '@/core/domain';
import { addDays } from '@/core/time/local-date';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { RuleLimitError, createRule } from '@/db/repos';
import { dayMonth, weekdayName } from '@/features/ember/format';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

const TITLE_MAX = 120;
const WHY_MAX = 300;
/** Dani u tjednu od ponedjeljka (0 = nedjelja, kao `activeDays`). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** Ponedjeljak 2026-11-16 — samo za ime dana u tjednu. */
const MONDAY = '2026-11-16';

type RuleEditorProps = {
  period: RulePeriod;
  periodStart: string;
  periodEnd: string;
  onSaved: (title: string) => void;
  onClose: () => void;
  onLimit: () => void;
};

/** Ime dana u tjednu za `activeDays` vrijednost (0 = nedjelja). */
export function weekdayLabel(weekday: number, language: string): string {
  return weekdayName(addDays(MONDAY, (weekday + 6) % 7) ?? MONDAY, language);
}

/**
 * Nova zabrana unutar plana razdoblja (koncept: naziv, kad vrijedi, razlog, težina 1–3). Težina
 * i dani su dodiri; vrijedi od prvog do zadnjeg dana prikazanog razdoblja.
 */
export function RuleEditor({ period, periodStart, periodEnd, onSaved, onClose, onLimit }: RuleEditorProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const language = i18n.language;
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [weight, setWeight] = useState<RuleWeight>(2);
  const [days, setDays] = useState<readonly number[]>(WEEK_ORDER);
  const [failed, setFailed] = useState(false);
  const canSave = title.trim().length > 0 && days.length > 0;

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  async function save() {
    if (!canSave) return;
    setFailed(false);
    const name = title.trim();
    try {
      await createRule(getDb(), LOCAL_USER_ID, {
        title: name,
        icon: null,
        activeDays: WEEK_ORDER.filter((day) => days.includes(day)),
        activeHours: null,
        why: why.trim(),
        weight,
        period,
        periodStart,
      });
      onSaved(name);
    } catch (failure: unknown) {
      if (failure instanceof RuleLimitError) {
        onLimit();
        return;
      }
      console.error('Saving rule failed', failure);
      setFailed(true);
    }
  }

  const chip = (on: boolean) => [
    styles.chip,
    { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border },
  ];

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="overline" tone="accent">
                {t('rules.editor.overline')}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {t(`rules.editor.title.${period}`)}
              </Text>
              <Text tone="textMuted">
                {t('rules.editor.range', {
                  from: dayMonth(periodStart, language),
                  to: dayMonth(periodEnd, language),
                })}
              </Text>

              <TextField
                label={t('rules.editor.nameLabel')}
                placeholder={t('rules.editor.namePlaceholder')}
                value={title}
                onChangeText={setTitle}
                maxLength={TITLE_MAX}
                autoFocus
                returnKeyType="next"
              />
              <TextField
                label={t('rules.editor.whyLabel')}
                placeholder={t('rules.editor.whyPlaceholder')}
                value={why}
                onChangeText={setWhy}
                maxLength={WHY_MAX}
                returnKeyType="done"
              />

              <View style={styles.question}>
                <Text variant="bodyStrong">{t('rules.editor.weightLabel')}</Text>
                <View accessibilityRole="radiogroup" accessibilityLabel={t('rules.editor.weightLabel')} style={styles.chips}>
                  {RULE_WEIGHTS.map((value) => {
                    const on = value === weight;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        onPress={() => setWeight(value)}
                        style={({ pressed }) => [chip(on), pressed ? styles.pressed : null]}>
                        <Text variant={on ? 'bodyStrong' : 'body'} tone={on ? 'onAccent' : 'text'}>
                          {t(`rules.weight.${value}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.question}>
                <Text variant="bodyStrong">{t('rules.editor.daysLabel')}</Text>
                <Text variant="caption" tone="textMuted">
                  {t('rules.editor.daysHint')}
                </Text>
                <View accessibilityLabel={t('rules.editor.daysLabel')} style={styles.chips}>
                  {WEEK_ORDER.map((day) => {
                    const on = days.includes(day);
                    const name = weekdayLabel(day, language);
                    return (
                      <Pressable
                        key={day}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={name}
                        onPress={() => toggleDay(day)}
                        style={({ pressed }) => [chip(on), pressed ? styles.pressed : null]}>
                        <Text variant={on ? 'bodyStrong' : 'body'} tone={on ? 'onAccent' : 'text'}>
                          {name.slice(0, 3)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              {failed ? (
                <Text tone="danger" accessibilityLiveRegion="polite">
                  {t('rules.editor.failed')}
                </Text>
              ) : null}
              <Button label={t('rules.editor.save')} onPress={() => void save()} disabled={!canSave} />
              <Button variant="secondary" label={t('rules.editor.cancel')} onPress={onClose} />
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
