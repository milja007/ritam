import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getSettings } from '@/db/repos';
import { setLanguagePreference } from '@/i18n';
import { useAppTheme } from '@/ui/theme';

import { OnboardingFlow } from './onboarding-flow';

type Status = 'loading' | 'needed' | 'done';

/** Ako postavke još ne postoje, prikazuje onboarding; inače primijeni spremljeni jezik i prikaže app. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const { colors } = useAppTheme();

  useEffect(() => {
    let active = true;
    getSettings(getDb(), LOCAL_USER_ID)
      .then((settings) => {
        if (!active) return;
        if (settings) setLanguagePreference(settings.language);
        setStatus(settings ? 'done' : 'needed');
      })
      .catch((error: unknown) => {
        // Neispravan zapis postavki: ponovi onboarding (upsert ga prepisuje).
        console.error('Loading settings failed', error);
        if (active) setStatus('needed');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'done') return children;
  if (status === 'needed') return <OnboardingFlow onDone={() => setStatus('done')} />;
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
