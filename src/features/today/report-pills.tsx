import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BlockStatus } from '@/core/domain';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

const REPORTS = ['done', 'partial', 'skipped'] as const;
type Report = (typeof REPORTS)[number];

type ReportPillsProps = {
  status: BlockStatus;
  disabled?: boolean;
  onReport: (status: Report) => void;
  compact?: boolean;
};

/** Prijava prošle aktivnosti izravno na rasporedu: U redu / Djelomično / Nije (17c). */
export function ReportPills({ status, disabled, onReport, compact = false }: ReportPillsProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const toneOf = (report: Report) =>
    report === 'done' ? colors.success : report === 'partial' ? colors.accent : colors.danger;

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {REPORTS.map((report) => {
        const selected = status === report;
        const tone = toneOf(report);
        return (
          <Pressable
            key={report}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            disabled={disabled}
            hitSlop={spacing.xs}
            onPress={() => onReport(report)}
            style={({ pressed }) => [
              styles.pill,
              compact ? styles.compact : null,
              {
                borderColor: selected ? tone : colors.border,
                backgroundColor: selected ? tone : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text variant="caption" tone={selected ? 'onAccent' : 'text'} style={styles.label}>
              {t(`today.report.${report}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  compact: { paddingVertical: spacing.xs },
  label: { fontWeight: '600' },
});
