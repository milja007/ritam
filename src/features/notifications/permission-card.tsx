import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { notificationsSupported } from './expo-notifications';
import { usePermissionDecision } from './open-requests';

/**
 * Kartica kad je dopuštenje za obavijesti odbijeno: app više ne smije pitati, pa korisnika vodi u
 * postavke sustava. Po povratku u app sync ponovo provjeri dopuštenje i kartica nestane.
 */
export function PermissionCard() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const permission = usePermissionDecision();
  if (!notificationsSupported || permission !== 'denied') return null;

  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="heading">{t('notifications.permission.title')}</Text>
      <Text tone="textMuted">{t('notifications.permission.body')}</Text>
      <Button
        variant="secondary"
        label={t('notifications.permission.openSettings')}
        onPress={() => {
          Linking.openSettings().catch((error: unknown) =>
            console.error('Opening settings failed', error),
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
