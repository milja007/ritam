import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { clampFraction, FILL_DURATION_MS } from '@/core/theme';

import { useAppTheme } from './theme';

type ProgressBarProps = {
  /** Udio 0–1 (izvan raspona se ograniči). */
  fraction: number;
  /** Oznaka za čitač zaslona (npr. "Razina 3"). */
  accessibilityLabel: string;
  /** Tekst vrijednosti za čitač zaslona (npr. "30 od 130 XP"). */
  valueText: string;
  height?: number;
  /** Boja ispune; zadano akcent teme. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Vodoravna traka napretka u boji akcenta (XP, trajanje aktivnosti). Ispuna klizi do nove
 * vrijednosti (korak 35); uz „smanji kretanje“ skoči odmah. Prvo crtanje je bez animacije.
 */
export function ProgressBar({
  fraction,
  accessibilityLabel,
  valueText,
  height = 8,
  color,
  style,
}: ProgressBarProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const clamped = clampFraction(fraction);
  const shown = useSharedValue(clamped);

  useEffect(() => {
    shown.value = reduceMotion
      ? clamped
      : withTiming(clamped, { duration: FILL_DURATION_MS, easing: Easing.out(Easing.cubic) });
  }, [clamped, reduceMotion, shown]);

  const fill = useAnimatedStyle(() => ({ width: `${shown.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100), text: valueText }}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: colors.surfaceRaised },
        style,
      ]}>
      <Animated.View
        style={[styles.fill, { borderRadius: height / 2, backgroundColor: color ?? colors.accent }, fill]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
