import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  briefBlocks,
  briefStartIndex,
  briefSummary,
  greetingFor,
  type MorningDraft,
  type MorningSleepSettings,
} from '@/core/checkin';
import type { Checkin, ScheduleBlock } from '@/core/domain';
import { formatClock } from '@/core/time/clock';
import { spacing } from '@/core/theme';
import { formatDay } from '@/features/today/format-day';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';

import { DayCards } from './day-cards';
import { SleepCheckin } from './sleep-checkin';

/** Koliko dugo se prikazuje "Dan počinje" prije zatvaranja (prava animacija je korak 35). */
const START_HOLD_MS = 1200;
const START_FADE_MS = 400;

type MorningBriefProps = {
  date: string;
  nowMinutes: number;
  blocks: readonly ScheduleBlock[];
  settings: MorningSleepSettings;
  saved: Checkin | null;
  onSave: (draft: MorningDraft) => number;
  /** Zatvori brief (Kreni ili zatvaranje). */
  onClose: () => void;
  /** Prilagodi: zatvori brief i otvori timeline za uređivanje. */
  onAdjust: () => void;
};

/**
 * Jutarnji brief (ritualni ekran iz jutarnje obavijesti): pozdrav + vrijeme, prijava sna, raspored
 * dana kao kartice, Prilagodi / Kreni. Kreni završava kratkim "Dan počinje".
 */
export function MorningBrief({
  date,
  nowMinutes,
  blocks,
  settings,
  saved,
  onSave,
  onClose,
  onAdjust,
}: MorningBriefProps) {
  const { t, i18n } = useTranslation();
  const [starting, setStarting] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }));
  // Kartice i sažetak se ne mijenjaju dok je brief otvoren (početna kartica ostaje ista).
  const [shown] = useState(() => briefBlocks(blocks));
  const [startIndex] = useState(() => briefStartIndex(blocks, nowMinutes));
  const summary = briefSummary(blocks, nowMinutes);
  const next = summary.next ? shown.find((block) => block.id === summary.next?.id) : undefined;

  useEffect(() => {
    if (!starting) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) fade.setValue(1);
        else Animated.timing(fade, { toValue: 1, duration: START_FADE_MS, useNativeDriver: true }).start();
        timer = setTimeout(onClose, START_HOLD_MS);
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [starting, fade, onClose]);

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          {starting ? (
            <Animated.View
              style={[
                styles.start,
                {
                  opacity: fade,
                  transform: [{ scale }],
                },
              ]}>
              <Text variant="display" tone="accent" accessibilityRole="header" accessibilityLiveRegion="polite">
                {t('morning.start.title')}
              </Text>
              <Text tone="textMuted">{t('morning.start.body')}</Text>
            </Animated.View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.topRow}>
                  <Text variant="overline" tone="textMuted">
                    {t('morning.overline')}
                  </Text>
                  <Button variant="ghost" label={t('morning.close')} onPress={onClose} />
                </View>
                <Text variant="title" accessibilityRole="header">
                  {t(`morning.greeting.${greetingFor(nowMinutes)}`)}
                </Text>
                <Text tone="textMuted">
                  {t('morning.now', {
                    time: formatClock(nowMinutes) ?? '',
                    day: formatDay(date, i18n.language),
                  })}
                </Text>
                {summary.blocks > 0 ? (
                  <Text variant="bodyStrong">
                    {t('morning.summary', { blocks: summary.blocks, tasks: summary.tasks })}
                    {next ? ` ${t('morning.first', { title: next.title, time: next.start })}` : ''}
                  </Text>
                ) : null}

                <SleepCheckin date={date} settings={settings} saved={saved} onSave={onSave} />

                <Text variant="heading" style={styles.sectionTitle}>
                  {t('morning.cards.title')}
                </Text>
                <DayCards blocks={shown} nowMinutes={nowMinutes} startIndex={startIndex} />
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  variant="secondary"
                  label={t('morning.adjust')}
                  accessibilityHint={t('morning.adjustHint')}
                  onPress={onAdjust}
                  style={styles.button}
                />
                <Button label={t('morning.go')} onPress={() => setStarting(true)} style={styles.button} />
              </View>
            </>
          )}
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
    gap: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  button: { flex: 1 },
  start: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
