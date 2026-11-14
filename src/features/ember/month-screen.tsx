import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  averageScore,
  dayEmber,
  emberColor,
  hasDiagnosis,
  isMonthOpenable,
  monthDates,
  monthGrid,
  monthHeader,
  monthNav,
  previousMonth,
  strongestDay,
  weekDates,
} from '@/core/ember';
import { radius, spacing } from '@/core/theme';
import { DiagnosisModal } from '@/features/diagnosis';
import { useNow } from '@/features/today';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { dayLong, dayNumber, monthName, weekdayLetter } from './format';
import { clearSelectedMonth, selectMonth, useSelectedMonth } from './selected-month';
import { Card, EmberLegend, PeriodNavRow, PeriodScreen, Pill } from './period-screen';
import { useEarliestScored } from './use-earliest-scored';
import { useEmberData } from './use-ember-data';

const CELL = 40;

/**
 * Tab Mjesec (smjer „Žar“): kalendar žarova — svaki prošli dan svijetli prema svom rezultatu,
 * dan bez rezultata je ugašen žar, današnji je obrub u boji plamena, budući su tek ocrtani.
 * Dodir mjeseca u Godini (Ž10) otvara ovdje taj mjesec; strelice listaju mjesece (do mjeseca
 * najranijeg rezultata i ne dalje od tekućeg), „Ovaj mjesec“ vraća na tekući.
 */
