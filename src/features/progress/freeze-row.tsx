import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { emberColor } from '@/core/ember';
import { FREEZE_MAX, type StreakFreezes } from '@/core/gamification';
import { spacing } from '@/core/theme';
import { dayMonth } from '@/features/ember/format';
import { Ember } from '@/ui/ember';
import { Flare } from '@/ui/flare';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { useFreezeEarned } from './use-freeze-earned';

const SIZE = 14;

/**
 * Žeravica (freeze tokeni, korak 34) na kartici napretka: utori za žeravice (upaljen = na
 * raspolaganju), koliko ih ima, kad stiže sljedeća i koje je dane sačuvala u trenutnom nizu.
 * Nova žeravica dok je ekran otvoren kratko bljesne i javi se čitaču zaslona.
 */
export function FreezeRow({ freezes }: { freezes: StreakFreezes }) {
  const { t, i18n } = useTranslation();
  const { scheme, flame, colors } = useAppTheme();
  const { earned, id } = useFreezeEarned(freezes.held);
  const glow = emberColor('bright', scheme, flame).fill ?? colors.accent;
  const earnedAnnouncement = earned ? t('progress.freeze.earnedA11y') : null;

  useEffect(() => {
    if (earnedAnnouncement !== null) AccessibilityInfo.announceForAccessibility(earnedAnnouncement);
  }, [earnedAnnouncement, id]);

  const title = t('progress.freeze.title', { held: freezes.held, max: FREEZE_MAX });
  const next =
    freezes.nextIn > 0 ? t('progress.freeze.nextIn', { count: freezes.nextIn }) : t('progress.freeze.full');
  const saved =
    freezes.savedDates.length > 0
      ? t('progress.freeze.saved', {
          dates: freezes.savedDates.map((date) => dayMonth(date, i18n.language)).join(', '),
        })
      : null;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[title, next, saved, t('progress.freeze.explain')].filter(Boolean).join('. ')}>
      <View style={styles.slots}>
        {Array.from({ length: FREEZE_MAX }, (_, index) => {
          const lit = index < freezes.held;
          const ember = <Ember level={lit ? 'bright' : 'unlit'} size={SIZE} />;
          // Bljesne zadnji upaljeni utor — upravo zarađena žeravica.
          return index === freezes.held - 1 ? (
            <Flare key={index} trigger={earned ? id : 0} size={SIZE} color={glow}>
              {ember}
            </Flare>
          ) : (
            <View key={index}>{ember}</View>
          );
        })}
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" tone={freezes.held > 0 ? 'accent' : 'text'}>
          {title}
        </Text>
        <Text variant="caption" tone="textMuted">
          {next}
        </Text>
        {saved !== null ? (
          <Text variant="caption" tone="accent">
            {saved}
          </Text>
        ) : null}
        <Text variant="caption" tone="textMuted">
          {t('progress.freeze.explain')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  slots: { flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xxs },
  text: { flex: 1, gap: spacing.xxs },
});
