import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createDefaultDraft,
  isStepValid,
  ONBOARDING_STEPS,
  suggestNotificationTimes,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/core/onboarding';
import { spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { completeOnboarding } from '@/db/repos';
import { setLanguagePreference } from '@/i18n';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';

import { LanguageStep, NotificationsStep, RulesStep, SleepStep } from './steps';

const STEP_COMPONENTS = {
  language: LanguageStep,
  sleep: SleepStep,
  notifications: NotificationsStep,
  rules: RulesStep,
} satisfies Record<OnboardingStep, unknown>;

/** Prvo pokretanje: jezik → buđenje i san → obavijesti → 0–3 zabrane; na kraju sprema sve odjednom. */
export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<OnboardingDraft>(() => createDefaultDraft('system'));
  // Dok korisnik ručno ne pomakne vremena obavijesti, prate buđenje i san.
  const [notifTouched, setNotifTouched] = useState(false);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const step = ONBOARDING_STEPS[index] ?? 'language';
  const isLast = index === ONBOARDING_STEPS.length - 1;
  const StepComponent = STEP_COMPONENTS[step];

  function update(patch: Partial<OnboardingDraft>) {
    if (patch.language) setLanguagePreference(patch.language);
    if (patch.morningNotifTime !== undefined || patch.eveningNotifTime !== undefined) {
      setNotifTouched(true);
    }
    setDraft((current) => {
      const next = { ...current, ...patch };
      // Vikend buđenje prati radni dan dok ga korisnik ne promijeni.
      if (patch.wakeTime !== undefined && current.weekendWakeTime === current.wakeTime) {
        next.weekendWakeTime = patch.wakeTime;
      }
      const sleepChanged = patch.wakeTime !== undefined || patch.sleepHours !== undefined;
      if (sleepChanged && !notifTouched) {
        const suggested = suggestNotificationTimes(next.wakeTime, next.sleepHours);
        if (suggested) Object.assign(next, suggested);
      }
      return next;
    });
  }

  function finish() {
    setSaving(true);
    setSaveError(false);
    try {
      completeOnboarding(getDb(), LOCAL_USER_ID, draft);
      onDone();
    } catch (error) {
      console.error('Onboarding save failed', error);
      setSaveError(true);
      setSaving(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text variant="overline" tone="textMuted">
              {t('onboarding.progress', { current: index + 1, total: ONBOARDING_STEPS.length })}
            </Text>
            <Text variant="title" accessibilityRole="header">
              {t(`onboarding.${step}.title`)}
            </Text>
            <Text tone="textMuted">{t(`onboarding.${step}.subtitle`)}</Text>
            <View style={styles.body}>
              <StepComponent draft={draft} update={update} />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {saveError ? (
              <Text tone="danger" accessibilityLiveRegion="assertive">
                {t('onboarding.saveError')}
              </Text>
            ) : null}
            <View style={styles.buttons}>
              {index > 0 ? (
                <Button
                  variant="ghost"
                  label={t('onboarding.back')}
                  onPress={() => setIndex(index - 1)}
                  disabled={saving}
                />
              ) : (
                <View />
              )}
              <Button
                label={isLast ? (saving ? t('onboarding.saving') : t('onboarding.finish')) : t('onboarding.next')}
                disabled={!isStepValid(step, draft)}
                loading={saving}
                onPress={isLast ? finish : () => setIndex(index + 1)}
                style={styles.primary}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
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
