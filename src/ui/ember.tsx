import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { emberColor, railColors, shouldIgnite, type EmberLevel, type RailState } from '@/core/ember';
import { IGNITE_DURATION_MS, IGNITE_SWELL_MS, radius } from '@/core/theme';

import { useAppTheme } from './theme';

const PULSE_MS = 1800;

type OrbProps = { size?: number };

/**
 * Orb-plamen: označava „sada“ na traci dana. Jezgra je mirna, aureola oko nje polako diše;
 * uz uključeno „smanji kretanje“ aureola stoji. Čisto ukrasno — značenje nosi tekst uz orb.
 */
export function Orb({ size = 26 }: OrbProps) {
  const { scheme } = useAppTheme();
  const { orb } = railColors(scheme);
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
    transform: [{ scale: 1.35 + pulse.value * 0.35 }],
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: size, backgroundColor: orb.glow, boxShadow: `0 0 ${size * 0.6}px ${orb.glow}` },
          halo,
        ]}
      />
      <View
        style={[
          styles.fill,
          {
            borderRadius: size,
            backgroundColor: orb.mid,
            backgroundImage: `radial-gradient(circle at 50% 60%, ${orb.core} 0%, ${orb.mid} 38%, ${orb.glow} 62%, ${orb.edge} 100%)`,
          },
        ]}
      />
    </View>
  );
}

type RailDotProps = { state: Exclude<RailState, 'now'>; size?: number };

/** Točka na traci dana: svijetli (odrađeno), pola, ugašen žar ili tek ocrtan plan. */
export function RailDot({ state, size = 10 }: RailDotProps) {
  const { scheme } = useAppTheme();
  const colors = railColors(scheme);
  if (state === 'ahead') return <View style={{ width: size, height: size }} />;
  const style =
    state === 'lit'
      ? { backgroundColor: colors.lit, boxShadow: `0 0 8px ${colors.lit}` }
      : state === 'half'
        ? { backgroundColor: colors.half, borderWidth: 2, borderColor: colors.lit }
        : { borderWidth: 2, borderColor: colors.ring };
  return <View style={[{ width: size, height: size, borderRadius: radius.pill }, style]} />;
}

type RailLineProps = { kind: 'burnt' | 'ahead' };

/** Linija trake: puna (izgorjela) iza plamena, crtkana (plan) ispred njega. */
export function RailLineView({ kind }: RailLineProps) {
  const { scheme } = useAppTheme();
  const colors = railColors(scheme);
  return kind === 'burnt' ? (
    <View style={[styles.line, { backgroundColor: colors.burnt }]} />
  ) : (
    // Crtkani obrub na iOS-u traži jednaku širinu sa svih strana, pa je linija uski okvir.
    <View style={[styles.line, styles.dashed, { borderColor: colors.ahead }]} />
  );
}

type EmberProps = {
  level: EmberLevel;
  size: number;
  /** Današnji dan: obrub u boji plamena umjesto ispune. */
  today?: boolean;
  /** Sjaj oko žara; isključi za guste prikaze (godina). */
  glow?: boolean;
};

/** Žar jednog dana: svjetlina znači dnevni rezultat; ugašen žar je samo obrub. */
export function Ember({ level, size, today = false, glow: withGlow = true }: EmberProps) {
  const { scheme, colors } = useAppTheme();
  const { fill, on, glow } = emberColor(level, scheme);
  const base = { width: size, height: size, borderRadius: radius.pill };
  if (today) {
    return (
      <View
        style={[
          base,
          { borderWidth: Math.min(2, size / 4), borderColor: colors.accent },
          withGlow ? { boxShadow: `0 0 ${size * 0.5}px ${colors.accent}` } : null,
        ]}
      />
    );
  }
  if (fill === null) return <View style={[base, { borderWidth: Math.min(1.5, size / 5), borderColor: on }]} />;
  return (
    <View
      style={[
        base,
        { backgroundColor: fill },
        withGlow && glow > 0 && scheme === 'dark' ? { boxShadow: `0 0 ${Math.round(size * 0.7 * glow)}px ${fill}` } : null,
      ]}
    />
  );
}

/** Najveći razmak aureole pri paljenju (višekratnik veličine žara). */
const IGNITE_HALO_SCALE = 2.4;

/**
 * Žar dana koji se **upali** kad dan dobije konačni rezultat (Ž9, nakon večernjeg upita): aureola
 * kratko nabuja oko žara i smiri se, a sam žar malo naraste i vrati se na svoju veličinu.
 * Pali se samo prijelaz iz ugašenog u upaljeni (`shouldIgnite`) — prvo crtanje i gašenje ne animiraju.
 * Uz uključeno „smanji kretanje“ odmah stoji krajnje stanje.
 */
export function EmberIgnite({ level, size, glow = true }: EmberProps) {
  const { scheme } = useAppTheme();
  const { fill } = emberColor(level, scheme);
  const reduceMotion = useReducedMotion();
  const ignite = useSharedValue(0);
  // Razina s prošlog crtanja; `null` na prvom, da se već upaljen dan ne pali ponovo.
  const previous = useRef<EmberLevel | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = level;
    if (reduceMotion || !shouldIgnite(before, level)) return;
    ignite.value = withSequence(
      withTiming(1, { duration: IGNITE_SWELL_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: IGNITE_DURATION_MS - IGNITE_SWELL_MS, easing: Easing.inOut(Easing.quad) }),
    );
    return () => cancelAnimation(ignite);
  }, [ignite, level, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: ignite.value * 0.55,
    transform: [{ scale: 1 + ignite.value * (IGNITE_HALO_SCALE - 1) }],
  }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + ignite.value * 0.18 }] }));

  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      {fill === null ? null : (
        <Animated.View
          style={[
            styles.fill,
            { borderRadius: size, backgroundColor: fill, boxShadow: `0 0 ${size}px ${fill}` },
            halo,
          ]}
        />
      )}
      <Animated.View style={core}>
        <Ember level={level} size={size} glow={glow} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  line: { flex: 1, width: 2, borderRadius: 1 },
  dashed: { borderWidth: 1, borderStyle: 'dashed' },
});
