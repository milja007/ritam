import { ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocales } from 'expo-localization';

import { TABS, type TabId } from '@/core/navigation';
import { AuthLinkHandler } from '@/features/auth';
import { NotificationsSync } from '@/features/notifications';
import { OnboardingGate } from '@/features/onboarding';
import { CloudSync } from '@/features/sync';
import { getLanguagePreference, setLanguagePreference } from '@/i18n';
import { DatabaseGate } from '@/ui/database-gate';
import { AppThemeProvider, navigationThemeFor, useAppTheme } from '@/ui/theme';

/** SF Symbol (iOS) i Material ikona (Android) po tabu. */
const TAB_ICONS = {
  day: { sf: 'sun.max', md: 'today' },
  week: { sf: 'calendar', md: 'view_week' },
  month: { sf: 'calendar.badge.clock', md: 'calendar_month' },
  year: { sf: 'square.grid.3x3', md: 'grid_view' },
  profile: { sf: 'person.crop.circle', md: 'person' },
} as const satisfies Record<TabId, { sf: string; md: string }>;

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <DatabaseGate>
        <OnboardingGate>
          <NotificationsSync />
          <AuthLinkHandler />
          <CloudSync />
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
        {TABS.map((tab) => (
          <NativeTabs.Trigger key={tab.id} name={tab.route}>
            <NativeTabs.Trigger.Label>{t(tab.labelKey)}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={TAB_ICONS[tab.id].sf} md={TAB_ICONS[tab.id].md} />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </ThemeProvider>
  );
}
