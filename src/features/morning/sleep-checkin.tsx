import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  createMorningDraft,
  isMorningDraftValid,
  sleepDurationMinutes,
  type MorningDraft,
  type MorningSleepSettings,
} from '@/core/checkin';
import type { Checkin } from '@/core/domain';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { ClockStepper } from '@/ui/clock-stepper';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** "7 h 45 min" iz minuta. */
function useDurationLabel() {
  const { t } = useTranslation();
  return (minutes: number | null) => {
    if (minutes === null) return '';
    return t('morning.sleep.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  };
}

/**
 * Prijava sna u briefu: unaprijed popunjeno iz ciljeva (krevet / buđenje), pa je dovoljno pomaknuti
 * vrijeme i Spremi ("dva taba"). Spremljena prijava se prikazuje sažeto s gumbom Uredi.
 */
export function SleepCheckin({
  date,
  settings,
  saved,
  onSave,
}: {
  date: string;
  settings: MorningSleepSettings;
  saved: Checkin | null;
  /** Sprema i vraća zarađeni XP; baca grešku ako spremanje ne uspije. */
  onSave: (draft: MorningDraft) => number;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const durationLabel = useDurationLabel();
  const [draft, setDraft] = useState<MorningDraft>(() => createMorningDraft(settings, date, saved));
  const [editing, setEditing] = useState(saved === null);
  const [error, setError] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);

  const valid = isMorningDraftValid(draft);
  const duration = sleepDurationMinutes(draft.sleepStart, draft.wakeTime);

  function save() {
    setError(false);
    try {
      setEarned(onSave(draft));
      setEditing(false);
    } catch (cause: unknown) {
      console.error('Saving morning check-in failed', cause);
      setError(true);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="overline" tone="textMuted">
        {t('morning.sleep.title')}
      </Text>
      {editing ? (
        <>
          <Text tone="textMuted">{t('morning.sleep.subtitle')}</Text>
          <ClockStepper
            label={t('morning.sleep.fellAsleep')}
            value={draft.sleepStart}
            onChange={(sleepStart) => setDraft((d) => ({ ...d, sleepStart }))}
          />
          <ClockStepper
            label={t('morning.sleep.wokeUp')}
            value={draft.wakeTime}
            onChange={(wakeTime) => setDraft((d) => ({ ...d, wakeTime }))}
          />
          <Text variant="bodyStrong" accessibilityLiveRegion="polite">
            {valid ? t('morning.sleep.total', { duration: durationLabel(duration) }) : t('morning.sleep.invalid')}
          </Text>
          {error ? (
            <Text tone="danger" accessibilityLiveRegion="assertive">
              {t('morning.sleep.saveError')}
            </Text>
          ) : null}
          <Button label={t('morning.sleep.save')} onPress={save} disabled={!valid} />
        </>
      ) : (
        <>
          <Text variant="heading">
            {t('morning.sleep.summary', { start: draft.sleepStart, end: draft.wakeTime })}
          </Text>
          <Text tone="textMuted">{t('morning.sleep.total', { duration: durationLabel(duration) })}</Text>
          {earned !== null ? (
            <Text variant="bodyStrong" tone="accent" accessibilityLiveRegion="polite">
              {earned > 0 ? t('morning.sleep.xp', { xp: earned }) : t('morning.sleep.saved')}
            </Text>
          ) : null}
          <Button variant="ghost" label={t('morning.sleep.edit')} onPress={() => setEditing(true)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
