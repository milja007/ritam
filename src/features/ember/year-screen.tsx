import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { averageScore, dayEmber, longestStreakInYear, strongestMonth, yearMonths } from '@/core/ember';
import { daysBetween } from '@/core/time/local-date';
import { radius, spacing } from '@/core/theme';
import { useNow } from '@/features/today';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { monthName, monthShort } from './format';
import { Card, EmberLegend, PeriodScreen } from './period-screen';
import { useEmberData } from './use-ember-data';

const LABEL_WIDTH = 30;
const DOT_GAP = 2;
const MAX_DOT = 8;
const MIN_DOT = 4;
/** Vodoravni razmak sadržaja `PeriodScreen`-a (lijevo + desno). */
const SCREEN_PADDING = 2 * (spacing.lg + spacing.xs);

/**
 * Tab Godina (smjer „Žar“): svaki dan godine je jedna točkica žara, po mjesecima. Prošli dani
 * svijetle prema rezultatu, dani bez rezultata su ugašeni, budući su tek ocrtani.
 */
export function YearScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const now = useNow();
  const state = useEmberData(now.eveningDate);
  const language = i18n.language;
  const year = now.date.slice(0, 4);
  const behind = daysBetween(`${year}-01-01`, now.date) ?? 0;
  const months = yearMonths(year);
  const scores = state.data?.scores ?? null;

  // 31 točkica mora stati u red i na najužem ekranu.
  const room = width - SCREEN_PADDING - LABEL_WIDTH - spacing.sm - 30 * DOT_GAP;
  const dot = Math.max(MIN_DOT, Math.min(MAX_DOT, Math.floor(room / 31)));

  const best = scores ? strongestMonth(year, scores) : null;
  const scored = scores ? [...scores.keys()].filter((date) => date.startsWith(year)).length : 0;

  return (
    <PeriodScreen
      subtitle={t('ember.year.behind', { count: behind })}
      title={`${year}.`}
      status={state.status}
      onRetry={state.reload}>
      {scores && state.data ? (
        <>
          <View style={styles.months} accessibilityLabel={t('ember.year.days')}>
            {months.map(({ month, dates }) => {
              const current = month === now.date.slice(0, 7);
              const average = averageScore(dates, scores);
              const count = dates.filter((date) => scores.has(date)).length;
              const name = monthName(month, language);
              return (
                <View
                  key={month}
                  style={styles.month}
                  accessible
                  accessibilityLabel={
                    average === null
                      ? t('ember.year.monthLabelEmpty', { month: name })
                      : t('ember.year.monthLabel', { month: name, scored: count, average })
                  }>
                  <Text
                    variant="caption"
                    tone={current ? 'accent' : 'textMuted'}
                    style={[styles.monthLabel, current ? styles.strong : null]}
                    numberOfLines={1}>
                    {monthShort(month, language)}
                  </Text>
                  <View style={styles.dots}>
                    {dates.map((date) => {
                      const ember = dayEmber(date, now.date, scores);
                      return ember.kind === 'future' ? (
                        <View
                          key={date}
                          style={{
                            width: dot,
                            height: dot,
                            borderRadius: radius.pill,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                          }}
                        />
                      ) : (
                        <Ember
                          key={date}
                          size={dot}
                          glow={ember.kind === 'today'}
                          today={ember.kind === 'today'}
                          level={ember.kind === 'past' ? ember.level : 'unlit'}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          <EmberLegend size={10} />

          <View style={styles.records} accessibilityLabel={t('ember.year.records')}>
            <Record
              value={String(longestStreakInYear(state.data.streakDates, year, now.eveningDate))}
              label={t('ember.year.longestStreak')}
            />
            <Record
              value={best === null ? '–' : String(best.average)}
              label={
                best === null
                  ? t('ember.year.strongestMonth', { month: '–' })
                  : t('ember.year.strongestMonth', { month: monthName(best.month, language).toLowerCase() })
              }
            />
            <Record value={String(scored)} label={t('ember.year.scoredDays')} />
          </View>
        </>
      ) : null}
    </PeriodScreen>
  );
}

function Record({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.record} accessible accessibilityLabel={`${value} ${label}`}>
      <Card>
        <Text variant="title" style={styles.tabular}>
          {value}
        </Text>
        <Text variant="caption" tone="textMuted">
          {label}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  months: { gap: spacing.sm + spacing.xxs },
  month: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthLabel: { width: LABEL_WIDTH, fontSize: 11, lineHeight: 14 },
  strong: { fontWeight: '600' },
  dots: { flexDirection: 'row', gap: DOT_GAP },
  records: { flexDirection: 'row', gap: spacing.sm },
  record: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});
