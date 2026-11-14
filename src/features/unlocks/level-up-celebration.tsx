import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type LevelProgress, type LevelUp, nextUnlocks, titleAt } from '@/core/gamification';
import {
  type BurstSpark,
  burstSparks,
  type ColorThemeId,
  countUpLevels,
  FILL_DURATION_MS,
  flamePalettes,
  LEVEL_UP_BURST_MS,
  LEVEL_UP_COUNT_STEP_MS,
  LEVEL_UP_FILL_MS,
  LEVEL_UP_REVEAL_MS,
  LEVEL_UP_SPARKS,
  radius,
  spacing,
} from '@/core/theme';
import { Button } from '@/ui/button';
import { FlameSwatch } from '@/ui/flame-swatch';
import { Text } from '@/ui/text';
import { setColorTheme, useAppTheme } from '@/ui/theme';

import { unlockRow } from './unlock-text';

/** Pozornica praska: plamen u sredini, iskre lete do ruba. */
const STAGE = 220;
const CORE = 92;
const SPARK = 9;
const BAR_HEIGHT = 10;
/** Odakle traka kreće prije nego što se napuni (udio). */
const BAR_START = 0.45;
/** Koliko broj razine poskoči pri svakom koraku odbrojavanja. */
const NUMBER_BUMP = 1.22;

type Props = {
  levelUp: LevelUp;
  /** Napredak unutar nove razine (traka se nakon praska smiri na ovaj udio). */
  level: LevelProgress;
  onClose: () => void;
};

/**
 * Slavlje nove razine preko cijelog ekrana (korak 35; koncept: „traka se napuni, burst čestica,
 * novi level broj se odbroji“). Redom: traka se napuni → broj razine odbroji i poskoči, iskre
 * polete iz plamena → traka se smiri na napredak nove razine, izroni popis otključanog.
 * Uz „smanji kretanje“ odmah stoji krajnje stanje, bez praska. Bez haptike (Ž11).
 */
