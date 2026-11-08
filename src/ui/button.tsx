import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { radius, spacing } from '@/core/theme';

import { Text } from './text';
import { useAppTheme } from './theme';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
};

/** Gumb s varijantama: primary (akcent), secondary (površina), ghost (samo tekst). */
export function Button({ label, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const { colors } = useAppTheme();
  const inactive = disabled || loading;
  const background =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surface : 'transparent';
  const tone = variant === 'primary' ? 'onAccent' : variant === 'ghost' ? 'accent' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          opacity: inactive ? 0.45 : state.pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? <ActivityIndicator color={colors[tone]} /> : null}
      <Text variant="bodyStrong" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
