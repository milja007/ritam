import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LanguagePreference } from '@/core/i18n/language';
import { getLanguagePreference, setLanguagePreference } from '@/i18n';

const OPTIONS: readonly LanguagePreference[] = ['system', 'hr', 'en'];

// Privremeni Profil: zasad samo odabir jezika. Boje su minimalne dok ne
// stignu dizajn tokeni (korak 4); odabir se još ne sprema trajno (korak 6/8).
export default function ProfileScreen() {
  const { t } = useTranslation();
  const [preference, setPreference] = useState<LanguagePreference>(getLanguagePreference);
  const isDark = useColorScheme() !== 'light';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const mutedColor = isDark ? '#A0A0A8' : '#5C5C66';
  const borderColor = isDark ? '#2A2A33' : '#D6D6DE';
  const selectedColor = isDark ? '#1E1E28' : '#EEEEF4';

  function choose(option: LanguagePreference) {
    setLanguagePreference(option);
    setPreference(option);
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B10' : '#FFFFFF' }]}>
      <SafeAreaView style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>{t('tabs.profile')}</Text>

        <Text style={[styles.sectionTitle, { color: mutedColor }]}>{t('profile.language.title')}</Text>
        <View accessibilityRole="radiogroup" style={[styles.group, { borderColor }]}>
          {OPTIONS.map((option) => {
            const selected = option === preference;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => choose(option)}
                style={[styles.option, selected && { backgroundColor: selectedColor }]}>
                <Text style={[styles.optionLabel, { color: textColor }]}>
                  {t(`profile.language.${option}`)}
                </Text>
                {selected ? <Text style={[styles.check, { color: textColor }]}>✓</Text> : null}
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
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionLabel: {
    fontSize: 16,
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
  },
});
