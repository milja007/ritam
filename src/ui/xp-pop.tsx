import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { typography, XP_POP_DURATION_MS, XP_POP_IN_MS, XP_POP_RISE } from '@/core/theme';

import { useAppTheme } from './theme';

type XpPopProps = {
  /** Koliko je XP-a upravo dobiveno; 0 = ništa se ne prikazuje. */
  gain: number;
  /** Mijenja se pri svakom novom dobitku, da isti iznos dvaput zaredom ponovo iskoči. */
  trigger: number;
  /** Tekst, npr. „+10 XP“. */
  text: string;
};

/**
 * „+N XP“ koji kratko iskoči kad XP naraste (korak 35): pojavi se, stoji i izblijedi dok se diže.
 * Uz „smanji kretanje“ samo se pojavi i izblijedi na mjestu. Ukrasno — dobitak čitaču zaslona
 * javlja pozivatelj.
 */
export function XpPop({ gain, trigger, text }: XpPopProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  // 0 skriveno → 1 vidljivo → 2 izblijedjelo.
  const stage = useSharedValue(0);

  useEffect(() => {
    if (gain <= 0) {
      stage.value = 0;
      return;
    }
    stage.value = 0;
    stage.value = withSequence(
      withTiming(1, { duration: XP_POP_IN_MS, easing: Easing.out(Easing.quad) }),
      withTiming(2, { duration: XP_POP_DURATION_MS - XP_POP_IN_MS, easing: Easing.in(Easing.quad) }),
    );
    return () => cancelAnimation(stage);
  }, [gain, trigger, stage]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(stage.value, [0, 1, 1.4, 2], [0, 1, 1, 0]),
    transform: [{ translateY: reduceMotion ? 0 : -XP_POP_RISE * (stage.value / 2) }],
  }));

  if (gain <= 0) return null;
  return (
    <Animated.Text
      accessible={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[typography.bodyStrong, { color: colors.accent }, style]}>
      {text}
    </Animated.Text>
  );
}
