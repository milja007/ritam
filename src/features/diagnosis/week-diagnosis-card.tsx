import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Ember } from '@/ui/ember';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { WEEK_TREND_ARROW, WEEK_TREND_TONE, WeekDiagnosisView, weekLineParams } from './week-diagnosis-view';
import type { WeekReportState } from './week-report';

type WeekDiagnosisCardProps = {
  report: WeekReportState;
  /** Raspon tjedna za zaglavlje dijagnoze (npr. „9. – 15. studenoga“). */
  rangeLabel: string;
  /** Gleda li se tekući tjedan — tada se, dok dijagnoze nema, kaže kad stiže. */
  current: boolean;
};

/**
 * Kartica „Dijagnoza tjedna“ na tabu Tjedan (korak 36): trend i „Ukratko“ redak, niz boljih
 * tjedana, stanje prijedloga i gumb koji otvara cijelu dijagnozu. Dok tjedan traje pokazuje samo
 * kad dijagnoza stiže; za prošli tjedan bez podataka se ne prikazuje.
 */
export function WeekDiagnosisCard({ report, rangeLabel, current }: WeekDiagnosisCardProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const { diagnosis } = report;

  if (report.status === 'loading' || report.status === 'error') return null;
  if (diagnosis === null) {
    return current ? (
      <Text variant="caption" tone="textMuted">
        {t('diagnosis.week.card.pending')}
      </Text>
    ) : null;
  }

  const summary = t(`diagnosis.week.lines.${diagnosis.summary.key}`, weekLineParams(diagnosis.summary, i18n.language));
  const trendLabel = t(`diagnosis.week.trend.${diagnosis.trend}`);
  const suggestionState =
    diagnosis.suggestion === null
      ? null
      : diagnosis.carried || report.accepted === true
        ? t('diagnosis.week.card.accepted')
        : report.accepted === false
          ? t('diagnosis.week.card.rejected')
          : t('diagnosis.week.card.unanswered');
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
            {t('diagnosis.week.card.overline')}
          </Text>
          {report.seen ? null : (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text variant="caption" tone="onAccent" style={styles.strong}>
                {t('diagnosis.week.card.unseen')}
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
        {diagnosis.betterWeeks > 0 || suggestionState !== null ? (
          <View style={styles.facts}>
            {diagnosis.betterWeeks > 0 ? (
              <View style={styles.fact}>
                <Ember size={12} level={diagnosis.betterWeeks >= 4 ? 'bright' : 'warm'} />
                <Text variant="caption" style={styles.strong}>
                  {t('diagnosis.week.card.betterWeeks', { count: diagnosis.betterWeeks })}
                </Text>
              </View>
            ) : null}
            {suggestionState !== null ? (
              <Text variant="caption" tone={report.accepted === null && !diagnosis.carried ? 'accent' : 'textMuted'}>
                {suggestionState}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Button
          variant={report.seen ? 'secondary' : 'primary'}
          label={t(report.seen ? 'diagnosis.week.card.openAgain' : 'diagnosis.week.card.open')}
          accessibilityHint={t('diagnosis.week.card.openHint')}
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
                    {rangeLabel}
                  </Text>
                  <Button variant="ghost" label={t('diagnosis.close')} onPress={() => setOpen(false)} />
                </View>
                <Text variant="title" accessibilityRole="header">
                  {t('diagnosis.week.title')}
                </Text>
                <WeekDiagnosisView diagnosis={diagnosis} accepted={report.accepted} onAnswer={report.answer} />
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
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
