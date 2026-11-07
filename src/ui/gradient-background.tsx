import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { type DayPhase, linearGradientCss } from '@/core/theme';

import { useAppTheme } from './theme';

export type GradientBackgroundProps = PropsWithChildren<ViewProps & { phase?: DayPhase }>;

/**
 * Pozadina s gradijentom doba dana (zadano: trenutna faza iz teme).
 * Koristi ugrađeni RN stil `backgroundImage` — bez dodatnih paketa;
 * `backgroundColor` je rezerva ako gradijent nije podržan.
 */
export function GradientBackground({ phase, style, children, ...rest }: GradientBackgroundProps) {
  const theme = useAppTheme();
  const gradient = theme.gradients[phase ?? theme.phase];
  return (
    <View
      style={[
        styles.fill,
        { backgroundColor: theme.colors.background, backgroundImage: linearGradientCss(gradient) },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
