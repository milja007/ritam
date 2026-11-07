import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import type { SemanticColors, TypographyVariant } from '@/core/theme';

import { useAppTheme } from './theme';

type TextTone = Extract<
  keyof SemanticColors,
  'text' | 'textMuted' | 'accent' | 'onAccent' | 'success' | 'danger' | 'info'
>;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
};

/** Tekst s tipografskim tokenom i semantičkom bojom teme. */
export function Text({ variant = 'body', tone = 'text', style, ...rest }: TextProps) {
  const theme = useAppTheme();
  return <RNText style={[theme.typography[variant], { color: theme.colors[tone] }, style]} {...rest} />;
}
