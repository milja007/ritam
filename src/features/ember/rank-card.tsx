import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { emberColor, emberLevel } from '@/core/ember';
import {
  orbFlame,
  rankProgress,
  statValues,
  systemMessage,
  type OrbFlame as OrbFlameState,
  type RankProgress,
  type StatValue,
  type SystemMessage,
} from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { Ember } from '@/ui/ember';
import { OrbFlame } from '@/ui/orb-flame';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import type { EmberState } from './use-ember-data';

const ORB = 108;
const PIP = 10;

/**
 * Profil, „Rang i statovi“ (koraci 33 i 34b, platno „Profil“): orb-plamen avatar čija veličina prati
 * rang, a sjaj zadnjih 7 dana; koraci do sljedećeg ranga, poruka „[Sustav]“ i trake statova iz
 * stvarnog ponašanja. Dodir avatara objašnjava što oblikuje plamen.
 * Sve je izvedeno iz konačnih dnevnih rezultata — rang nikad ne pada, slab tjedan ništa ne oduzima.
 */
export function RankCard({ checkinDay, state }: { checkinDay: string; state: EmberState }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [explained, setExplained] = useState(false);
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
  const flame = orbFlame(state.data.days, state.data.streakDates, checkinDay);
  const heat = t(`orb.heat.${flame.heat}`);
  const detail =
    flame.average !== null
      ? t('orb.detail.burning', { average: flame.average })
      : t(`orb.detail.${flame.state === 'unlit' ? 'unlit' : 'resting'}`);

  return (
    <View style={cardStyle}>
      <Pressable
        style={styles.hero}
        onPress={() => setExplained((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: explained }}
        accessibilityLabel={`${t('rank.a11y', { rank: progress.rank, message })} ${heat}. ${detail}`}
        accessibilityHint={t('orb.hint')}>
        <OrbFlame flame={flame} size={ORB} />
        <View style={styles.heroText}>
          <Text variant="overline" tone="accent">
            {t('rank.label', { rank: progress.rank })}
          </Text>
          <Text variant="heading">{heat}</Text>
          <Text variant="caption" tone="textMuted" style={styles.tabular}>
            {detail}
          </Text>
          <Steps progress={progress} />
        </View>
      </Pressable>

      {explained ? <Explain flame={flame} /> : null}

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

function messageText(message: SystemMessage, t: TFunction): string {
  if (message.kind === 'top') return t('rank.top');
  if (message.kind === 'start') return t('rank.start');
  return t('rank.toNext', { count: message.count, rank: message.rank });
}

/** Što oblikuje plamen: veličina (rang), sjaj (zadnjih 7 dana), iskre (niz) i pravilo „bez kazni“. */
function Explain({ flame }: { flame: OrbFlameState }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const lines = [
    t('orb.explain.size', { rank: flame.rank }),
    t('orb.explain.heat'),
    `${t('orb.explain.sparks')} ${t('orb.explain.streak', { count: flame.streak })}`,
  ];
  return (
    <View
      style={[styles.system, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      accessibilityLiveRegion="polite">
      <Text variant="overline" tone="textMuted">
        {t('orb.explain.title')}
      </Text>
      {lines.map((line) => (
        <Text key={line} variant="caption" style={styles.tabular}>
          {line}
        </Text>
      ))}
      <Text variant="caption" tone="textMuted">
        {t('orb.explain.keep')}
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
  const { colors, scheme, flame } = useAppTheme();
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
          color={emberColor(emberLevel(stat.value), scheme, flame).fill ?? colors.accent}
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: ORB },
  heroText: { flex: 1, gap: spacing.xs },
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
