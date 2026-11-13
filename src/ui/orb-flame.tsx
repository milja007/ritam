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

import { shouldIgnite, type EmberLevel } from '@/core/ember';
import { ORB_DASHED_INSET, orbFlameColors, type OrbFlame as OrbFlameState } from '@/core/gamification';
import { IGNITE_DURATION_MS, IGNITE_SWELL_MS, ORB_FLICKER_RATIO, ORB_ORBIT_MS } from '@/core/theme';

import { useAppTheme } from './theme';

/** Promjer iskre kao udio promjera avatara. */
const SPARK_SCALE = 0.06;

type OrbFlameProps = {
  flame: OrbFlameState;
  /** Promjer cijelog avatara (s prstenovima). */
  size?: number;
};

/**
 * Orb-plamen avatar (korak 33, platno „Profil“): dva prstena, jezgra čija veličina prati rang i
 * svjetlina zadnjih 7 dana, aureola koja diše i iskre koje kruže po crtkanom prstenu dok traje niz.
 * Ugašen plamen je samo obrub jezgre; kad se prvi put upali dok je ekran otvoren, aureola bljesne
 * (isto pravilo kao paljenje žara dana, `shouldIgnite`). Uz „smanji kretanje“ sve stoji. Čisto ukrasno — značenje
 * (rang, toplina, niz) nosi tekst uz avatar.
 */
export function OrbFlame({ flame, size = 116 }: OrbFlameProps) {
  const { scheme } = useAppTheme();
  const colors = orbFlameColors(flame.heat, scheme);
  const reduceMotion = useReducedMotion();
  const lit = flame.heat !== 'unlit';
  const { pulseMs, sparks } = flame;

  const breath = useSharedValue(0.5);
  const flicker = useSharedValue(0.5);
  const orbit = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || pulseMs <= 0) {
      breath.value = 0.5;
      flicker.value = 0.5;
      return;
    }
    breath.value = 0;
    flicker.value = 0;
    breath.value = withRepeat(withTiming(1, { duration: pulseMs, easing: Easing.inOut(Easing.quad) }), -1, true);
    flicker.value = withRepeat(
      withTiming(1, { duration: Math.round(pulseMs * ORB_FLICKER_RATIO), easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(flicker);
    };
  }, [breath, flicker, pulseMs, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || sparks <= 0) {
      orbit.value = 0;
      return;
    }
    orbit.value = 0;
    orbit.value = withRepeat(withTiming(1, { duration: ORB_ORBIT_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(orbit);
  }, [orbit, reduceMotion, sparks]);

  // Paljenje: plamen koji je bio ugašen dok je Profil stajao otvoren (tab ostaje montiran) upali se
  // uz jednokratan bljesak aureole kad stigne prvi konačni rezultat. Prvo crtanje ne animira.
  const ignite = useSharedValue(0);
  const previousHeat = useRef<EmberLevel | null>(null);
  const heat = flame.heat;
  useEffect(() => {
    const before = previousHeat.current;
    previousHeat.current = heat;
    if (reduceMotion || !shouldIgnite(before, heat)) return;
    ignite.value = withSequence(
      withTiming(1, { duration: IGNITE_SWELL_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: IGNITE_DURATION_MS - IGNITE_SWELL_MS, easing: Easing.inOut(Easing.quad) }),
    );
    return () => {
      cancelAnimation(ignite);
      ignite.value = 0;
    };
  }, [heat, ignite, reduceMotion]);

  const haloStrength = colors.halo;
  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, haloStrength * (0.3 + breath.value * 0.4) + ignite.value * 0.5),
    transform: [{ scale: 1.04 + breath.value * 0.16 + ignite.value * 0.5 }],
  }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.03 }] }));
  const flickerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + flicker.value * 0.45,
    transform: [{ translateY: -flicker.value * 2 }, { scale: 0.92 + flicker.value * 0.12 }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.value * 360}deg` }] }));

  const core = Math.round(size * flame.coreScale);
  const inset = Math.round(size * ORB_DASHED_INSET);
  const spark = Math.max(5, Math.round(size * SPARK_SCALE));
  const orbitRadius = size / 2 - inset;
  const round = { borderRadius: size };

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <View style={[styles.fill, round, styles.ring, { borderColor: colors.ring }]} />
      {/* Crtkani obrub na iOS-u traži jednaku širinu sa svih strana. */}
      <View
        style={[
          styles.dashed,
          round,
          { top: inset, right: inset, bottom: inset, left: inset, borderColor: colors.dashed },
        ]}
      />

      {lit ? (
        <Animated.View
          style={[
            { width: core, height: core, position: 'absolute' },
            round,
            { backgroundColor: colors.glow, boxShadow: `0 0 ${Math.round(core * 0.5)}px ${colors.glow}` },
            haloStyle,
          ]}
        />
      ) : null}

      {lit ? (
        <Animated.View
          style={[
            { width: core, height: core, overflow: 'hidden' },
            round,
            {
              backgroundColor: colors.mid,
              backgroundImage: `radial-gradient(circle at 50% 62%, ${colors.core} 0%, ${colors.mid} 30%, ${colors.glow} 58%, ${colors.edge} 100%)`,
            },
            coreStyle,
          ]}>
          {/* Žarište koje treperi: svijetla mrlja koja se stapa s jezgrom (rub je proziran). */}
          <Animated.View
            style={[
              styles.hotspot,
              round,
              { backgroundImage: `radial-gradient(circle at 50% 50%, ${colors.core} 0%, ${colors.core}00 70%)` },
              flickerStyle,
            ]}
          />
        </Animated.View>
      ) : (
        <View style={[{ width: core, height: core, borderColor: colors.edge }, round, styles.unlit]} />
      )}

      {sparks > 0 ? (
        <Animated.View style={[styles.fill, orbitStyle]}>
          {Array.from({ length: sparks }, (_, index) => {
            // Iskre su jednako razmaknute; prva kreće s vrha.
            const angle = (index / sparks) * 2 * Math.PI - Math.PI / 2;
            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  width: spark,
                  height: spark,
                  borderRadius: spark,
                  left: size / 2 + orbitRadius * Math.cos(angle) - spark / 2,
                  top: size / 2 + orbitRadius * Math.sin(angle) - spark / 2,
                  backgroundColor: colors.spark,
                  boxShadow: `0 0 ${spark}px ${colors.spark}`,
                }}
              />
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  ring: { borderWidth: 1 },
  dashed: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed' },
  hotspot: { position: 'absolute', top: '22%', right: '18%', bottom: '14%', left: '18%' },
  unlit: { borderWidth: 1.5 },
});
