import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/core/theme';

import { useAppTheme } from './theme';

type ProgressBarProps = {
  /** Udio 0–1 (izvan raspona se ograniči). */
  fraction: number;
  /** Oznaka za čitač zaslona (npr. "Razina 3"). */
  accessibilityLabel: string;
  /** Tekst vrijednosti za čitač zaslona (npr. "30 od 130 XP"). */
  valueText: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Vodoravna traka napretka u boji akcenta (XP). Statična; animacija punjenja dolazi s korakom 35. */
export function ProgressBar({
  fraction,
  accessibilityLabel,
  valueText,
  height = 8,
  style,
}: ProgressBarProps) {
  const { colors } = useAppTheme();
  const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
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
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, borderRadius: height / 2, backgroundColor: colors.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', borderRadius: radius.pill },
  fill: { height: '100%' },
});
