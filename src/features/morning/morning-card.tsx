import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** Kartica na tabu Danas dok jutarnja prijava sna nije spremljena: otvori jutarnji brief. */
export function MorningCard({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="overline" tone="textMuted">
        {t('morning.card.title')}
      </Text>
      <Text variant="heading">{t('morning.card.heading')}</Text>
      <Text tone="textMuted">{t('morning.card.body')}</Text>
      <Button label={t('morning.card.open')} onPress={onOpen} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
