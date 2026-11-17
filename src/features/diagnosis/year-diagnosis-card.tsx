import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { YearDiagnosisView, YearMonthStrip } from './year-diagnosis-view';
import { useYearLineText } from './year-line-params';
import type { YearReportState } from './year-report';
import { WEEK_TREND_ARROW, WEEK_TREND_TONE } from './week-diagnosis-view';

type YearDiagnosisCardProps = {
  report: YearReportState;
  /** Godina za zaglavlje dijagnoze (npr. „2026.“). */
  yearLabel: string;
  /** Gleda li se tekuća godina — tada se, dok dijagnoze nema, kaže kad stiže. */
  current: boolean;
};

/**
 * Kartica „Dijagnoza godine“ na tabu Godina (korak 37b): trend, „Ukratko“, mala traka žarova po
 * mjesecima, pregled tjednih promjena i gumb koji otvara cijelu dijagnozu. Dok godina traje
 * pokazuje samo kad stiže.
 */
export function YearDiagnosisCard({ report, yearLabel, current }: YearDiagnosisCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = useYearLineText();
  const [open, setOpen] = useState(false);
  const { diagnosis } = report;

  if (report.status === 'loading' || report.status === 'error') return null;
  if (diagnosis === null) {
    return current ? (
      <Text variant="caption" tone="textMuted">
        {t('diagnosis.year.card.pending')}
      </Text>
    ) : null;
  }

  const summary = lineText(diagnosis.summary);
  const trendLabel = t(`diagnosis.year.trend.${diagnosis.trend}`);
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
            {t('diagnosis.year.card.overline')}
          </Text>
          {report.seen ? null : (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text variant="caption" tone="onAccent" style={styles.strong}>
                {t('diagnosis.year.card.unseen')}
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
        <YearMonthStrip diagnosis={diagnosis} />
        {hasChanges ? (
          <Text variant="caption" tone="textMuted">
            {t('diagnosis.year.card.changes', diagnosis.changes)}
          </Text>
        ) : null}
        <Button
          variant={report.seen ? 'secondary' : 'primary'}
          label={t(report.seen ? 'diagnosis.year.card.openAgain' : 'diagnosis.year.card.open')}
          accessibilityHint={t('diagnosis.year.card.openHint')}
          onPress={openDiagnosis}
        />
      </View>

      {open ? (
        <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
          <GradientBackground>
            <SafeAreaView style={styles.flex}>
              <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.topRow}>
                  <Text variant="overline" tone="textMuted">
                    {yearLabel}
                  </Text>
                  <Button variant="ghost" label={t('diagnosis.close')} onPress={() => setOpen(false)} />
                </View>
                <Text variant="title" accessibilityRole="header">
                  {t('diagnosis.year.title')}
                </Text>
                <YearDiagnosisView diagnosis={diagnosis} />
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
