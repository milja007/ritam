import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { Trend, WeekDiagnosis, WeekLine, WeekProgressRow } from '@/core/diagnosis';
import { radius, spacing } from '@/core/theme';
import { formatEuro } from '@/features/trackers/format';
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

/** "2026-11-12" → "12. studenoga" / "November 12"; neispravan datum ostaje kakav je. */
export function dayMonthName(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || [y, m, d].some((part) => !Number.isFinite(part))) {
    return date;
  }
  try {
    return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-US', { day: 'numeric', month: 'long' }).format(
      new Date(y, m - 1, d),
    );
  } catch {
    return date;
  }
}

/**
 * Iznosi u centima (`…Cents`, trackeri) dobivaju i formatirani euro pod imenom bez nastavka
 * (`diffCents` → `diff`), isto kao u dnevnoj dijagnozi.
 */
export function withEuroParams(
  params: Record<string, string | number>,
  language: string,
): Record<string, string | number> {
  for (const [name, value] of Object.entries(params)) {
    if (name.endsWith('Cents') && typeof value === 'number') {
      params[name.slice(0, -'Cents'.length)] = formatEuro(value, language);
    }
  }
  return params;
}

/** Parametri retka za prikaz: svaki `…Date` parametar postaje naziv dana na jeziku appa. */
export function weekLineParams(line: WeekLine, language: string): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(line.params ?? {})) {
    params[name] = name.endsWith('Date') && typeof value === 'string' ? weekdayName(value, language) : value;
  }
  return withEuroParams(params, language);
}

type WeekDiagnosisViewProps = {
  diagnosis: WeekDiagnosis;
  /** Odgovor na prijedlog tjedna; `null` = još nema odgovora. */
  accepted: boolean | null;
  /** Spremi odgovor; vraća je li uspjelo. */
  onAnswer: (accepted: boolean) => boolean;
  /** Čekaju se riječi modela (korak 31c). */
  writing?: boolean;
};

/**
 * Prikaz tjedne dijagnoze redom iz koncepta: Ukratko → Napredak → Pohvale → Što smo primijetili →
 * Veliki problemi → Ideje za napredak. Ideja je uvijek jedna („malo po malo“), a ispod nje se
 * odgovara: „Probat ću“ ili „Ne sada“. Prazna sekcija se ne crta (pregled „zadnjih 7 dana“ nema ideja).
 */
export function WeekDiagnosisView({ diagnosis, accepted, onAnswer, writing = false }: WeekDiagnosisViewProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = (line: WeekLine) => t(`diagnosis.week.lines.${line.key}`, weekLineParams(line, i18n.language));
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const trendLabel = t(`diagnosis.week.trend.${diagnosis.trend}`);
  // Korak 31c: riječi modela zamjenjuju lokalne retke; brojke, trend i promjena tjedna ostaju lokalni.
  const { llm } = diagnosis;
  const summaryText = llm ? llm.summary : lineText(diagnosis.summary);
  const sectionLines = (section: LineSection): string[] =>
    llm && section !== 'ideas' ? llm[section] : diagnosis[section].map(lineText);
  // Model smije ostaviti sekciju praznom (npr. bez velikih problema) — tada se ne prikazuje.
  const sections = LINE_SECTIONS.map((section) => ({ section, lines: sectionLines(section) })).filter(
    ({ lines }) => lines.length > 0,
  );

  return (
    <View style={styles.root}>
      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.summary')}
        </Text>
        <View style={styles.summaryRow} accessible accessibilityLabel={`${trendLabel}. ${summaryText}`}>
          <Text variant="title" tone={WEEK_TREND_TONE[diagnosis.trend]}>
            {WEEK_TREND_ARROW[diagnosis.trend]}
          </Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone={WEEK_TREND_TONE[diagnosis.trend]}>
              {trendLabel}
            </Text>
            <Text>{summaryText}</Text>
          </View>
        </View>
        {writing ? (
          <View style={styles.writingRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.accent} />
            <Text variant="caption" tone="textMuted">
              {t('diagnosis.writing')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.progress')}
        </Text>
        {diagnosis.progress.map((row) => (
          <WeekProgressRowView key={row.metric} row={row} period="week" />
        ))}
      </View>

      {sections.map(({ section, lines }) => (
        <View
          key={section}
          style={[card, section === 'ideas' ? { borderColor: colors.accent, borderWidth: 1 } : null]}>
          <Text variant="overline" tone={section === 'ideas' ? 'accent' : 'textMuted'} accessibilityRole="header">
            {t(`diagnosis.sections.${section}`)}
          </Text>
          {lines.map((text, index) => (
            <View key={`${section}-${index}`} style={styles.bulletRow}>
              <Text tone={section === 'ideas' ? 'accent' : 'textMuted'} importantForAccessibility="no">
                •
              </Text>
              <Text style={styles.flex}>{text}</Text>
            </View>
          ))}
          {section === 'ideas' && llm?.ideaWhy ? (
            <Text variant="caption" tone="textMuted">
              {llm.ideaWhy}
            </Text>
          ) : null}
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

type ProgressRowProps = {
  row: WeekProgressRow;
  /** Tjedan: najbolji dan je naziv dana; mjesec i godina: datum. Oznake i „prije“ po razdoblju. */
  period: 'week' | 'month' | 'year';
};

/** Redak napretka tjedne ili mjesečne dijagnoze: oznaka, vrijednost sa strelicom, prethodno razdoblje. */
export function WeekProgressRowView({ row, period }: ProgressRowProps) {
  const { t, i18n } = useTranslation();
  const dayLabel = (date: string) => (period === 'week' ? weekdayName(date, i18n.language) : dayMonthName(date, i18n.language));
  const number = (value: number) => value.toLocaleString(i18n.language);

  const format = (value: number, total?: number): string => {
    switch (row.metric) {
      case 'average':
        return t('diagnosis.value.score', { score: number(value) });
      case 'days':
      case 'plan':
      case 'rules':
      case 'calories':
        return t('diagnosis.value.ofTotal', { value: number(value), total: number(total ?? 0) });
      case 'money':
        return t('diagnosis.value.money', {
          value: formatEuro(value, i18n.language),
          budget: formatEuro(total ?? 0, i18n.language),
        });
      case 'sleep':
        return t('diagnosis.value.duration', { hours: Math.floor(value / 60), minutes: value % 60 });
      case 'xp':
        return t('diagnosis.value.xp', { xp: number(value) });
      case 'rating':
        return t('diagnosis.value.rating', { rating: number(value) });
      case 'best':
        return t('diagnosis.week.value.best', {
          day: row.date === undefined ? '' : dayLabel(row.date),
          score: number(value),
        });
      case 'betterWeeks':
        return t('diagnosis.week.value.weeks', { count: value });
    }
  };

  const current = format(row.value, row.total);
  const previousValue = row.previous === null ? null : format(row.previous, row.previousTotal);
  const previous =
    previousValue === null
      ? null
      : t(`diagnosis.${period}.previous`, { value: previousValue });
  const tone: NonNullable<TextProps['tone']> =
    row.good === true ? 'success' : row.good === false ? 'textMuted' : 'info';
  const label =
    period !== 'week' && row.metric !== 'betterWeeks'
      ? t(`diagnosis.${period}.metric.${row.metric}`)
      : t(`diagnosis.week.metric.${row.metric}`);

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
  writingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metricValues: { alignItems: 'flex-end' },
  answer: { gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  answerButtons: { flexDirection: 'row', gap: spacing.sm },
});
