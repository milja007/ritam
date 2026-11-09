import { ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocales } from 'expo-localization';

import { NotificationsSync } from '@/features/notifications';
import { OnboardingGate } from '@/features/onboarding';
import { getLanguagePreference, setLanguagePreference } from '@/i18n';
import { DatabaseGate } from '@/ui/database-gate';
import { AppThemeProvider, navigationThemeFor, useAppTheme } from '@/ui/theme';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <DatabaseGate>
        <OnboardingGate>
          <NotificationsSync />
          <AppTabs />
        </OnboardingGate>
      </DatabaseGate>
    </AppThemeProvider>
  );
}

function AppTabs() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const locales = useLocales();

  // Ako korisnik prati jezik uređaja, a on se promijeni dok app radi — primijeni ga.
  useEffect(() => {
    if (getLanguagePreference() === 'system') setLanguagePreference('system');
  }, [locales]);

  return (
    <ThemeProvider value={navigationThemeFor(theme)}>
      <NativeTabs
        tintColor={theme.colors.accent}
        iconColor={{ default: theme.colors.textMuted, selected: theme.colors.accent }}
        backgroundColor={theme.colors.surface}>
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
