import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Settings } from '@/core/domain';
import type { LanguagePreference } from '@/core/i18n/language';
import { dailyNotificationTimes, type NotificationKind } from '@/core/notifications';
import { weekendShiftMinutes, weekendWakeOf, weekendWakeWarning } from '@/core/schedule';
import { shiftClock } from '@/core/onboarding';
import { radius, spacing } from '@/core/theme';
import { PermissionCard } from '@/features/notifications';
import { ProgressCard, ScoreAreasPicker } from '@/features/progress';
import { updateSettings, useSettings } from '@/features/settings';
import { useNow } from '@/features/today';
import type { SettingsInput } from '@/db/repos';
import { ClockStepper } from '@/ui/clock-stepper';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

const LANGUAGE_OPTIONS: readonly LanguagePreference[] = ['system', 'hr', 'en'];

const TOGGLES: readonly { kind: NotificationKind; field: keyof Pick<
  Settings,
  'morningNotifEnabled' | 'eveningNotifEnabled' | 'windDownNotifEnabled'
> }[] = [
  { kind: 'morning', field: 'morningNotifEnabled' },
  { kind: 'evening', field: 'eveningNotifEnabled' },
  { kind: 'windDown', field: 'windDownNotifEnabled' },
];

/** Profil: napredak (XP, razina, streak), jezik, buđenje (radni dan / vikend) i prekidači dnevnih obavijesti. Sve se sprema odmah. */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const state = useSettings();
  const now = useNow();
  const [saveError, setSaveError] = useState(false);

  function save(patch: Partial<SettingsInput>) {
    setSaveError(false);
    updateSettings(patch).catch((error: unknown) => {
      console.error('Saving settings failed', error);
      setSaveError(true);
    });
  }

  const settings = state.settings;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title" accessibilityRole="header" style={styles.title}>
            {t('tabs.profile')}
          </Text>

          <Section title={t('profile.progress')}>
            <ProgressCard today={now.date} checkinDay={now.eveningDate} />
          </Section>

          <PermissionCard />

          {settings === null ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Section title={t('profile.language.title')}>
                <View
                  accessibilityRole="radiogroup"
                  style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  {LANGUAGE_OPTIONS.map((option) => {
                    const selected = option === settings.language;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => save({ language: option })}
                        style={[styles.row, selected && { backgroundColor: colors.surfaceRaised }]}>
                        <Text>{t(`profile.language.${option}`)}</Text>
                        {selected ? (
                          <Text variant="bodyStrong" tone="accent">
                            ✓
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Section>

              <Section title={t('profile.sleep.title')}>
                <WakeTimes settings={settings} save={save} />
              </Section>

              <Section title={t('profile.notifications.title')}>
                <NotificationToggles settings={settings} save={save} />
              </Section>

              <Section title={t('profile.score.title')}>
                <ScoreAreasPicker value={settings} onChange={save} />
              </Section>
            </>
          )}

          {saveError ? (
            <Text tone="danger" accessibilityLiveRegion="assertive">
              {t('profile.saveError')}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="textMuted">
        {title}
      </Text>
      {children}
    </View>
  );
}

type EditorProps = { settings: Settings; save: (patch: Partial<SettingsInput>) => void };

function WakeTimes({ settings, save }: EditorProps) {
  const { t } = useTranslation();
  const weekend = weekendWakeOf(settings);
  return (
    <View style={styles.stack}>
      <ClockStepper
        label={t('onboarding.sleep.wakeWeekday')}
        value={settings.wakeTime}
        // Vikend koji nije zadan (`null`) prati radni dan.
        onChange={(wakeTime) => save({ wakeTime })}
      />
      <ClockStepper
        label={t('onboarding.sleep.wakeWeekend')}
        value={weekend}
        onChange={(next) => save({ weekendWakeTime: next === settings.wakeTime ? null : next })}
      />
      {weekendWakeWarning(settings.wakeTime, settings.weekendWakeTime) ? (
        <Text tone="info" accessibilityLiveRegion="polite">
          {t('onboarding.sleep.weekendWarning')}
        </Text>
      ) : null}
    </View>
  );
}

function NotificationToggles({ settings, save }: EditorProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const times = dailyNotificationTimes(settings);
  const weekendMorning = times ? shiftClock(times.morning, weekendShiftMinutes(settings)) : null;

  return (
    <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {TOGGLES.map(({ kind, field }) => {
        const label = t(`profile.notifications.${kind}`);
        const time = times?.[kind];
        const detail =
          time === undefined
            ? null
            : kind === 'morning' && weekendMorning !== null && weekendMorning !== time
              ? t('profile.notifications.weekendTime', { time, weekend: weekendMorning })
              : t('profile.notifications.time', { time });
        return (
          <View key={kind} style={styles.row}>
            <View style={styles.rowText}>
              <Text>{label}</Text>
              {detail ? (
                <Text variant="caption" tone="textMuted">
                  {detail}
                </Text>
              ) : null}
            </View>
            <Switch
              accessibilityLabel={label}
              value={settings[field]}
              onValueChange={(value) => save({ [field]: value })}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: { marginBottom: spacing.xs },
  section: { gap: spacing.sm },
  stack: { gap: spacing.md },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xxs,
  },
  rowText: { flex: 1, gap: spacing.xxs },
});
