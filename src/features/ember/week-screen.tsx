import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  averageScore,
  dayEmber,
  isoWeek,
  nowLine,
  segmentColor,
  weekDates,
  weekSegments,
  type SegmentLook,
} from '@/core/ember';
import { addDays } from '@/core/time/local-date';
import { radius, spacing } from '@/core/theme';
import { useNow } from '@/features/today';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { dayLong, dayNumber, weekdayLetter, weekRange } from './format';
import { PeriodScreen, Pill } from './period-screen';
import { useEmberData } from './use-ember-data';

const COLUMN_HEIGHT = 300;
const MIN_SEGMENT = 6;
const HOUR_MARKS = ['06', '12', '18', '24'] as const;
const LEGEND: readonly { look: SegmentLook; key: 'legendDone' | 'legendMissed' | 'legendPlan' | 'legendFixed' }[] = [
  { look: 'done', key: 'legendDone' },
  { look: 'missed', key: 'legendMissed' },
  { look: 'plan', key: 'legendPlan' },
  { look: 'fixedPlan', key: 'legendFixed' },
];

/**
 * Tab Tjedan (smjer „Žar“): sedam stupaca dana s blokovima (odrađeno svijetli, neodrađeno je
 * ugašeno, plan je ocrtan), linija „sada“ kroz današnji stupac i žar svakog dana ispod.
 */
export function WeekScreen() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useAppTheme();
  const now = useNow();
  const dates = weekDates(now.date);
  const from = dates[0] ?? now.date;
  const to = dates[6] ?? now.date;
  const state = useEmberData(now.eveningDate, { from, to });
  const language = i18n.language;
  const week = isoWeek(now.date);

  const previous = dates.map((date) => addDays(date, -7)).filter((date): date is string => date !== null);
  const average = state.data ? averageScore(dates, state.data.scores) : null;
  const before = state.data ? averageScore(previous, state.data.scores) : null;
  const diff = average !== null && before !== null ? average - before : null;
  const diffText = diff === null ? null : `${diff > 0 ? '+' : ''}${diff}`;
  const line = nowLine(now.minutes);
  const empty = state.data !== null && state.data.blocks.every((block) => block.kind === 'sleep');

  return (
    <PeriodScreen
      subtitle={weekRange(from, to, language)}
      title={t('ember.week.title', { week: week ?? '' })}
      status={state.status}
      onRetry={state.reload}
      pill={
        diffText !== null ? (
          <Pill label={t('ember.week.vsPreviousLabel', { diff: diffText })}>
            <Text variant="caption" tone={diff !== null && diff > 0 ? 'success' : 'textMuted'} style={styles.strong}>
              {t('ember.week.vsPrevious', { diff: diffText })}
            </Text>
          </Pill>
        ) : undefined
      }>
      {state.data ? (
        <>
          <View style={styles.grid} accessibilityLabel={t('ember.week.columns')}>
            <View style={styles.hours} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {HOUR_MARKS.map((mark) => (
                <Text key={mark} variant="caption" tone="textMuted" style={styles.hour}>
                  {mark}
                </Text>
              ))}
            </View>
            {dates.map((date) => {
              const ember = dayEmber(date, now.date, state.data.scores);
              const segments = weekSegments(state.data.blocks, date, now.date, now.minutes);
              const today = ember.kind === 'today';
              const day = dayLong(date, language);
              const label =
                ember.kind === 'today'
                  ? t('ember.week.dayToday', { day, count: segments.length })
                  : ember.kind === 'past' && ember.score !== null
                    ? t('ember.week.dayScored', { day, score: ember.score, count: segments.length })
                    : t('ember.week.dayPlain', { day, count: segments.length });
              return (
                <View key={date} style={styles.day} accessible accessibilityLabel={label}>
                  <View style={styles.dayHead}>
                    <Text variant="caption" tone="textMuted">
                      {weekdayLetter(date, language)}
                    </Text>
                    <Text variant="bodyStrong" tone={today ? 'accent' : 'text'} style={styles.tabular}>
                      {dayNumber(date)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.column,
                      { backgroundColor: colors.surface, borderColor: today ? colors.accent : colors.border },
                    ]}>
                    {segments.map((segment) => {
                      const color = segmentColor(segment.look, scheme);
                      return (
                        <View
                          key={segment.id}
                          style={[
                            styles.segment,
                            {
                              top: segment.top * COLUMN_HEIGHT,
                              height: Math.max(MIN_SEGMENT, segment.height * COLUMN_HEIGHT - 2),
                            },
                            color.fill !== null ? { backgroundColor: color.fill } : null,
                            color.border !== null ? { borderWidth: 1.5, borderColor: color.border } : null,
                          ]}
                        />
                      );
                    })}
                    {today && line !== null ? (
                      <View
                        style={[
                          styles.now,
                          {
                            top: line * COLUMN_HEIGHT - 1,
                            backgroundColor: colors.text,
                            boxShadow: `0 0 8px ${colors.accent}`,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                  <Ember
                    size={14}
                    today={today}
                    level={ember.kind === 'past' ? ember.level : 'unlit'}
                  />
                  <Text variant="caption" tone={today ? 'accent' : 'textMuted'} style={styles.score} numberOfLines={1}>
                    {today
                      ? t('ember.week.today')
                      : ember.kind === 'past' && ember.score !== null
                        ? String(ember.score)
                        : t('ember.week.noScore')}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.legend}>
            {LEGEND.map(({ look, key }) => {
              const color = segmentColor(look, scheme);
              return (
                <View key={key} style={styles.legendItem}>
                  <View
                    style={[
                      styles.swatch,
                      color.fill !== null ? { backgroundColor: color.fill } : null,
                      color.border !== null ? { borderWidth: 1.5, borderColor: color.border } : null,
                    ]}
                  />
                  <Text variant="caption" tone="textMuted">
                    {t(`ember.week.${key}`)}
                  </Text>
                </View>
              );
            })}
          </View>

          {empty ? <Text tone="textMuted">{t('ember.week.empty')}</Text> : null}
        </>
      ) : null}
    </PeriodScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.xs },
  hours: { width: 20, height: COLUMN_HEIGHT, marginTop: 44 + spacing.xs, justifyContent: 'space-between' },
  hour: { fontSize: 10, lineHeight: 12, fontVariant: ['tabular-nums'] },
  day: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dayHead: { height: 44, alignItems: 'center', justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  column: { width: '100%', height: COLUMN_HEIGHT, borderRadius: radius.md, borderWidth: 1 },
  segment: { position: 'absolute', left: 3, right: 3, borderRadius: 5 },
  now: { position: 'absolute', left: -3, right: -3, height: 2, borderRadius: 1 },
  score: { fontSize: 11, lineHeight: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
