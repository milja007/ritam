import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { emberColor } from '@/core/ember';
import { badgeProgress, hasCounter, sortBadges, type Badge, type BadgeProgress } from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import type { EmberState } from './use-ember-data';

const CHIP_HEIGHT = 36;
/** Dodirna meta čipa je s ovim proširenjem 44 px (HIG), a čipovi ostaju gusti kao na platnu. */
const CHIP_HIT_SLOP = { top: 4, bottom: 4 } as const;

/**
 * Profil, „Bedževi“ (korak 34, platno „Profil“): osvojeni bedž ima puni obrub u boji žara, onaj u
 * tijeku crtkani obrub i brojač („3/4“). Dodir čipa pokaže pravilo ispod. Sve je izvedeno iz
 * konačnih dnevnih rezultata i niza — osvojeno se ne gubi.
 */
export function BadgesCard({ checkinDay, state }: { checkinDay: string; state: EmberState }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<Badge | null>(null);
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

  const badges = sortBadges(badgeProgress(state.data.days, state.data.streakDates, checkinDay));
  const earned = badges.filter((badge) => badge.earned).length;
  const open = badges.find((badge) => badge.badge === selected) ?? null;

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('badges.title')}
        </Text>
        <Text
          variant="caption"
          tone={earned > 0 ? 'accent' : 'textMuted'}
          style={styles.tabular}
          accessibilityLabel={t('badges.countA11y', { earned, total: badges.length })}>
          {t('badges.count', { earned, total: badges.length })}
        </Text>
      </View>

      <View style={styles.chips}>
        {badges.map((badge) => (
          <Chip
            key={badge.badge}
            badge={badge}
            selected={badge.badge === selected}
            onPress={() => setSelected((current) => (current === badge.badge ? null : badge.badge))}
          />
        ))}
      </View>

      {open === null ? (
        <Text variant="caption" tone="textMuted">
          {t(earned > 0 ? 'badges.hint' : 'badges.hintEmpty')}
        </Text>
      ) : (
        <View
          style={[styles.detail, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          accessibilityLiveRegion="polite">
          <Text variant="bodyStrong">{t(`badges.name.${open.badge}`)}</Text>
          <Text variant="caption" tone={open.earned ? 'accent' : 'textMuted'} style={styles.tabular}>
            {statusText(open, t)}
          </Text>
          <Text variant="caption" tone="textMuted">
            {t(`badges.rule.${open.badge}`)}
          </Text>
        </View>
      )}
    </View>
  );
}

function statusText(badge: BadgeProgress, t: TFunction): string {
  if (badge.earned) return t('badges.earned');
  return hasCounter(badge) ? t('badges.progress', { done: badge.done, total: badge.total }) : t('badges.locked');
}

type ChipProps = { badge: BadgeProgress; selected: boolean; onPress: () => void };

/** Čip bedža. Stanje ne nosi samo boja: osvojen ima puni obrub, neosvojen crtkani (i brojač). */
function Chip({ badge, selected, onPress }: ChipProps) {
  const { t } = useTranslation();
  const { colors, scheme, flame } = useAppTheme();
  const name = t(`badges.name.${badge.badge}`);
  const counter = hasCounter(badge);
  const lit = emberColor('warm', scheme, flame).fill ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      accessibilityLabel={`${name}. ${statusText(badge, t)}.`}
      accessibilityHint={t(`badges.rule.${badge.badge}`)}
      style={({ pressed }) => [
        styles.chip,
        badge.earned ? { borderColor: lit } : [styles.chipOpen, { borderColor: colors.textMuted }],
        selected || pressed ? { backgroundColor: colors.surfaceRaised } : null,
      ]}>
      <Text variant="caption" tone={badge.earned ? 'accent' : 'textMuted'} style={styles.chipText}>
        {counter ? t('badges.chip', { name, done: badge.done, total: badge.total }) : name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOpen: { borderStyle: 'dashed' },
  chipText: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  detail: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xxs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
