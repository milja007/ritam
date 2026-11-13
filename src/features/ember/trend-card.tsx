import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { railColors, trend } from '@/core/ember';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import type { EmberState } from './use-ember-data';

const CHART_HEIGHT = 64;
/** Dan bez rezultata: niska crtica (ugašen žar), da se vidi da je dan postojao. */
const UNLIT_HEIGHT = 3;

/**
 * Profil, „Zadnjih 30 dana“ (smjer „Žar“): stupac po danu, visina je konačni dnevni rezultat.
 * Zadnjih 7 dana svijetli u boji plamena, stariji su prigušeni; dan bez rezultata je ugašen.
 */
export function TrendCard({ checkinDay, state }: { checkinDay: string; state: EmberState }) {
  const { t } = useTranslation();
  const { colors, scheme } = useAppTheme();
  const rail = railColors(scheme);
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (state.status === 'loading') {
    return (
      <View style={cardStyle}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={cardStyle}>
        <Text tone="danger">{t('ember.loadError')}</Text>
      </View>
    );
  }

  const { bars, average, previous, scored } = trend(checkinDay, state.data.scores);
  const summary =
    average === null
      ? null
      : previous === null
        ? t('ember.trend.average', { score: average })
        : t('ember.trend.averageWithPrevious', { score: average, previous });
  const label =
    average === null
      ? `${t('ember.trend.title')}. ${t('ember.trend.empty')}`
      : previous === null
        ? t('ember.trend.label', { scored, score: average })
        : t('ember.trend.labelWithPrevious', { scored, score: average, previous });

  return (
    <View style={cardStyle} accessible accessibilityLabel={label}>
      <View style={styles.header}>
        <Text variant="overline" tone="textMuted">
          {t('ember.trend.title')}
        </Text>
        {summary === null ? null : (
          <Text variant="caption" style={styles.tabular}>
            {summary}
          </Text>
        )}
      </View>
      <View style={styles.chart}>
        {bars.map((bar) => (
          <View
            key={bar.date}
            style={[
              styles.bar,
              bar.score === null
                ? { height: UNLIT_HEIGHT, backgroundColor: colors.border }
                : {
                    height: Math.max(UNLIT_HEIGHT + 1, Math.round((bar.score / 100) * CHART_HEIGHT)),
                    backgroundColor: bar.recent ? rail.lit : rail.ring,
                  },
            ]}
          />
        ))}
      </View>
      {average === null ? (
        <Text variant="caption" tone="textMuted">
          {t('ember.trend.empty')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  chart: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { flex: 1, borderRadius: 2 },
});