export function LevelUpCelebration({ levelUp, level, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, flame, scheme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const steps = useMemo(() => countUpLevels(levelUp.from, levelUp.to), [levelUp.from, levelUp.to]);
  const sparks = useMemo(() => burstSparks(LEVEL_UP_SPARKS), []);
  const [step, setStep] = useState(0);

  const bar = useSharedValue(BAR_START);
  const burst = useSharedValue(0);
  const bump = useSharedValue(0);
  const reveal = useSharedValue(0);

  const countMs = (steps.length - 1) * LEVEL_UP_COUNT_STEP_MS;
  const target = level.fraction;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(t('unlocks.levelUp.a11y', { level: levelUp.to }));
  }, [levelUp.to, t]);

  useEffect(() => {
    if (reduceMotion) {
      bar.value = target;
      burst.value = 0;
      reveal.value = 1;
      return;
    }
    bar.value = BAR_START;
    bar.value = withSequence(
      withTiming(1, { duration: LEVEL_UP_FILL_MS, easing: Easing.inOut(Easing.cubic) }),
      withDelay(countMs + LEVEL_UP_BURST_MS / 2, withTiming(target, { duration: FILL_DURATION_MS })),
    );
    burst.value = 0;
    burst.value = withDelay(
      LEVEL_UP_FILL_MS + countMs - LEVEL_UP_COUNT_STEP_MS,
      withTiming(1, { duration: LEVEL_UP_BURST_MS, easing: Easing.out(Easing.cubic) }),
    );
    reveal.value = 0;
    reveal.value = withDelay(
      LEVEL_UP_FILL_MS + countMs + LEVEL_UP_BURST_MS / 3,
      withTiming(1, { duration: LEVEL_UP_REVEAL_MS, easing: Easing.out(Easing.quad) }),
    );
    return () => {
      cancelAnimation(bar);
      cancelAnimation(burst);
      cancelAnimation(reveal);
    };
  }, [bar, burst, reveal, countMs, reduceMotion, target]);

  // Odbrojavanje razine: kad se traka napuni, broj ide korak po korak do nove razine.
  useEffect(() => {
    if (reduceMotion || steps.length < 2) return;
    const timers = steps.slice(1).map((_, i) =>
      setTimeout(
        () => {
          setStep(i + 1);
          bump.value = withSequence(
            withTiming(1, { duration: LEVEL_UP_COUNT_STEP_MS * 0.4, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: LEVEL_UP_COUNT_STEP_MS * 0.6, easing: Easing.in(Easing.quad) }),
          );
        },
        LEVEL_UP_FILL_MS + i * LEVEL_UP_COUNT_STEP_MS,
      ),
    );
    return () => {
      for (const id of timers) clearTimeout(id);
      cancelAnimation(bump);
    };
  }, [bump, reduceMotion, steps]);

  const shownLevel = reduceMotion ? levelUp.to : (steps[step] ?? levelUp.to);

  const barStyle = useAnimatedStyle(() => ({ width: `${Math.min(1, Math.max(0, bar.value)) * 100}%` }));
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + bump.value * (NUMBER_BUMP - 1) }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [{ scale: 0.8 + burst.value * 1.6 }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + interpolate(burst.value, [0, 0.2, 1], [0, 0.14, 0]) }],
  }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }],
  }));

  const newTheme = [...levelUp.unlocks]
    .reverse()
    .find((unlock): unlock is Extract<typeof unlock, { kind: 'theme' }> => unlock.kind === 'theme');
  const next = nextUnlocks(levelUp.to);
  const sparkColors = [flame.flame300, flame.ember200, flame.flame400] as const;

  function tryTheme(theme: ColorThemeId) {
    setColorTheme(theme);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Gotovo neprozirna pozadina: ekran ispod se nazire, ali ne odvlači pažnju. */}
      <View style={[styles.backdrop, { backgroundColor: `${colors.background}F5` }]} accessibilityViewIsModal>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View
              style={styles.stage}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden>
              <Animated.View
                style={[
                  styles.halo,
                  { backgroundColor: flame.flame400, boxShadow: `0 0 ${CORE / 2}px ${flame.flame400}` },
                  haloStyle,
                ]}
              />
              {sparks.map((spark, i) => (
                <Spark key={i} spark={spark} progress={burst} color={sparkColors[spark.tone]} glow={scheme === 'dark'} />
              ))}
              <Animated.View style={coreStyle}>
                <FlameSwatch palette={flame} size={CORE} />
              </Animated.View>
            </View>

            <Text variant="overline" tone="accent">
              {t('unlocks.levelUp.overline')}
            </Text>
            <Animated.Text
              accessibilityRole="header"
              accessibilityLabel={t('unlocks.level', { level: levelUp.to })}
              style={[styles.number, { color: colors.text }, numberStyle]}>
              {shownLevel}
            </Animated.Text>
            <Text variant="heading" style={styles.center}>
              {t(`unlocks.titles.${titleAt(shownLevel)}`)}
            </Text>

            <View
              style={[styles.track, { backgroundColor: colors.surfaceRaised }]}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden>
              <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, barStyle]} />
            </View>
            <Text variant="caption" tone="textMuted" style={[styles.center, styles.tabular]}>
              {t('progress.toNextLevel', { xp: level.xpIntoLevel, total: level.xpForNext, level: level.level + 1 })}
            </Text>

            <Animated.View style={[styles.lower, revealStyle]}>
              {levelUp.unlocks.length > 0 ? (
                <View style={[styles.unlocks, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text variant="overline" tone="textMuted" accessibilityRole="header">
                    {t('unlocks.levelUp.unlocked')}
                  </Text>
                  {levelUp.unlocks.map((unlock) => (
                    <View key={`${unlock.kind}-${unlock.level}`} style={styles.unlockRow}>
                      {unlock.kind === 'theme' ? (
                        <FlameSwatch palette={flamePalettes[unlock.theme]} size={28} />
                      ) : (
                        <View style={[styles.titleMark, { borderColor: colors.accent }]}>
                          <Text variant="caption" tone="accent">
                            ✦
                          </Text>
                        </View>
                      )}
                      <Text variant="bodyStrong" style={styles.unlockText}>
                        {unlockRow(t, unlock)}
                      </Text>
                      <Text variant="caption" tone="textMuted" style={styles.tabular}>
                        {t('unlocks.level', { level: unlock.level })}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text tone="textMuted" style={styles.center}>
                  {next === null
                    ? t('unlocks.levelUp.nothingAll')
                    : t('unlocks.levelUp.nothing', { level: next.level })}
                </Text>
              )}

              <View style={styles.actions}>
                {newTheme !== undefined ? (
                  <Button
                    label={t('unlocks.levelUp.tryTheme', { name: t(`unlocks.themes.${newTheme.theme}`) })}
                    onPress={() => tryTheme(newTheme.theme)}
                  />
                ) : null}
                <Button
                  variant={newTheme !== undefined ? 'ghost' : 'primary'}
                  label={t('unlocks.levelUp.continue')}
                  onPress={onClose}
                />
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

type SparkProps = { spark: BurstSpark; progress: SharedValue<number>; color: string; glow: boolean };

/** Jedna iskra praska: poleti iz plamena u svom smjeru, pa izblijedi i smanji se. */
function Spark({ spark, progress, color, glow }: SparkProps) {
  const size = Math.max(3, Math.round(SPARK * spark.size));
  const reach = (STAGE / 2) * spark.reach;
  const dx = Math.cos(spark.angle) * reach;
  const dy = Math.sin(spark.angle) * reach;
  const { delay } = spark;
  const style = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (progress.value - delay) / (1 - delay)));
    return {
      opacity: interpolate(local, [0, 0.08, 0.65, 1], [0, 1, 1, 0]),
      transform: [{ translateX: dx * local }, { translateY: dy * local }, { scale: 1 - local * 0.5 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.spark,
        { width: size, height: size, borderRadius: size, backgroundColor: color },
        glow ? { boxShadow: `0 0 ${size}px ${color}` } : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: CORE, height: CORE, borderRadius: CORE },
  spark: { position: 'absolute' },
  number: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  track: {
    alignSelf: 'stretch',
    height: BAR_HEIGHT,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: BAR_HEIGHT, borderRadius: radius.pill },
  lower: { alignSelf: 'stretch', gap: spacing.lg, marginTop: spacing.lg },
  unlocks: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unlockText: { flex: 1 },
  titleMark: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.sm },
});
