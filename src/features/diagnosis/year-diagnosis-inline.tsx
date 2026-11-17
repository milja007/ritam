import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isYearLastDay } from '@/core/diagnosis';
import { spacing } from '@/core/theme';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { YearDiagnosisView } from './year-diagnosis-view';
import { useYearReport } from './year-report';

/**
 * Koncept („31. 12. → dan + tjedan + mjesec + godina“): zadnji dan godine godišnja dijagnoza
 * stoji ispod dnevne, tjedne i mjesečne — na kraju večernjeg upita i kad se dnevna otvori
 * kasnije. Prikazana je i viđena. Drugi dani → ništa.
 */
export function YearDiagnosisInline({ date }: { date: string }) {
  if (!isYearLastDay(date)) return null;
  return <YearSection year={date.slice(0, 4)} date={date} />;
}

function YearSection({ year, date }: { year: string; date: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { diagnosis, seen, markSeen } = useYearReport(year, date, null);

  useEffect(() => {
    if (diagnosis !== null && !seen) markSeen();
  }, [diagnosis, seen, markSeen]);

  if (diagnosis === null) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.head}>
        <Ember size={14} level="bright" />
        <Text variant="overline" tone="accent">
          {t('diagnosis.year.inline.overline')}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header">
        {t('diagnosis.year.title')}
      </Text>
      <Text variant="caption" tone="textMuted">
        {`${year}.`}
      </Text>
      <YearDiagnosisView diagnosis={diagnosis} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginTop: spacing.xl },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
