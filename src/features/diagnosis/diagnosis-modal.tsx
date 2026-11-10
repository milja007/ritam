import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { DayDiagnosisView } from './day-diagnosis-view';
import { useDayReport } from './day-report';

/** Spremljena dijagnoza dana (s kartice večernjeg upita). */
export function DiagnosisModal({ date, dayLabel, onClose }: { date: string; dayLabel: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const report = useDayReport(date);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.topRow}>
              <Text variant="overline" tone="textMuted">
                {dayLabel}
              </Text>
              <Button variant="ghost" label={t('diagnosis.close')} onPress={onClose} />
            </View>
            <Text variant="title" accessibilityRole="header">
              {t('diagnosis.title')}
            </Text>
            {report.status === 'loading' ? (
              <ActivityIndicator color={colors.accent} />
            ) : report.diagnosis ? (
              <DayDiagnosisView diagnosis={report.diagnosis} />
            ) : (
              <Text tone="danger">{t('diagnosis.loadError')}</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
