import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LanguagePreference } from '@/core/i18n/language';
import { radius, spacing } from '@/core/theme';
import { getLanguagePreference, setLanguagePreference } from '@/i18n';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

const OPTIONS: readonly LanguagePreference[] = ['system', 'hr', 'en'];

// Privremeni Profil: zasad samo odabir jezika; odabir se još ne sprema trajno (korak 6/8).
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [preference, setPreference] = useState<LanguagePreference>(getLanguagePreference);

  function choose(option: LanguagePreference) {
    setLanguagePreference(option);
    setPreference(option);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.content}>
        <Text variant="title" style={styles.title}>
          {t('tabs.profile')}
        </Text>

        <Text variant="overline" tone="textMuted">
          {t('profile.language.title')}
        </Text>
        <View
          accessibilityRole="radiogroup"
          style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {OPTIONS.map((option) => {
            const selected = option === preference;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => choose(option)}
                style={[styles.option, selected && { backgroundColor: colors.surfaceRaised }]}>
                <Text>{t(`profile.language.${option}`)}</Text>
                {selected ? (
                  <Text variant="bodyStrong" tone="accent">
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xxs,
  },
});
