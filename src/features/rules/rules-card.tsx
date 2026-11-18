import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { MAX_RULES_PER_PERIOD, type Rule, type RulePeriod } from '@/core/domain';
import { ruleEmberLevel, ruleStreak, type RuleScope, type RuleStreak } from '@/core/rules';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { RuleHasHistoryError, deleteRule } from '@/db/repos';
import { dayMonth } from '@/features/ember/format';
import { Button } from '@/ui/button';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { RuleEditor, weekdayLabel } from './rule-editor';
import { useRules } from './use-rules';

const DOT = 18;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

type RulesCardProps = {
  period: RulePeriod;
  /** Prvi i zadnji dan prikazanog razdoblja. */
  periodStart: string;
  periodEnd: string;
  today: string;
};

/**
 * Zabrane unutar plana razdoblja (korak 28): svoje zabrane tog tjedna/mjeseca/godine, pa šire
 * (mjesec i godina u tjednu) i stalne. Svaka ima niz kao žar koji raste — bez kazne, prekid samo
 * gasi žar. Dodaje se samo u svoje razdoblje; prošlo razdoblje je samo za čitanje.
 */
export function RulesCard({ period, periodStart, periodEnd, today }: RulesCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const state = useRules(period, periodStart);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<'limit' | 'failed' | null>(null);
  const past = periodEnd < today;
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (state.status !== 'ready') {
    return (
      <View style={cardStyle}>
        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text tone="danger">{t('rules.loadError')}</Text>
        )}
      </View>
    );
  }

  const { rules, logs } = state.data;
  const own = rules.filter((item) => item.scope === 'own').length;
  const canAdd = !past && own < MAX_RULES_PER_PERIOD;

  function remove(rule: Rule) {
    Alert.alert(t('rules.removeTitle'), t('rules.removeMessage', { title: rule.title }), [
      { text: t('rules.cancel'), style: 'cancel' },
      {
        text: t('rules.remove'),
        style: 'destructive',
        onPress: () => {
          setError(null);
          deleteRule(getDb(), LOCAL_USER_ID, rule.id)
            .then(() => {
              setOpen(null);
              state.reload();
            })
            .catch((failure: unknown) => {
              // Zapis je mogao stići u međuvremenu (večernji upit) — tada zabrana ostaje.
              if (!(failure instanceof RuleHasHistoryError)) console.error('Deleting rule failed', failure);
              setError('failed');
              state.reload();
            });
        },
      },
    ]);
  }

  return (
    <View style={cardStyle}>
      <Text variant="overline" tone="textMuted" accessibilityRole="header">
        {t(`rules.${period}.heading`)}
      </Text>

      {rules.length === 0 ? <Text tone="textMuted">{t(past ? `rules.${period}.emptyPast` : `rules.${period}.empty`)}</Text> : null}

      {rules.length > 0 ? (
        <View style={styles.rows}>
          {rules.map(({ rule, scope }) => {
            const ruleLogs = logs.filter((log) => log.ruleId === rule.id);
            const streak = ruleStreak(rule, ruleLogs, today);
            return (
              <RuleRow
                key={rule.id}
                rule={rule}
                scope={scope}
                streak={streak}
                today={today}
                expanded={open === rule.id}
                onToggle={() => setOpen((current) => (current === rule.id ? null : rule.id))}
                onRemove={!past && scope === 'own' && streak.kept + streak.broken === 0 ? () => remove(rule) : undefined}
                ownWithHistory={scope === 'own' && streak.kept + streak.broken > 0}
              />
            );
          })}
        </View>
      ) : null}

      {canAdd ? (
        <Button variant="secondary" label={t('rules.add')} onPress={() => setEditing(true)} />
      ) : !past ? (
        <Text variant="caption" tone="textMuted">
          {t('rules.limitHint', { max: MAX_RULES_PER_PERIOD })}
        </Text>
      ) : null}

      {error !== null ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t(error === 'limit' ? 'rules.limit' : 'rules.failed', { max: MAX_RULES_PER_PERIOD })}
        </Text>
      ) : null}

      {editing ? (
        <RuleEditor
          period={period}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={() => setEditing(false)}
          onLimit={() => {
            setEditing(false);
            setError('limit');
            state.reload();
          }}
          onSaved={(title) => {
            setEditing(false);
            setError(null);
            state.reload();
            AccessibilityInfo.announceForAccessibility(t('rules.addedA11y', { title }));
          }}
        />
      ) : null}
    </View>
  );
}

function RuleRow({
  rule,
  scope,
  streak,
  today,
  expanded,
  onToggle,
  onRemove,
  ownWithHistory,
}: {
  rule: Rule;
  scope: RuleScope;
  streak: RuleStreak;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  ownWithHistory: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const language = i18n.language;
  const notStarted = rule.periodStart !== null && rule.periodStart > today;
  const logged = streak.kept + streak.broken > 0;
  const streakText = notStarted
    ? t('rules.notStarted', { date: dayMonth(rule.periodStart ?? today, language) })
    : logged
      ? `${t('rules.streak', { count: streak.current })}${streak.best > streak.current ? ` · ${t('rules.best', { count: streak.best })}` : ''}`
      : t('rules.noLogs');
  const weight = t(`rules.weight.${rule.weight}`);
  const tag =
    scope === 'own'
      ? null
      : t(scope === 'always' ? 'rules.scope.always' : rule.period === 'month' ? 'rules.scope.month' : 'rules.scope.year');
  const allDays = rule.activeDays.length === 7;
  const days = WEEK_ORDER.filter((day) => rule.activeDays.includes(day))
    .map((day) => weekdayLabel(day, language).slice(0, 3))
    .join(', ');

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${t('rules.rowA11y', { title: rule.title, streak: streakText, weight })}${tag ? ` ${tag}.` : ''}`}
        accessibilityHint={t('rules.expandHint')}
        onPress={onToggle}
        style={styles.head}>
        <Ember level={ruleEmberLevel(notStarted ? 0 : streak.current)} size={DOT} glow={streak.current > 0} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{rule.title}</Text>
          <Text variant="caption" tone="textMuted" style={styles.tabular}>
            {streakText} · {weight}
          </Text>
        </View>
        {tag ? (
          <View style={[styles.tag, { borderColor: colors.border }]}>
            <Text variant="caption" tone="textMuted">
              {tag}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          {rule.why.length > 0 ? <Text>{t('rules.why', { why: rule.why })}</Text> : null}
          <Text variant="caption" tone="textMuted">
            {allDays ? t('rules.everyDay') : t('rules.days', { days })}
          </Text>
          {logged ? (
            <Text variant="caption" tone="textMuted" style={styles.tabular}>
              {t('rules.tally', { kept: streak.kept, broken: streak.broken })}
            </Text>
          ) : null}
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('rules.removeLabel', { title: rule.title })}
              onPress={onRemove}
              style={styles.remove}>
              <Text tone="textMuted">{t('rules.remove')}</Text>
            </Pressable>
          ) : ownWithHistory ? (
            <Text variant="caption" tone="textMuted">
              {t('rules.hasHistory')}
            </Text>
          ) : null}
        </View>
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
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  rows: { gap: spacing.xs },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingVertical: spacing.xs },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  details: { gap: spacing.xs, paddingLeft: DOT + spacing.md, paddingBottom: spacing.sm },
  remove: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
