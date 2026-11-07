import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/core/theme';

import { GradientBackground } from './gradient-background';
import { Text } from './text';

type PlaceholderScreenProps = {
  title: string;
  subtitle?: string;
};

// Privremeni ekran dok se značajka ne izgradi; pozadina prati doba dana.
export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  const { t } = useTranslation();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.content}>
        <Text variant="title">{title}</Text>
        <Text tone="textMuted">{subtitle ?? t('common.comingSoon')}</Text>
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
});
