import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';

import { Text } from './text';
import { useAppTheme } from './theme';

export type Choice<T> = { value: T; label: string };

export type ChoiceGroupProps<T> = {
  choices: readonly Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** `row` = segmentirani prekidač, `list` = popis s kvačicom. */
  layout?: 'row' | 'list';
  accessibilityLabel?: string;
};

/** Odabir jedne opcije (radio grupa). */
export function ChoiceGroup<T extends string | number>({
  choices,
  selected,
  onSelect,
  layout = 'list',
  accessibilityLabel,
}: ChoiceGroupProps<T>) {
  const { colors } = useAppTheme();
  const isRow = layout === 'row';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.group,
        isRow && styles.row,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}>
      {choices.map((choice) => {
        const isSelected = choice.value === selected;
        return (
          <Pressable
            key={String(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onSelect(choice.value)}
            style={[
              styles.option,
              isRow && styles.rowOption,
              isSelected && { backgroundColor: isRow ? colors.accent : colors.surfaceRaised },
            ]}>
            <Text
              variant={isSelected ? 'bodyStrong' : 'body'}
              tone={isRow && isSelected ? 'onAccent' : 'text'}>
              {choice.label}
            </Text>
            {!isRow && isSelected ? (
              <Text variant="bodyStrong" tone="accent">
                ✓
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xxs,
  },
  rowOption: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
