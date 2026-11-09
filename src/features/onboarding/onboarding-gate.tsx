import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { loadSettings } from '@/features/settings';
import { useAppTheme } from '@/ui/theme';

import { OnboardingFlow } from './onboarding-flow';

type Status = 'loading' | 'needed' | 'done';

/** Ako postavke još ne postoje, prikazuje onboarding; inače primijeni spremljeni jezik i prikaže app. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const { colors } = useAppTheme();

  useEffect(() => {
    let active = true;
    // Učitavanje primijeni spremljeni jezik i granice doba dana.
    loadSettings()
      .then((settings) => {
        if (!active) return;
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
  if (status === 'needed') {
    return (
      <OnboardingFlow
        onDone={() => {
          loadSettings().catch((error: unknown) => console.error('Loading settings failed', error));
          setStatus('done');
        }}
      />
    );
  }
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
