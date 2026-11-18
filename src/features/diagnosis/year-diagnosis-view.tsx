import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import type { YearDiagnosis } from '@/core/diagnosis';
import { emberLevel } from '@/core/ember';
import { radius, spacing } from '@/core/theme';
import { monthName, monthShort } from '@/features/ember/format';
import { Ember } from '@/ui/ember';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { WEEK_TREND_ARROW, WEEK_TREND_TONE, WeekProgressRowView } from './week-diagnosis-view';
import { useYearLineText } from './year-line-params';

type LineSection = 'praise' | 'noticed' | 'problems' | 'ideas';
const LINE_SECTIONS: readonly LineSection[] = ['praise', 'noticed', 'problems', 'ideas'];

/** Razmak paljenja susjednih žarova u traci mjeseci (ms) i trajanje jednog paljenja. */
const STRIP_STAGGER_MS = 70;
const STRIP_FADE_MS = 420;
const STRIP_EMBER = 18;

/**
 * Godina po mjesecima: dvanaest žarova, svaki svijetli prema prosjeku mjeseca. Pri prvom
 * prikazu pale se redom, od siječnja do prosinca — godina „izgori u žar“. Uz „smanji kretanje“
 * su odmah upaljeni. Čitač zaslona čita svaki mjesec s prosjekom.
 */
export function YearMonthStrip({ diagnosis }: { diagnosis: YearDiagnosis }) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const language = i18n.language;

  return (
    <View style={styles.strip}>
      {diagnosis.months.map((average, index) => {
        const month = `${diagnosis.year}-${String(index + 1).padStart(2, '0')}`;
        const name = monthName(month, language);
        const label =
          average === null
            ? t('diagnosis.year.monthsLabelEmpty', { month: name })
            : t('diagnosis.year.monthsLabel', { month: name, average });
        return (
          <Animated.View
            key={month}
            entering={reduceMotion ? undefined : FadeIn.delay(index * STRIP_STAGGER_MS).duration(STRIP_FADE_MS)}
            style={styles.stripCell}
            accessible
            accessibilityLabel={label}>
            <Ember size={STRIP_EMBER} level={emberLevel(average)} glow={average !== null} />
            <Text variant="caption" tone="textMuted" style={styles.stripLabel} numberOfLines={1}>
              {monthShort(month, language)}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

/**
 * Prikaz godišnje dijagnoze istim redom kao mjesečna: Ukratko (s trakom mjeseci) → Napredak →
 * Pohvale → Što smo primijetili → Veliki problemi → Smjer za iduću godinu (bez prihvaćanja).
 */
export function YearDiagnosisView({ diagnosis, writing = false }: { diagnosis: YearDiagnosis; writing?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const lineText = useYearLineText();
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const trendLabel = t(`diagnosis.year.trend.${diagnosis.trend}`);
  // Korak 31e: riječi modela zamjenjuju lokalne retke; brojke, trend, mjeseci i smjer ostaju lokalni.
  const { llm } = diagnosis;
  const summaryText = llm ? llm.summary : lineText(diagnosis.summary);
  const sections = LINE_SECTIONS.map((section) => ({
    section,
    lines: llm && section !== 'ideas' ? llm[section] : diagnosis[section].map(lineText),
  })).filter(({ section, lines }) => lines.length > 0 || section === 'ideas');

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
        <Text variant="caption" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.year.monthsTitle')}
        </Text>
        <YearMonthStrip diagnosis={diagnosis} />
      </View>

      <View style={card}>
        <Text variant="overline" tone="textMuted" accessibilityRole="header">
          {t('diagnosis.sections.progress')}
        </Text>
        {diagnosis.progress.map((row) => (
          <WeekProgressRowView key={row.metric} row={row} period="year" />
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
          {section === 'ideas' && llm?.ideasWhy ? (
            <Text variant="caption" tone="textMuted">
              {llm.ideasWhy}
            </Text>
          ) : null}
          {section === 'ideas' ? (
            <Text variant="caption" tone="textMuted">
              {t('diagnosis.year.ideasNote')}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  writingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  strip: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs },
  stripCell: { alignItems: 'center', gap: spacing.xs, flex: 1, minHeight: 44, justifyContent: 'center' },
  stripLabel: { fontSize: 10, lineHeight: 12 },
});