export function MonthScreen() {
  const { t, i18n } = useTranslation();
  const { colors, scheme, flame } = useAppTheme();
  const now = useNow();
  const state = useEmberData(now.eveningDate);
  const language = i18n.language;
  const thisMonth = now.date.slice(0, 7);
  // Mjesec odabran dodirom u Godini ili strelicom stoji dok ga „Ovaj mjesec“ ne obriše; neispravan se ignorira.
  const selected = useSelectedMonth();
  const month = selected !== null && isMonthOpenable(selected, now.date) ? selected : thisMonth;
  const header = monthHeader(month, now.date);
  const dates = monthDates(month);
  const before = previousMonth(month);
  const nav = monthNav(month, now.date, useEarliestScored(state));

  const scores = state.data?.scores ?? null;
  const average = scores ? averageScore(dates, scores) : null;
  const beforeAverage = scores && before !== null ? averageScore(monthDates(before), scores) : null;
  const best = scores ? strongestDay(dates, scores) : null;
  // Žar dana s rezultatom otvara dijagnozu tog dana (arhiva dijagnoza, korak 37c).
  const [diagnosisFor, setDiagnosisFor] = useState<string | null>(null);

  return (
    <PeriodScreen
      subtitle={`${month.slice(0, 4)}.`}
      title={monthName(month, language)}
      status={state.status}
      onRetry={state.reload}
      nav={
        <PeriodNavRow
          nav={nav}
          onSelect={selectMonth}
          onCurrent={clearSelectedMonth}
          labels={{
            previous: t('ember.nav.previousMonth'),
            next: t('ember.nav.nextMonth'),
            current: t('ember.month.backToThis'),
            currentHint: t('ember.month.backToThisHint'),
          }}
        />
      }
      pill={
        <Pill>
          <Text variant="caption" style={styles.strong}>
            {header.kind === 'current'
              ? header.daysLeft > 0
                ? t('ember.month.daysLeft', { count: header.daysLeft })
                : t('ember.month.lastDay')
              : t('ember.month.finished')}
          </Text>
        </Pill>
      }>
      {scores ? (
        <>
          <View>
            <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {weekDates(now.date).map((date) => (
                <View key={date} style={styles.cell}>
                  <Text variant="caption" tone="textMuted">
                    {weekdayLetter(date, language)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.grid} accessibilityLabel={t('ember.month.calendar')}>
              {monthGrid(month).map((date, index) => {
                if (date === null) return <View key={`blank-${index}`} style={styles.cell} />;
                const ember = dayEmber(date, now.date, scores);
                const day = dayLong(date, language);
                const color = ember.kind === 'past' ? emberColor(ember.level, scheme, flame) : null;
                const label =
                  ember.kind === 'today'
                    ? t('ember.month.dayToday', { day })
                    : ember.kind === 'future'
                      ? t('ember.month.dayFuture', { day })
                      : ember.score !== null
                        ? t('ember.month.dayScored', { day, score: ember.score })
                        : t('ember.month.dayUnlit', { day });
                const emberView = (
                  <View
                    style={[
                      styles.ember,
                      ember.kind === 'today'
                        ? { borderWidth: 2, borderColor: colors.accent, boxShadow: `0 0 14px ${colors.accent}` }
                        : ember.kind === 'future'
                          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
                          : color !== null && color.fill !== null
                            ? [
                                { backgroundColor: color.fill },
                                scheme === 'dark' && color.glow > 0
                                  ? { boxShadow: `0 0 ${Math.round(12 * color.glow)}px ${color.fill}` }
                                  : null,
                              ]
                            : { borderWidth: 1.5, borderColor: color?.on ?? colors.border },
                    ]}>
                    <Text
                      variant="caption"
                      style={[
                        styles.number,
                        {
                          color:
                            ember.kind === 'today'
                              ? colors.accent
                              : color !== null && color.fill !== null
                                ? color.on
                                : colors.textMuted,
                        },
                      ]}>
                      {dayNumber(date)}
                    </Text>
                  </View>
                );
                return hasDiagnosis(ember) ? (
                  <Pressable
                    key={date}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityHint={t('ember.month.openDiagnosis')}
                    hitSlop={spacing.xs}
                    onPress={() => setDiagnosisFor(date)}
                    style={({ pressed }) => [styles.cell, styles.dayCell, { opacity: pressed ? 0.6 : 1 }]}>
                    {emberView}
                  </Pressable>
                ) : (
                  <View key={date} style={[styles.cell, styles.dayCell]} accessible accessibilityLabel={label}>
                    {emberView}
                  </View>
                );
              })}
            </View>
          </View>

          <EmberLegend />

          {average === null && beforeAverage === null ? (
            <Text tone="textMuted">
              {t(header.kind === 'current' ? 'ember.month.empty' : 'ember.month.emptyPast')}
            </Text>
          ) : (
            <Card label={t('ember.month.compare')}>
              <AverageRow month={monthName(month, language)} score={average} current />
              {before !== null ? <AverageRow month={monthName(before, language)} score={beforeAverage} /> : null}
              {best !== null ? (
                <Text variant="caption" tone="textMuted">
                  {t('ember.month.strongest', { day: dayLong(best.date, language), score: best.score })}
                </Text>
              ) : null}
            </Card>
          )}
        </>
      ) : null}
      {diagnosisFor !== null ? (
        <DiagnosisModal
          date={diagnosisFor}
          dayLabel={dayLong(diagnosisFor, language)}
          onClose={() => setDiagnosisFor(null)}
        />
      ) : null}
    </PeriodScreen>
  );
}

function AverageRow({ month, score, current = false }: { month: string; score: number | null; current?: boolean }) {
  const { t } = useTranslation();
  const label =
    score === null ? t('ember.month.noAverage', { month }) : t('ember.month.average', { month, score });
  return (
    <View style={styles.average} accessible accessibilityLabel={label}>
      <Text variant="caption" tone={current ? 'text' : 'textMuted'} style={[styles.monthName, current ? styles.strong : null]} numberOfLines={1}>
        {month}
      </Text>
      <ProgressBar
        fraction={(score ?? 0) / 100}
        accessibilityLabel={label}
        valueText={score === null ? '' : String(score)}
        style={[styles.bar, current ? null : styles.dim]}
      />
      <Text variant="caption" tone={current ? 'text' : 'textMuted'} style={styles.value}>
        {score === null ? '–' : String(score)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', height: 24 },
  dayCell: { height: CELL + spacing.sm },
  ember: { width: CELL, height: CELL, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 14, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '600' },
  average: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  monthName: { width: 72 },
  bar: { flex: 1 },
  dim: { opacity: 0.45 },
  value: { width: 26, textAlign: 'right', fontWeight: '600', fontVariant: ['tabular-nums'] },
});
