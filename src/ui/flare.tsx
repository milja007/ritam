import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BUMP_SCALE, FLARE_DURATION_MS, FLARE_SWELL_MS } from '@/core/theme';

/** Najveći razmak aureole pri bljesku (višekratnik veličine žara). */
const FLARE_HALO_SCALE = 2.6;

/**
 * Jednokratni „nabubri pa se smiri“ (0 → 1 → 0) svaki put kad se `trigger` promijeni na vrijednost
 * veću od 0. `trigger` 0 znači „nema što slaviti“ (prvo crtanje, pad). Uz „smanji kretanje“ ostaje 0.
 */
function usePulse(trigger: number) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (trigger <= 0 || reduceMotion) return;
    pulse.value = 0;
    pulse.value = withSequence(
      withTiming(1, { duration: FLARE_SWELL_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: FLARE_DURATION_MS - FLARE_SWELL_MS, easing: Easing.inOut(Easing.quad) }),
    );
    return () => {
      cancelAnimation(pulse);
      pulse.value = 0;
    };
  }, [pulse, reduceMotion, trigger]);

  return pulse;
}

type FlareProps = {
  /** Mijenja se pri svakom novom povodu; 0 = bez bljeska. */
  trigger: number;
  /** Veličina žara oko kojeg aureola bljesne. */
  size: number;
  /** Boja aureole (boja žara). */
  color: string;
  children: ReactNode;
};

/**
 * Bljesak oko žara (korak 35, animacija niza): aureola u boji žara kratko nabuja i nestane, a žar
 * malo naraste i vrati se. Ukrasno — promjenu čitaču zaslona javlja pozivatelj.
 */
export function Flare({ trigger, size, color, children }: FlareProps) {
  const pulse = usePulse(trigger);
  const halo = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.6,
    transform: [{ scale: 1 + pulse.value * (FLARE_HALO_SCALE - 1) }],
  }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * (BUMP_SCALE - 1) }] }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { borderRadius: size, backgroundColor: color, boxShadow: `0 0 ${size}px ${color}` }, halo]}
      />
      <Animated.View style={core}>{children}</Animated.View>
    </View>
  );
}

/** Sadržaj koji kratko poskoči (naraste i vrati se) uz isti povod kao `Flare`. */
export function Bump({ trigger, children }: { trigger: number; children: ReactNode }) {
  const pulse = usePulse(trigger);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * (BUMP_SCALE - 1) }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
