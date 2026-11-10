import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getReport, markReportSeen } from '@/db/repos';
import { syncNotificationsNow } from '@/features/notifications';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { generateDayDiagnosis } from './day-report';

type State = { date: string; seen: boolean };

/**
 * Je li dijagnoza dana pokupljena (17d) i "pokupi je": napravi svježu dijagnozu iz trenutnih
 * podataka, označi je viđenom i uskladi večernji podsjetnik. `seen` je `null` dok se učitava.
 */
export function useDiagnosisPickup(date: string) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let active = true;
    getReport(getDb(), LOCAL_USER_ID, 'day', date)
      .then((report) => {
        if (active) setState({ date, seen: report?.seenAt != null });
      })
      .catch((error: unknown) => {
        console.error('Loading diagnosis state failed', error);
        // Bez stanja se kartica ne prikazuje (dijagnoza je i dalje dostupna s večernje kartice).
        if (active) setState({ date, seen: true });
      });
    return () => {
      active = false;
    };
  }, [date]);

  /** Napravi i označi dijagnozu pokupljenom; vraća je li uspjelo. */
  const pickUp = useCallback((): boolean => {
    if (generateDayDiagnosis(date) === null) return false;
    try {
      markReportSeen(getDb(), LOCAL_USER_ID, 'day', date);
    } catch (error: unknown) {
      console.error('Marking diagnosis seen failed', error);
    }
    setState({ date, seen: true });
    void syncNotificationsNow(); // večernji podsjetnik više ne nudi dijagnozu
    return true;
  }, [date]);

  /** Dijagnoza je viđena drugdje (kraj večernjeg upita, večernja kartica) — samo označi. */
  const markSeen = useCallback(() => {
    try {
      if (!markReportSeen(getDb(), LOCAL_USER_ID, 'day', date)) return;
    } catch (error: unknown) {
      console.error('Marking diagnosis seen failed', error);
      return;
    }
    setState({ date, seen: true });
    void syncNotificationsNow();
  }, [date]);

  const seen = state?.date === date ? state.seen : null;
  return { seen, pickUp, markSeen };
}

/** Kartica na Dan kad je svaki blok riješen, a dijagnoza još nije pokupljena. */
export function DiagnosisReadyCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}
      accessibilityLiveRegion="polite">
      <Text variant="overline" tone="accent">
        {t('diagnosis.ready.overline')}
      </Text>
      <Text variant="heading">{t('diagnosis.ready.title')}</Text>
      <Text tone="textMuted">{t('diagnosis.ready.body')}</Text>
      <Button label={t('diagnosis.ready.open')} onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
