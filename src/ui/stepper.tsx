import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';

import { Text } from './text';
import { useAppTheme } from './theme';

export type StepperProps = {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrease?: boolean;
  canIncrease?: boolean;
};

/** Red s nazivom, vrijednošću i gumbima − / + (npr. vrijeme po 15 min). */
export function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  canDecrease = true,
  canIncrease = true,
}: StepperProps) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment' && canIncrease) onIncrease();
        if (event.nativeEvent.actionName === 'decrement' && canDecrease) onDecrease();
      }}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text tone="textMuted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.controls}>
        <StepButton symbol="−" label={decreaseLabel} onPress={onDecrease} disabled={!canDecrease} />
        <Text variant="heading" style={styles.value}>
          {value}
        </Text>
        <StepButton symbol="+" label={increaseLabel} onPress={onIncrease} disabled={!canIncrease} />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  label,
  onPress,
  disabled,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surfaceRaised, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}>
      <Text variant="heading" tone="accent">
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: { minWidth: 96, textAlign: 'center', fontVariant: ['tabular-nums'] },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
