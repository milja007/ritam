import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { DoneEffectId } from '@/core/gamification';
import {
  BUMP_SCALE,
  DONE_BURST_MS,
  DONE_SPARK_REACH,
  DONE_SPARKS,
  DONE_WAVE_SCALE,
  FLARE_DURATION_MS,
  FLARE_SWELL_MS,
} from '@/core/theme';

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

/** Jednokratni 0 → 1 pri svakom novom `trigger` > 0 (iskre lete, val se širi); uz „smanji kretanje“ ostaje 0. */
function useBurst(trigger: number) {
  const reduceMotion = useReducedMotion();
  const burst = useSharedValue(0);
  useEffect(() => {
    if (trigger <= 0 || reduceMotion) return;
    burst.value = 0;
    burst.value = withTiming(1, { duration: DONE_BURST_MS, easing: Easing.out(Easing.cubic) });
    return () => {
      cancelAnimation(burst);
      burst.value = 0;
    };
  }, [burst, reduceMotion, trigger]);
  return burst;
}

/**
 * Animacija točke kad se aktivnost prijavi kao odrađena (korak 32b): uvijek bljesak (`Flare`), a uz
 * otključane i odabrane „Iskre“ iz točke polete iskre, uz „Val“ se od nje raširi svjetleći prsten.
 * Ukrasno.
 */
export function DoneFlare({ effect, ...props }: FlareProps & { effect: DoneEffectId }) {
  const burst = useBurst(effect === 'flare' ? 0 : props.trigger);
  return (
    <View style={{ width: props.size, height: props.size }}>
      {effect === 'sparks'
        ? Array.from({ length: DONE_SPARKS }, (_, index) => (
            <BurstSpark key={index} index={index} burst={burst} size={props.size} color={props.color} />
          ))
        : null}
      {effect === 'wave' ? <Wave burst={burst} size={props.size} color={props.color} /> : null}
      <Flare {...props} />
    </View>
  );
}

function BurstSpark({
  index,
  burst,
  size,
  color,
}: {
  index: number;
  burst: SharedValue<number>;
  size: number;
  color: string;
}) {
  // Iskre se razlete jednako razmaknute, prva prema gore-desno; svaka druga leti malo kraće.
  const angle = (index / DONE_SPARKS) * 2 * Math.PI - Math.PI / 3;
  const reach = size * DONE_SPARK_REACH * (index % 2 === 0 ? 1 : 0.75);
  const spark = Math.max(3, Math.round(size * 0.4));
  const style = useAnimatedStyle(() => ({
    opacity: burst.value > 0 && burst.value < 1 ? 1 - burst.value : 0,
    transform: [
      { translateX: Math.cos(angle) * reach * burst.value },
      { translateY: Math.sin(angle) * reach * burst.value },
      { scale: 1 - burst.value * 0.5 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: spark,
          height: spark,
          borderRadius: spark,
          left: (size - spark) / 2,
          top: (size - spark) / 2,
          backgroundColor: color,
          boxShadow: `0 0 ${spark}px ${color}`,
        },
        style,
      ]}
    />
  );
}

function Wave({ burst, size, color }: { burst: SharedValue<number>; size: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: burst.value > 0 && burst.value < 1 ? (1 - burst.value) * 0.9 : 0,
    transform: [{ scale: 1 + burst.value * (DONE_WAVE_SCALE - 1) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.fill, { borderRadius: size, borderWidth: 1.5, borderColor: color, boxShadow: `0 0 ${size}px ${color}` }, style]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
