import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
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

import { DICTATION_BREATH_MS, DICTATION_GLOW_SCALE, DICTATION_LEVEL_MS } from '@/core/theme';

import { useAppTheme } from './theme';

export const DICTATION_BUTTON_SIZE = 44;

type DictationButtonProps = {
  listening: boolean;
  /** Dopuštenje se traži / prepoznavanje se pali. */
  starting: boolean;
  /** Glasnoća 0–1: aureola žara raste dok korisnik govori. */
  level: number;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Mikrofon uz polje (korak 30). Dok sluša, gumb gori bojom plamena, a aureola oko njega diše i
 * raste s glasom — kao žar koji se raspiruje. Uz „smanji kretanje“ aureola stoji mirno.
 */
export function DictationButton({ listening, starting, level, disabled, onPress }: DictationButtonProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const voice = useSharedValue(0);

  useEffect(() => {
    if (!listening || reduceMotion) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DICTATION_BREATH_MS / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: DICTATION_BREATH_MS / 2, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(breath);
  }, [breath, listening, reduceMotion]);

  useEffect(() => {
    const target = listening ? level : 0;
    voice.value = reduceMotion ? target : withTiming(target, { duration: DICTATION_LEVEL_MS });
  }, [level, listening, reduceMotion, voice]);

  const haloStyle = useAnimatedStyle(() => {
    const grow = 1 + (DICTATION_GLOW_SCALE - 1) * (0.25 + 0.15 * breath.value + 0.6 * voice.value);
    return {
      opacity: listening ? 0.28 + 0.3 * voice.value : 0,
      transform: [{ scale: listening ? grow : 1 }],
    };
  });

  const active = listening || starting;
  const glyph = listening ? theme.colors.onAccent : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? t('dictation.stop') : t('dictation.start')}
      accessibilityHint={listening ? undefined : t('dictation.hint')}
      accessibilityState={{ disabled: !!disabled, busy: starting, selected: listening }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.hit, { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: theme.flame.flame400 }, haloStyle]}
      />
      <View
        style={[
          styles.button,
          {
            backgroundColor: listening ? theme.colors.accent : theme.colors.surface,
            borderColor: active ? theme.colors.accent : theme.colors.border,
          },
        ]}>
        <MicGlyph color={glyph} />
      </View>
    </Pressable>
  );
}

/** Mikrofon nacrtan od oblika (app nema biblioteku ikona): glava, luk držača i stalak. */
function MicGlyph({ color }: { color: string }) {
  return (
    <View style={styles.glyph}>
      <View style={[styles.capsule, { backgroundColor: color }]} />
      <View style={[styles.cradle, { borderColor: color }]} />
      <View style={[styles.stem, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: DICTATION_BUTTON_SIZE,
    height: DICTATION_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: DICTATION_BUTTON_SIZE,
    height: DICTATION_BUTTON_SIZE,
    borderRadius: DICTATION_BUTTON_SIZE / 2,
  },
  button: {
    width: DICTATION_BUTTON_SIZE,
    height: DICTATION_BUTTON_SIZE,
    borderRadius: DICTATION_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { width: 16, height: 22, alignItems: 'center' },
  capsule: { width: 8, height: 13, borderRadius: 4 },
  cradle: {
    position: 'absolute',
    top: 6,
    width: 14,
    height: 11,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderLeftWidth: 1.75,
    borderRightWidth: 1.75,
    borderBottomWidth: 1.75,
    borderTopWidth: 0,
  },
  stem: { position: 'absolute', bottom: 0, width: 1.75, height: 5 },
});
