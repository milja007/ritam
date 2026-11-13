import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EMBER_LEVELS } from '@/core/ember';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

type PeriodScreenProps = PropsWithChildren<{
  subtitle: string;
  title: string;
  /** Kratka činjenica desno u zaglavlju (npr. „još 18 dana“). */
  pill?: ReactNode;
  status: 'loading' | 'error' | 'ready';
  onRetry: () => void;
}>;

/** Zajednički okvir ekrana Tjedan / Mjesec / Godina: zaglavlje, učitavanje i greška. */
export function PeriodScreen({ subtitle, title, pill, status, onRetry, children }: PeriodScreenProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.titles}>
              <Text variant="caption" tone="textMuted">
                {subtitle}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
            </View>
            {pill}
          </View>
          {status === 'loading' ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : status === 'error' ? (
            <View style={styles.message}>
              <Text tone="danger">{t('ember.loadError')}</Text>
              <Button variant="secondary" label={t('ember.retry')} onPress={onRetry} />
            </View>
          ) : (
            children
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Pilula u zaglavlju. */
export function Pill({ children, label }: PropsWithChildren<{ label?: string }>) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

/** Legenda svjetline žara: slabiji dan → jači dan. */
export function EmberLegend({ size = 12 }: { size?: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.legend} accessible accessibilityLabel={t('ember.legendLabel')}>
      <Text variant="caption" tone="textMuted">
        {t('ember.weaker')}
      </Text>
      {EMBER_LEVELS.filter((level) => level !== 'unlit').map((level) => (
        <Ember key={level} level={level} size={size} glow={false} />
      ))}
      <Text variant="caption" tone="textMuted">
        {t('ember.stronger')}
      </Text>
    </View>
  );
}

/** Kartica s obrubom za sažetke ispod kalendara. */
export function Card({ children, label }: PropsWithChildren<{ label?: string }>) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLabel={label}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xxs },
  loading: { marginTop: spacing.xxl },
  message: { gap: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
