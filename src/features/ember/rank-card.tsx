import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { emberColor, emberLevel } from '@/core/ember';
import {
  RANK_EMBER,
  rankProgress,
  statValues,
  systemMessage,
  type Rank,
  type RankProgress,
  type StatValue,
  type SystemMessage,
} from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { Ember } from '@/ui/ember';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import type { EmberState } from './use-ember-data';

const MEDALLION = 64;
const PIP = 10;

/**
 * Profil, „Rang i statovi“ (korak 34b, platno „Profil“): medaljon ranga čiji sjaj raste s rangom,
 * koraci do sljedećeg ranga, poruka „[Sustav]“ i trake statova iz stvarnog ponašanja.
 * Sve je izvedeno iz konačnih dnevnih rezultata — rang nikad ne pada, slab tjedan ništa ne oduzima.
 */
export function RankCard({ checkinDay, state }: { checkinDay: string; state: EmberState }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
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

  const progress = rankProgress(state.data.days, checkinDay);
  const message = messageText(systemMessage(progress), t);
  const stats = statValues(state.data.days, checkinDay);

  return (
    <View style={cardStyle}>
      <View style={styles.hero} accessible accessibilityLabel={t('rank.a11y', { rank: progress.rank, message })}>
        <Medallion rank={progress.rank} />
        <View style={styles.heroText}>
          <Text variant="overline" tone="accent">
            {t('rank.label', { rank: progress.rank })}
          </Text>
          <Steps progress={progress} />
        </View>
      </View>

      <View
        style={[styles.system, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
        accessible
        accessibilityLabel={`${message} ${t('rank.rule')}`}>
        <Text variant="caption" style={styles.systemText}>
          <Text variant="caption" tone="accent" style={styles.systemTag}>
            {t('rank.system')}{' '}
          </Text>
          {message}
        </Text>
        <Text variant="caption" tone="textMuted">
          {t('rank.rule')}
        </Text>
      </View>

      <View style={styles.stats}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('rank.stats.title')}
        </Text>
        {stats.map((stat) => (
          <StatRow key={stat.stat} stat={stat} />
        ))}
        <Text variant="caption" tone="textMuted">
          {t('rank.stats.note')}
        </Text>
      </View>
    </View>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

function messageText(message: SystemMessage, t: Translate): string {
  if (message.kind === 'top') return t('rank.top');
  if (message.kind === 'start') return t('rank.start');
  return t('rank.toNext', { count: message.count, rank: message.rank });
}

/** Slovo ranga u prstenu boje žara; sjaj prstena raste s rangom. Značenje nosi oznaka kartice. */
function Medallion({ rank }: { rank: Rank }) {
  const { colors, scheme } = useAppTheme();
  const { fill, glow } = emberColor(RANK_EMBER[rank], scheme);
  const ring = fill ?? colors.border;
  return (
    <View
      style={[
        styles.medallion,
        { borderColor: ring, backgroundColor: colors.surfaceRaised },
        scheme === 'dark' ? { boxShadow: `0 0 ${Math.round(8 + 20 * glow)}px ${ring}` } : null,
      ]}>
      <Text variant="display" style={styles.medallionLetter}>
        {rank}
      </Text>
    </View>
  );
}

/** Žarovi do sljedećeg ranga: upaljen je skupljen dobar tjedan, ugašen tek treba doći. */
function Steps({ progress }: { progress: RankProgress }) {
  const { t } = useTranslation();
  const { next } = progress;
  if (next === null) return null;
  return (
    <>
      <View style={styles.pips}>
        {Array.from({ length: next.stepWeeks }, (_, index) => (
          <Ember key={index} level={index < next.doneWeeks ? 'warm' : 'unlit'} size={PIP} glow={false} />
        ))}
      </View>
      <Text variant="caption" tone="textMuted" style={styles.tabular}>
        {t('rank.steps', { done: next.doneWeeks, total: next.stepWeeks, rank: next.rank })}
      </Text>
    </>
  );
}

/** Red stata: naziv, traka u boji žara (jači stat svijetli jače) i broj; bez podataka prigušen tekst. */
function StatRow({ stat }: { stat: StatValue }) {
  const { t } = useTranslation();
  const { colors, scheme } = useAppTheme();
  const name = t(`rank.stats.${stat.stat}`);

  if (stat.value === null) {
    const reason =
      stat.stat === 'health' || stat.stat === 'money'
        ? t(`rank.stats.tracker.${stat.stat}`)
        : t(`rank.stats.empty.${stat.stat}`);
    return (
      <View style={styles.statRow} accessible accessibilityLabel={t('rank.stats.emptyA11y', { stat: name, reason })}>
        <Text tone="textMuted" style={styles.statName}>
          {name}
        </Text>
        <Text variant="caption" tone="textMuted" style={styles.statReason}>
          {reason}
        </Text>
      </View>
    );
  }

  const label = t('rank.stats.valueA11y', { stat: name, value: stat.value });
  return (
    <View style={styles.statRow} accessible accessibilityLabel={label}>
      <Text style={styles.statName}>{name}</Text>
      <View style={styles.statBar}>
        <ProgressBar
          fraction={stat.value / 100}
          accessibilityLabel={name}
          valueText={String(stat.value)}
          color={emberColor(emberLevel(stat.value), scheme).fill ?? colors.accent}
        />
      </View>
      <Text variant="bodyStrong" style={[styles.statValue, styles.tabular]}>
        {stat.value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.xs },
  medallion: {
    width: MEDALLION,
    height: MEDALLION,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionLetter: { fontSize: 30, lineHeight: 36 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + spacing.xxs },
  tabular: { fontVariant: ['tabular-nums'] },
  system: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  systemText: { fontSize: 14, lineHeight: 20 },
  systemTag: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  stats: { gap: spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  statName: { width: 92 },
  statBar: { flex: 1 },
  statReason: { flex: 1 },
  statValue: { minWidth: 30, textAlign: 'right' },
});
