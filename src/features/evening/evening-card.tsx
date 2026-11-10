import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { SavedEveningCheckin } from '@/core/checkin';
import { isEveningCheckinComplete } from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** Kartica na tabu Danas: pokreni večernji upit ili, ako je ispunjen, prikaži ocjenu i Uredi. */
export function EveningCard({
  saved,
  forYesterday,
  disabled,
  onOpen,
  onPlanTomorrow,
  onOpenDiagnosis,
}: {
  saved: SavedEveningCheckin | null;
  /** Prije 04:00 upit se odnosi na jučerašnji dan. */
  forYesterday: boolean;
  disabled: boolean;
  onOpen: () => void;
  /** Kad je upit ispunjen: otvori "Što imaš sutra?". */
  onPlanTomorrow: () => void;
  /** Kad je upit ispunjen: prikaži dijagnozu dana. */
  onOpenDiagnosis: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const done = saved !== null && isEveningCheckinComplete(saved.checkin);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: done ? colors.success : colors.border },
      ]}>
      <Text variant="overline" tone={done ? 'success' : 'textMuted'}>
        {forYesterday ? t('evening.card.titleYesterday') : t('evening.card.title')}
      </Text>
      <Text variant="heading">
        {done ? t('evening.card.doneTitle') : t('evening.card.pendingTitle')}
      </Text>
      <Text tone="textMuted">
        {done
          ? t('evening.card.doneBody', { rating: saved.checkin.dayRating ?? 0 })
          : t('evening.card.pendingBody')}
      </Text>
      <Button
        variant={done ? 'secondary' : 'primary'}
        label={done ? t('evening.card.edit') : t('evening.card.start')}
        onPress={onOpen}
        disabled={disabled}
      />
      {done ? (
        <Button
          variant="secondary"
          label={t('evening.card.diagnosis')}
          onPress={onOpenDiagnosis}
          disabled={disabled}
        />
      ) : null}
      {done ? (
        <Button
          label={t('evening.card.planTomorrow')}
          onPress={onPlanTomorrow}
          disabled={disabled}
        />
      ) : null}
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
