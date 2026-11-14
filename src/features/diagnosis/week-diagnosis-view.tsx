import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Trend, WeekDiagnosis, WeekLine, WeekProgressRow } from '@/core/diagnosis';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text, type TextProps } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

export const WEEK_TREND_ARROW: Record<Trend, string> = { better: '↑', same: '→', worse: '↓', first: '✦' };
// Bez crvenog: „slabije“ je informacija, ne kazna.
export const WEEK_TREND_TONE: Record<Trend, NonNullable<TextProps['tone']>> = {
  better: 'success',
  same: 'info',
  worse: 'textMuted',
  first: 'accent',
};
const CHANGE_ARROW = { up: '↑', down: '↓', same: '→' } as const;

type LineSection = 'praise' | 'noticed' | 'problems' | 'ideas';
const LINE_SECTIONS: readonly LineSection[] = ['praise', 'noticed', 'problems', 'ideas'];

/** "2026-11-11" → "srijeda" / "Wednesday"; neispravan datum ostaje kakav je. */
export function weekdayName(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || [y, m, d].some((part) => !Number.isFinite(part))) {
    return date;
  }
  try {
    return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-US', { weekday: 'long' }).format(
      new Date(y, m - 1, d),
    );
  } catch {
    return date;
  }
}

/** Parametri retka za prikaz: svaki `…Date` parametar postaje naziv dana na jeziku appa. */
export function weekLineParams(line: WeekLine, language: string): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(line.params ?? {})) {
    params[name] = name.endsWith('Date') && typeof value === 'string' ? weekdayName(value, language) : value;
  }
  return params;
}

type WeekDiagnosisViewProps = {
  diagnosis: WeekDiagnosis;
  /** Odgovor na prijedlog tjedna; `null` = još nema odgovora. */
  accepted: boolean | null;
  /** Spremi odgovor; vraća je li uspjelo. */
  onAnswer: (accepted: boolean) => boolean;
};

/**
 * Prikaz tjedne dijagnoze redom iz koncepta: Ukratko → Napredak → Pohvale → Što smo primijetili →
 * Veliki problemi → Ideje za napredak. Ideja je uvijek jedna („malo po malo“), a ispod nje se
 * odgovara: „Probat ću“ ili „Ne sada“.
 */
