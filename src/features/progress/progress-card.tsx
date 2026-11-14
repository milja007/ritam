import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { nextUnlocks, titleAt } from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { nextUnlockText } from '@/features/unlocks/unlock-text';
import { Orb } from '@/ui/ember';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { streakHintKey } from './streak-hint';
import { useProgress } from './use-progress';

const RING = 96;
const ORB = 44;

/**
 * Kartica napretka na Profilu (smjer „Žar“): orb-plamen u prstenovima, uz njega razina s naslovom,
 * ukupni XP i traka do sljedeće razine; ispod XP danas, trenutni i najduži niz te što otključava
 * sljedeća razina (korak 32).
 */
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
  // Razina i naslov su vidljivi otkad razine nešto otključavaju (odluka P35, korak 32).
  const title = t(`unlocks.titles.${titleAt(level.level)}`);
  const xpTitle = t('progress.xpTitle');
  const valueText = t('progress.toNextLevel', {
    xp: number(level.xpIntoLevel),
    total: number(level.xpForNext),
    level: level.level + 1,
  });

  return (
    <View style={cardStyle}>
      <View style={styles.hero}>
        {/* Ukrasno: plamen napretka; brojke nosi tekst desno. */}
        <View
          style={[styles.ring, { borderColor: colors.border }]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden>
          <View style={[styles.ringInner, { borderColor: colors.textMuted }]} />
          <Orb size={ORB} />
        </View>
        <View style={styles.heroText}>
          <Text
            variant="overline"
            tone="accent"
            accessibilityLabel={t('unlocks.levelTitleA11y', { level: level.level, title })}>
            {t('unlocks.levelTitle', { level: level.level, title })}
          </Text>
          <Text variant="title" style={styles.tabular}>
            {t('progress.totalXp', { xp: number(totalXp) })}
          </Text>
          <ProgressBar fraction={level.fraction} accessibilityLabel={xpTitle} valueText={valueText} height={8} />
          <Text variant="caption" tone="textMuted" style={styles.tabular}>
            {valueText}
          </Text>
        </View>
      </View>

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
      <Text variant="caption" tone="textMuted">
        {nextUnlockText(t, nextUnlocks(level.level))}
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ring: {
    width: RING,
    height: RING,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  heroText: { flex: 1, gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  statLabel: { textAlign: 'center' },
});
