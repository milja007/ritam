import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import type { MorningSleepSettings } from '@/core/checkin';
import { railColors } from '@/core/ember';
import { bedtimeStep, sleepNights, summarizeNights, targetSleepMinutes, type SleepNight } from '@/core/sleep';
import { radius, spacing } from '@/core/theme';
import { dayLong, weekdayLetter } from '@/features/ember/format';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { useSleepNights } from './use-sleep-nights';

const CHART_HEIGHT = 88;
/** Noć bez prijave: niska crtica (ugašen žar). */
const UNLIT_HEIGHT = 3;
const BAR_STAGGER_MS = 60;
const BAR_FADE_MS = 320;

function useDuration() {
  const { t } = useTranslation();
  return (minutes: number) =>
    t('morning.sleep.duration', { hours: Math.floor(minutes / 60), minutes: Math.round(minutes % 60) });
}

/**
 * Profil, „San“ (korak 29): zadnjih 7 noći kao stupci prema ciljanoj liniji. Naspavana noć
 * svijetli u boji plamena, kratka je prigušeni žar, neprijavljena ugašena — bez crvene i bez
 * kazne. Ispod: prosjek, krevet prema cilju i večerašnji krevet u koracima po 15 min.
 */
export function SleepCard({
  today,
  tonightDate,
  settings,
}: {
  /** Dan zadnjeg jutra (današnja prijava sna). */
  today: string;
  /** Dan čija je večer „večeras“ (dan upita; poslije ponoći je to jučer). */
  tonightDate: string;
  settings: MorningSleepSettings;
}) {
  const { t, i18n } = useTranslation();
  const { colors, scheme, flame } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const duration = useDuration();
  const state = useSleepNights(today);
  const rail = railColors(scheme, flame);
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (state.status === 'loading') {
    return (
      <View style={cardStyle}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={cardStyle}>
        <Text tone="danger">{t('sleepCard.error')}</Text>
      </View>
    );
  }

  const nights = sleepNights(settings, state.mornings, today);
  const summary = summarizeNights(nights);
  const target = targetSleepMinutes(settings);
  const scale = Math.max(target * 1.25, ...nights.map((night) => night.minutes ?? 0));
  const heightOf = (minutes: number) => Math.max(UNLIT_HEIGHT + 2, Math.round((minutes / scale) * CHART_HEIGHT));
  const targetY = Math.round((target / scale) * CHART_HEIGHT);
  const step = bedtimeStep(settings, nights, tonightDate);

  const barColor = (night: SleepNight) =>
    night.level === 'rested' ? rail.lit : night.level === 'short' ? rail.half : rail.ring;
  const nightLabel = (night: SleepNight) =>
    night.minutes === null
      ? t('sleepCard.nightEmpty', { day: dayLong(night.date, i18n.language) })
      : t('sleepCard.nightLabel', {
          day: dayLong(night.date, i18n.language),
          duration: duration(night.minutes),
          start: night.sleepStart ?? '',
        });

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('sleepCard.title')}
        </Text>
        {summary.averageMinutes === null ? null : (
          <Text variant="caption" style={styles.tabular}>
            {t('sleepCard.average', { duration: duration(summary.averageMinutes), target: duration(target) })}
          </Text>
        )}
      </View>

      <View style={styles.chart}>
        {nights.map((night, index) => (
          <View key={night.date} style={styles.barSlot} accessible accessibilityLabel={nightLabel(night)}>
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.delay(index * BAR_STAGGER_MS).duration(BAR_FADE_MS)}
              style={[
                styles.bar,
                night.minutes === null
                  ? { height: UNLIT_HEIGHT, backgroundColor: colors.border }
                  : { height: heightOf(night.minutes), backgroundColor: barColor(night) },
              ]}
            />
          </View>
        ))}
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.targetLine, { bottom: targetY, borderColor: colors.textMuted }]}>
          <Text variant="caption" tone="textMuted" style={[styles.targetLabel, { backgroundColor: colors.surface }]}>
            {t('sleepCard.targetLine')}
          </Text>
        </View>
      </View>
      <View style={styles.letters} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {nights.map((night) => (
          <Text
            key={night.date}
            variant="caption"
            tone={night.date === today ? 'accent' : 'textMuted'}
            style={styles.letter}>
            {weekdayLetter(night.date, i18n.language)}
          </Text>
        ))}
      </View>

      {summary.logged === 0 ? (
        <Text tone="textMuted">{t('sleepCard.empty')}</Text>
      ) : (
        <View style={styles.facts}>
          <Text>{t('sleepCard.rested', { count: summary.rested, total: summary.logged })}</Text>
          {summary.averageLateBy !== null && summary.averageLateBy > 15 ? (
            <Text>{t('sleepCard.bedtimeLate', { minutes: summary.averageLateBy })}</Text>
          ) : (
            <Text>{t('sleepCard.bedtimeOnTime')}</Text>
          )}
        </View>
      )}

      {step === null ? null : (
        <View style={[styles.tonight, { backgroundColor: colors.surfaceRaised }]} accessible>
          <Text variant="overline" tone="accent">
            {t('sleepCard.tonightTitle')}
          </Text>
          <Text variant="bodyStrong">
            {step.stepping && step.laterThanTarget > 0
              ? t('sleepCard.tonightStep', { time: step.tonight, target: step.target })
              : t('sleepCard.tonightTarget', { time: step.tonight })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  chart: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  barSlot: { flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm },
  letters: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm },
  letter: { flex: 1, textAlign: 'center' },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  targetLabel: { position: 'absolute', right: 0, top: -9, paddingHorizontal: spacing.xs },
  facts: { gap: spacing.xs },
  tonight: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md },
});
