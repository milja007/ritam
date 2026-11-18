import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isMonthLastDay } from '@/core/diagnosis';
import { spacing } from '@/core/theme';
import { monthName } from '@/features/ember/format';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { DiagnosisFeedback } from './diagnosis-feedback';
import { MonthDiagnosisView } from './month-diagnosis-view';
import { useMonthReport } from './month-report';

/** „studeni 2026.“ / „November 2026“. */
export function monthTitle(month: string, language: string): string {
  return `${monthName(month, language)} ${month.slice(0, 4)}${language === 'hr' ? '.' : ''}`;
}

/**
 * Koncept („zadnji dan u mjesecu → dan + tjedan + mjesec“), isto kao odluka 82 za tjedan: zadnji
 * dan mjeseca mjesečna dijagnoza stoji odmah ispod dnevne (i tjedne, ako je nedjelja) — na kraju
 * večernjeg upita i kad se dnevna otvori kasnije. Prikazana je i viđena. Drugi dani → ništa.
 */
export function MonthDiagnosisInline({ date }: { date: string }) {
  if (!isMonthLastDay(date)) return null;
  return <MonthSection month={date.slice(0, 7)} date={date} />;
}

function MonthSection({ month, date }: { month: string; date: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { diagnosis, seen, markSeen } = useMonthReport(month, date, null);

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
          {t('diagnosis.month.inline.overline')}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header">
        {t('diagnosis.month.title')}
      </Text>
      <Text variant="caption" tone="textMuted">
        {monthTitle(month, i18n.language)}
      </Text>
      <MonthDiagnosisView diagnosis={diagnosis} />
      <DiagnosisFeedback period="month" periodStart={diagnosis.start} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginTop: spacing.xl },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
