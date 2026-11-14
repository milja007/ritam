import { View } from 'react-native';

import type { FlamePalette } from '@/core/theme';

import { useAppTheme } from './theme';

type FlameSwatchProps = {
  /** Paleta teme čiji se plamen prikazuje (ne nužno trenutno odabrana tema). */
  palette: FlamePalette;
  size?: number;
  /** Zaključana tema: plamen je prigušen i bez sjaja. */
  dimmed?: boolean;
};

/**
 * Mali plamen u bojama zadane teme — uzorak u biraču tema i na popisu otključanog. Miran (bez
 * animacije) i čisto ukrasan; naziv teme nosi tekst uz njega.
 */
export function FlameSwatch({ palette, size = 36, dimmed = false }: FlameSwatchProps) {
  const { scheme } = useAppTheme();
  const glow = scheme === 'dark' && !dimmed ? { boxShadow: `0 0 ${Math.round(size * 0.45)}px ${palette.flame400}` } : null;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        {
          width: size,
          height: size,
          borderRadius: size,
          opacity: dimmed ? 0.4 : 1,
          backgroundColor: palette.flame400,
          backgroundImage: `radial-gradient(circle at 50% 60%, ${palette.ember50} 0%, ${palette.flame300} 34%, ${palette.flame400} 60%, ${palette.flame600} 100%)`,
        },
        glow,
      ]}
    />
  );
}
