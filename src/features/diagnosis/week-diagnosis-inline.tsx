import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isWeekLastDay } from '@/core/diagnosis';
import { weekStart } from '@/core/progress';
import { addDays } from '@/core/time/local-date';
import { spacing } from '@/core/theme';
import { weekRange } from '@/features/ember/format';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { WeekDiagnosisView } from './week-diagnosis-view';
import { useWeekReport } from './week-report';

type WeekDiagnosisInlineProps = {
  /** Dan čija se dijagnoza gleda; tjedni dio se pokaže samo kad je to nedjelja. */
  date: string;
};

/**
 * Odluka 82 (Borna, 2026-11-15): nedjeljom se tjedna dijagnoza pokaže odmah ispod dnevne — na
 * kraju večernjeg upita i kad se dnevna otvori kasnije. Prikazana je i viđena (pa ponedjeljkom
 * ne stiže obavijest). Drugi dani, tjedan bez dijagnoze ili greška → ništa.
 */
export function WeekDiagnosisInline({ date }: WeekDiagnosisInlineProps) {
  const start = weekStart(date);
  if (start === null || !isWeekLastDay(date)) return null;
  return <WeekSection start={start} date={date} />;
}

function WeekSection({ start, date }: { start: string; date: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const report = useWeekReport(start, date, null);
  const { diagnosis, seen, markSeen } = report;

  useEffect(() => {
    if (diagnosis !== null && !seen) markSeen();
  }, [diagnosis, seen, markSeen]);

  if (diagnosis === null) return null;
  const range = weekRange(start, addDays(start, 6) ?? date, i18n.language);

  return (
    <View style={styles.root}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.head}>
        <Ember size={14} level="bright" />
        <Text variant="overline" tone="accent">
          {t('diagnosis.week.inline.overline')}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header">
        {t('diagnosis.week.title')}
      </Text>
      <Text variant="caption" tone="textMuted">
        {range}
      </Text>
      <WeekDiagnosisView diagnosis={diagnosis} accepted={report.accepted} onAnswer={report.answer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginTop: spacing.xl },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