export function WeekDiagnosisView({ diagnosis, accepted, onAnswer }: WeekDiagnosisViewProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = (line: WeekLine) => t(`diagnosis.week.lines.${line.key}`, weekLineParams(line, i18n.language));
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const trendLabel = t(`diagnosis.week.trend.${diagnosis.trend}`);

  return (
    <View style={styles.root}>
      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.summary')}
        </Text>
        <View style={styles.summaryRow} accessible accessibilityLabel={`${trendLabel}. ${lineText(diagnosis.summary)}`}>
          <Text variant="title" tone={WEEK_TREND_TONE[diagnosis.trend]}>
            {WEEK_TREND_ARROW[diagnosis.trend]}
          </Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone={WEEK_TREND_TONE[diagnosis.trend]}>
              {trendLabel}
            </Text>
            <Text>{lineText(diagnosis.summary)}</Text>
          </View>
        </View>
      </View>

      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.progress')}
        </Text>
        {diagnosis.progress.map((row) => (
          <WeekProgressRowView key={row.metric} row={row} />
        ))}
      </View>

      {LINE_SECTIONS.map((section) => (
        <View
          key={section}
          style={[card, section === 'ideas' ? { borderColor: colors.accent, borderWidth: 1 } : null]}>
          <Text variant="overline" tone={section === 'ideas' ? 'accent' : 'textMuted'} accessibilityRole="header">
            {t(`diagnosis.sections.${section}`)}
          </Text>
          {diagnosis[section].map((line, index) => (
            <View key={`${line.key}-${index}`} style={styles.bulletRow}>
              <Text tone={section === 'ideas' ? 'accent' : 'textMuted'} importantForAccessibility="no">
                •
              </Text>
              <Text style={styles.flex}>{lineText(line)}</Text>
            </View>
          ))}
          {section === 'ideas' && diagnosis.suggestion !== null ? (
            <SuggestionAnswer carried={diagnosis.carried} accepted={accepted} onAnswer={onAnswer} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

type SuggestionAnswerProps = { carried: boolean; accepted: boolean | null; onAnswer: (accepted: boolean) => boolean };

/** Odgovor na prijedlog tjedna. Prenesena promjena je već prihvaćena, pa se ne pita ponovno. */
function SuggestionAnswer({ carried, accepted, onAnswer }: SuggestionAnswerProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

  if (carried) {
    return (
      <Text variant="caption" tone="textMuted">
        {t('diagnosis.week.suggestion.carried')}
      </Text>
    );
  }

  const answer = (value: boolean) => {
    const saved = onAnswer(value);
    setFailed(!saved);
    if (saved) setEditing(false);
  };

  if (accepted !== null && !editing) {
    return (
      <View style={[styles.answer, { borderTopColor: colors.border }]} accessibilityLiveRegion="polite">
        <Text tone={accepted ? 'success' : 'textMuted'}>
          {t(accepted ? 'diagnosis.week.suggestion.accepted' : 'diagnosis.week.suggestion.rejected')}
        </Text>
        <Button variant="ghost" label={t('diagnosis.week.suggestion.change')} onPress={() => setEditing(true)} />
      </View>
    );
  }

  return (
    <View style={[styles.answer, { borderTopColor: colors.border }]}>
      <Text variant="bodyStrong">{t('diagnosis.week.suggestion.question')}</Text>
      <View style={styles.answerButtons}>
        <Button style={styles.flex} label={t('diagnosis.week.suggestion.accept')} onPress={() => answer(true)} />
        <Button
          style={styles.flex}
          variant="secondary"
          label={t('diagnosis.week.suggestion.reject')}
          onPress={() => answer(false)}
        />
      </View>
      {failed ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('diagnosis.week.suggestion.saveError')}
        </Text>
      ) : null}
    </View>
  );
}

function WeekProgressRowView({ row }: { row: WeekProgressRow }) {
  const { t, i18n } = useTranslation();
  const number = (value: number) => value.toLocaleString(i18n.language);

  const format = (value: number, total?: number): string => {
    switch (row.metric) {
      case 'average':
        return t('diagnosis.value.score', { score: number(value) });
      case 'days':
      case 'plan':
      case 'rules':
        return t('diagnosis.value.ofTotal', { value: number(value), total: number(total ?? 0) });
      case 'sleep':
        return t('diagnosis.value.duration', { hours: Math.floor(value / 60), minutes: value % 60 });
      case 'xp':
        return t('diagnosis.value.xp', { xp: number(value) });
      case 'rating':
        return t('diagnosis.value.rating', { rating: number(value) });
      case 'best':
        return t('diagnosis.week.value.best', {
          day: row.date === undefined ? '' : weekdayName(row.date, i18n.language),
          score: number(value),
        });
      case 'betterWeeks':
        return t('diagnosis.week.value.weeks', { count: value });
    }
  };

  const current = format(row.value, row.total);
  const previous =
    row.previous === null ? null : t('diagnosis.week.previous', { value: format(row.previous, row.previousTotal) });
  const tone: NonNullable<TextProps['tone']> =
    row.good === true ? 'success' : row.good === false ? 'textMuted' : 'info';
  const label = t(`diagnosis.week.metric.${row.metric}`);

  return (
    <View
      style={styles.metricRow}
      accessible
      accessibilityLabel={[label, current, previous].filter((part) => part !== null).join(', ')}>
      <Text style={styles.flex} tone="textMuted">
        {label}
      </Text>
      <View style={styles.metricValues}>
        <Text variant="bodyStrong">
          {current}
          {row.change !== null ? <Text tone={tone}>{` ${CHANGE_ARROW[row.change]}`}</Text> : null}
        </Text>
        {previous !== null ? (
          <Text variant="caption" tone="textMuted">
            {previous}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metricValues: { alignItems: 'flex-end' },
  answer: { gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  answerButtons: { flexDirection: 'row', gap: spacing.sm },
});
