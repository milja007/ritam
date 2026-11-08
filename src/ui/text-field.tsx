import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing } from '@/core/theme';

import { Text } from './text';
import { useAppTheme } from './theme';

export type TextFieldProps = TextInputProps & { label: string };

/** Polje za unos teksta s nazivom iznad. */
export function TextField({ label, style, ...rest }: TextFieldProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.accent}
        style={[
          theme.typography.body,
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
