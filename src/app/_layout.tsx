import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { useLocales } from 'expo-localization';

import { getLanguagePreference, setLanguagePreference } from '@/i18n';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const locales = useLocales();

  // Ako korisnik prati jezik uređaja, a on se promijeni dok app radi — primijeni ga.
  useEffect(() => {
    if (getLanguagePreference() === 'system') setLanguagePreference('system');
  }, [locales]);

  return (
    <ThemeProvider value={colorScheme === 'light' ? DefaultTheme : DarkTheme}>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>{t('tabs.today')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sun.max" md="today" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="week">
          <NativeTabs.Trigger.Label>{t('tabs.week')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="quests">
          <NativeTabs.Trigger.Label>{t('tabs.quests')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="flag" md="flag" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="habits">
          <NativeTabs.Trigger.Label>{t('tabs.habits')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="repeat" md="repeat" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
