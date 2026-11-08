import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/core/theme';
import migrations from '@/db/migrations/migrations';
import { getDb } from '@/db/open';

import { GradientBackground } from './gradient-background';
import { Text } from './text';
import { useAppTheme } from './theme';

/** Primjenjuje migracije lokalne baze prije prikaza appa; dok traju — loader, ako padnu — poruka. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(getDb(), migrations);
  const { t } = useTranslation();
  const theme = useAppTheme();

  if (success) return children;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.content}>
        {error ? (
          <Text tone="danger" style={styles.message}>
            {t('database.error')}
          </Text>
        ) : (
          <>
            <ActivityIndicator color={theme.colors.accent} />
            <Text tone="textMuted">{t('database.preparing')}</Text>
          </>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  message: { textAlign: 'center' },
});
