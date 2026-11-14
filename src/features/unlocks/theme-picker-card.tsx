import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { isThemeUnlocked, themeUnlockLevel } from '@/core/gamification';
import { COLOR_THEMES, type ColorThemeId, flamePalettes, radius, spacing } from '@/core/theme';
import { useProgress } from '@/features/progress';
import { FlameSwatch } from '@/ui/flame-swatch';
import { Text } from '@/ui/text';
import { setColorTheme, useAppTheme } from '@/ui/theme';

const SWATCH = 32;
/** Najmanja visina retka — dodirna meta od barem 44 pt. */
const ROW_MIN_HEIGHT = 52;

/**
 * Birač teme boja plamena na Profilu (korak 38). Tema mijenja akcent, žarove i orb u cijeloj
 * aplikaciji i vrijedi odmah. Teme otključavaju razine (korak 32): zaključana tema je prigušena,
 * pokazuje svoju razinu i na dodir objasni kad se otključava — ne može se odabrati.
 */
export function ThemePickerCard({ today, checkinDay }: { today: string; checkinDay: string }) {
  const { t } = useTranslation();
  const { colors, colorTheme } = useAppTheme();
  const progress = useProgress(today, checkinDay);
  const [lockedInfo, setLockedInfo] = useState<ColorThemeId | null>(null);
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (progress.status === 'loading') {
    return (
      <View style={cardStyle}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  // Ako se napredak ne učita, zadana tema ostaje dostupna, ostale zaključane.
  const level = progress.status === 'ready' ? progress.summary.level.level : 1;

  return (
    <View style={cardStyle}>
      <Text variant="caption" tone="textMuted">
        {t('unlocks.picker.hint')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('unlocks.picker.group')} style={styles.list}>
        {COLOR_THEMES.map((id) => {
          const name = t(`unlocks.themes.${id}`);
          const unlocked = isThemeUnlocked(id, level);
          const selected = id === colorTheme;
          const unlockLevel = themeUnlockLevel(id);
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !unlocked }}
              accessibilityLabel={unlocked ? name : t('unlocks.picker.lockedA11y', { name, level: unlockLevel })}
              onPress={() => {
                if (unlocked) {
                  setLockedInfo(null);
                  setColorTheme(id);
                } else {
                  setLockedInfo((current) => (current === id ? null : id));
                }
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: selected ? colors.accent : 'transparent',
                  backgroundColor: selected ? colors.surfaceRaised : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <FlameSwatch palette={flamePalettes[id]} size={SWATCH} dimmed={!unlocked} />
              <Text variant={selected ? 'bodyStrong' : 'body'} tone={unlocked ? 'text' : 'textMuted'} style={styles.name}>
                {name}
              </Text>
              {selected ? (
                <Text variant="caption" tone="accent">
                  {t('unlocks.picker.selected')} ✓
                </Text>
              ) : unlocked ? null : (
                <View style={[styles.lock, { borderColor: colors.border }]}>
                  <Text variant="caption" tone="textMuted" style={styles.tabular}>
                    {t('unlocks.picker.locked', { level: unlockLevel })}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {lockedInfo !== null ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {t('unlocks.picker.lockedInfo', {
            name: t(`unlocks.themes.${lockedInfo}`),
            level: themeUnlockLevel(lockedInfo),
            current: level,
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { gap: spacing.xs },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  name: { flex: 1 },
  lock: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
