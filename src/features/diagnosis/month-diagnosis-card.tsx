import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { DiagnosisFeedback } from './diagnosis-feedback';
import { MonthDiagnosisView, useMonthLineText } from './month-diagnosis-view';
import type { MonthReportState } from './month-report';
import { WEEK_TREND_ARROW, WEEK_TREND_TONE } from './week-diagnosis-view';

type MonthDiagnosisCardProps = {
  report: MonthReportState;
  /** Naziv mjeseca za zaglavlje dijagnoze (npr. „studeni 2026.“). */
  monthLabel: string;
  /** Gleda li se tekući mjesec — tada se, dok dijagnoze nema, kaže kad stiže. */
  current: boolean;
};

/**
 * Kartica „Dijagnoza mjeseca“ na tabu Mjesec (korak 37): trend, „Ukratko“, pregled tjednih
 * promjena i gumb koji otvara cijelu dijagnozu. Dok mjesec traje pokazuje samo kad stiže; za
 * prošli mjesec bez podataka se ne prikazuje.
 */
export function MonthDiagnosisCard({ report, monthLabel, current }: MonthDiagnosisCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = useMonthLineText();
  const [open, setOpen] = useState(false);
  const { diagnosis } = report;

  if (report.status === 'loading' || report.status === 'error') return null;
  if (diagnosis === null) {
    return current ? (
      <Text variant="caption" tone="textMuted">
        {t('diagnosis.month.card.pending')}
      </Text>
    ) : null;
  }

  const summary = lineText(diagnosis.summary);
  const trendLabel = t(`diagnosis.month.trend.${diagnosis.trend}`);
  const hasChanges = diagnosis.changes.accepted + diagnosis.changes.rejected > 0;
  const openDiagnosis = () => {
    setOpen(true);
    if (!report.seen) report.markSeen();
  };

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: report.seen ? colors.border : colors.accent },
        ]}>
        <View style={styles.headRow}>
          <Text variant="overline" tone={report.seen ? 'textMuted' : 'accent'} accessibilityRole="header">
            {t('diagnosis.month.card.overline')}
          </Text>
          {report.seen ? null : (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text variant="caption" tone="onAccent" style={styles.strong}>
                {t('diagnosis.month.card.unseen')}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.summaryRow} accessible accessibilityLabel={`${trendLabel}. ${summary}`}>
          <Text variant="title" tone={WEEK_TREND_TONE[diagnosis.trend]}>
            {WEEK_TREND_ARROW[diagnosis.trend]}
          </Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone={WEEK_TREND_TONE[diagnosis.trend]}>
              {trendLabel}
            </Text>
            <Text tone="textMuted">{summary}</Text>
          </View>
        </View>
        {hasChanges ? (
          <Text variant="caption" tone="textMuted">
            {t('diagnosis.month.card.changes', diagnosis.changes)}
          </Text>
        ) : null}
        <Button
          variant={report.seen ? 'secondary' : 'primary'}
          label={t(report.seen ? 'diagnosis.month.card.openAgain' : 'diagnosis.month.card.open')}
          accessibilityHint={t('diagnosis.month.card.openHint')}
          onPress={openDiagnosis}
        />
      </View>

      {open ? (
        <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
          <GradientBackground>
            <SafeAreaView style={styles.flex}>
              <ScrollView
                contentContainerStyle={styles.content}
                automaticallyAdjustKeyboardInsets
                keyboardShouldPersistTaps="handled">
                <View style={styles.topRow}>
                  <Text variant="overline" tone="textMuted">
                    {monthLabel}
                  </Text>
                  <Button variant="ghost" label={t('diagnosis.close')} onPress={() => setOpen(false)} />
                </View>
                <Text variant="title" accessibilityRole="header">
                  {t('diagnosis.month.title')}
                </Text>
                <MonthDiagnosisView diagnosis={diagnosis} />
                <DiagnosisFeedback period="month" periodStart={diagnosis.start} />
              </ScrollView>
            </SafeAreaView>
          </GradientBackground>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  strong: { fontWeight: '600' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
