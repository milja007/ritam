import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { RULE_WEIGHTS, type RuleWeight } from '@/core/domain';
import type { Language } from '@/core/i18n/language';
import {
  bedtimeFor,
  clampSleepHours,
  MAX_RULES,
  MAX_SLEEP_HOURS,
  MIN_RULES,
  MIN_SLEEP_HOURS,
  shiftClock,
  splitHours,
  TIME_STEP_MINUTES,
  type OnboardingDraft,
  type RuleDraft,
} from '@/core/onboarding';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { ChoiceGroup } from '@/ui/choice-group';
import { Stepper } from '@/ui/stepper';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const LANGUAGE_CHOICES: readonly { value: Language; label: string }[] = [
  { value: 'hr', label: 'Hrvatski' },
  { value: 'en', label: 'English' },
];

export function LanguageStep({ draft, update }: StepProps) {
  const { t } = useTranslation();
  return (
    <ChoiceGroup
      accessibilityLabel={t('profile.language.title')}
      choices={LANGUAGE_CHOICES}
      selected={draft.language}
      onSelect={(language) => update({ language })}
    />
  );
}

function ClockStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const shift = (delta: number) => {
    const next = shiftClock(value, delta);
    if (next !== null) onChange(next);
  };
  return (
    <Stepper
      label={label}
      value={value}
      onDecrease={() => shift(-TIME_STEP_MINUTES)}
      onIncrease={() => shift(TIME_STEP_MINUTES)}
      decreaseLabel={t('onboarding.decrease', { label })}
      increaseLabel={t('onboarding.increase', { label })}
    />
  );
}

export function SleepStep({ draft, update }: StepProps) {
  const { t } = useTranslation();
  const { hours, minutes } = splitHours(draft.sleepHours);
  const hoursLabel =
    minutes === 0
      ? t('onboarding.sleep.hoursValue', { hours })
      : t('onboarding.sleep.hoursMinutesValue', { hours, minutes });
  const bedtime = bedtimeFor(draft.wakeTime, draft.sleepHours);
  const step = TIME_STEP_MINUTES / 60;
  const sleepLabel = t('onboarding.sleep.hours');

  return (
    <View style={styles.stack}>
      <ClockStepper
        label={t('onboarding.sleep.wake')}
        value={draft.wakeTime}
        onChange={(wakeTime) => update({ wakeTime })}
      />
      <Stepper
        label={sleepLabel}
        value={hoursLabel}
        onDecrease={() => update({ sleepHours: clampSleepHours(draft.sleepHours - step) })}
        onIncrease={() => update({ sleepHours: clampSleepHours(draft.sleepHours + step) })}
        canDecrease={draft.sleepHours > MIN_SLEEP_HOURS}
        canIncrease={draft.sleepHours < MAX_SLEEP_HOURS}
        decreaseLabel={t('onboarding.decrease', { label: sleepLabel })}
        increaseLabel={t('onboarding.increase', { label: sleepLabel })}
      />
      {bedtime ? (
        <Text variant="bodyStrong" tone="accent" accessibilityLiveRegion="polite">
          {t('onboarding.sleep.bedtime', { time: bedtime })}
        </Text>
      ) : null}
    </View>
  );
}

export function NotificationsStep({ draft, update }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.stack}>
      <ClockStepper
        label={t('onboarding.notifications.morning')}
        value={draft.morningNotifTime}
        onChange={(morningNotifTime) => update({ morningNotifTime })}
      />
      <ClockStepper
        label={t('onboarding.notifications.evening')}
        value={draft.eveningNotifTime}
        onChange={(eveningNotifTime) => update({ eveningNotifTime })}
      />
    </View>
  );
}

export function RulesStep({ draft, update }: StepProps) {
  const { t } = useTranslation();

  const setRule = (index: number, patch: Partial<RuleDraft>) =>
    update({ rules: draft.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) });
  const removeRule = (index: number) => update({ rules: draft.rules.filter((_, i) => i !== index) });
  const addRule = () => update({ rules: [...draft.rules, { title: '', why: '', weight: 2 }] });

  return (
    <View style={styles.stack}>
      {draft.rules.map((rule, index) => (
        <RuleCard
          key={index}
          number={index + 1}
          rule={rule}
          onChange={(patch) => setRule(index, patch)}
          onRemove={draft.rules.length > MIN_RULES ? () => removeRule(index) : undefined}
        />
      ))}
      {draft.rules.length < MAX_RULES ? (
        <Button variant="secondary" label={t('onboarding.rules.add')} onPress={addRule} />
      ) : null}
      <Text variant="caption" tone="textMuted">
        {t('onboarding.rules.hint')}
      </Text>
    </View>
  );
}

function RuleCard({
  number,
  rule,
  onChange,
  onRemove,
}: {
  number: number;
  rule: RuleDraft;
  onChange: (patch: Partial<RuleDraft>) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const weightChoices = RULE_WEIGHTS.map((weight) => ({
    value: weight,
    label: t(`onboarding.rules.weight${weight}`),
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text variant="overline" tone="textMuted">
          {t('onboarding.rules.item', { number })}
        </Text>
        {onRemove ? (
          <Pressable accessibilityRole="button" hitSlop={spacing.sm} onPress={onRemove}>
            <Text variant="caption" tone="danger">
              {t('onboarding.rules.remove')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <TextField
        label={t('onboarding.rules.name')}
        placeholder={t('onboarding.rules.namePlaceholder')}
        value={rule.title}
        onChangeText={(title) => onChange({ title })}
        maxLength={120}
        returnKeyType="next"
      />
      <TextField
        label={t('onboarding.rules.why')}
        placeholder={t('onboarding.rules.whyPlaceholder')}
        value={rule.why}
        onChangeText={(why) => onChange({ why })}
        maxLength={500}
        multiline
      />
      <Text variant="caption" tone="textMuted">
        {t('onboarding.rules.weight')}
      </Text>
      <ChoiceGroup<RuleWeight>
        layout="row"
        accessibilityLabel={t('onboarding.rules.weight')}
        choices={weightChoices}
        selected={rule.weight}
        onSelect={(weight) => onChange({ weight })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
