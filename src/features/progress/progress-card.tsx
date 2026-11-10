import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { streakHintKey } from './streak-hint';
import { useProgress } from './use-progress';

/** Kartica napretka na Profilu: ukupni XP, razina + traka, XP danas, trenutni i najduži streak. */
export function ProgressCard({ today, checkinDay }: { today: string; checkinDay: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const progress = useProgress(today, checkinDay);

  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (progress.status === 'loading') {
    return (
      <View style={cardStyle}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (progress.status === 'error') {
    return (
      <View style={cardStyle}>
        <Text tone="danger">{t('progress.loadError')}</Text>
      </View>
    );
  }

  const { totalXp, todayXp, level, streak } = progress.summary;
  const number = (value: number) => value.toLocaleString(i18n.language);
  const levelLabel = t('progress.level', { level: level.level });
  const valueText = t('progress.toNext', {
    xp: number(level.xpIntoLevel),
    total: number(level.xpForNext),
    next: level.level + 1,
  });

  return (
    <View style={cardStyle}>
      <View style={styles.row}>
        <Text variant="heading">{levelLabel}</Text>
        <Text variant="bodyStrong" tone="accent">
          {t('progress.totalXp', { xp: number(totalXp) })}
        </Text>
      </View>
      <ProgressBar
        fraction={level.fraction}
        accessibilityLabel={levelLabel}
        valueText={valueText}
        height={10}
      />
      <Text variant="caption" tone="textMuted">
        {valueText}
      </Text>

      <View style={[styles.stats, { borderColor: colors.border }]}>
        <Stat value={`+${number(todayXp)}`} label={t('progress.stat.today')} highlight={todayXp > 0} />
        <Stat
          value={number(streak.current)}
          label={t('progress.stat.streak')}
          highlight={streak.current > 0}
        />
        <Stat value={number(streak.longest)} label={t('progress.stat.longest')} highlight={false} />
      </View>

      <Text variant="caption" tone="textMuted">
        {t(streakHintKey(streak))}
      </Text>
    </View>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="heading" tone={highlight ? 'accent' : 'text'}>
        {value}
      </Text>
      <Text variant="caption" tone="textMuted" style={styles.statLabel}>
        {label}
      </Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  statLabel: { textAlign: 'center' },
});
