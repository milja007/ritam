import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  otherDayOptions,
  type ChecklistAnswer,
  type EveningDraft,
  type LaterChoice,
  type RuleAnswer,
} from '@/core/checkin';
import type { CheckinOutcome, Rule, ScheduleBlock } from '@/core/domain';
import { radius, spacing } from '@/core/theme';
import { ChoiceGroup } from '@/ui/choice-group';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

const NOTE_MAX = 2000;

type Answer = 'yes' | 'no';
const toAnswer = (value: boolean | null): Answer | null =>
  value === null ? null : value ? 'yes' : 'no';

function Card({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <Text tone="textMuted">{text}</Text>
    </Card>
  );
}

/** "2026-11-12" → "čet, 12. 11." / "Thu, Nov 12" (po jeziku appa). */
function formatShortDay(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  try {
    return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(value);
  } catch {
    return date;
  }
}

/** Korak 1: svaka stavka dana — U redu / Djelomično / Nije; za ostalo komentar i "kad kasnije?". */
export function ChecklistStep({
  draft,
  blocks,
  onChange,
}: {
  draft: EveningDraft;
  blocks: readonly ScheduleBlock[];
  onChange: (blockId: string, patch: Partial<ChecklistAnswer>) => void;
}) {
  const { t, i18n } = useTranslation();
  const byId = new Map(blocks.map((block) => [block.id, block]));
  if (draft.items.length === 0) return <Empty text={t('evening.checklist.empty')} />;
  const days = otherDayOptions(draft.date);

  function selectOutcome(blockId: string, outcome: CheckinOutcome) {
    // "U redu" nema "kad kasnije?"; ostali zadržavaju već odabrano.
    onChange(blockId, outcome === 'ok' ? { outcome, later: null, laterDate: null } : { outcome });
  }

  function selectLater(blockId: string, later: LaterChoice) {
    onChange(blockId, { later, laterDate: later === 'other' ? (days[0] ?? null) : null });
  }

  return (
    <View style={styles.list}>
      {draft.items.map((item) => {
        const block = byId.get(item.blockId);
        if (!block) return null;
        const needsLater = item.outcome === 'partial' || item.outcome === 'not';
        return (
          <Card key={item.blockId}>
            <Text variant="caption" tone="textMuted" style={styles.time}>
              {t('today.timeRange', { start: block.start, end: block.end })} ·{' '}
              {t(`today.kind.${block.kind}`)}
            </Text>
            <Text variant="bodyStrong">{block.title}</Text>
            <ChoiceGroup<CheckinOutcome>
              layout="row"
              accessibilityLabel={t('evening.checklist.question', { title: block.title })}
              choices={[
                { value: 'ok', label: t('evening.checklist.ok') },
                { value: 'partial', label: t('evening.checklist.partial') },
                { value: 'not', label: t('evening.checklist.notOk') },
              ]}
              selected={item.outcome}
              onSelect={(outcome) => selectOutcome(item.blockId, outcome)}
            />
            {needsLater ? (
              <>
                <TextField
                  label={t('evening.checklist.comment')}
                  placeholder={t('evening.checklist.commentPlaceholder')}
                  value={item.comment}
                  onChangeText={(comment) => onChange(item.blockId, { comment })}
                  maxLength={NOTE_MAX}
                  multiline
                />
                <Text variant="caption" tone="textMuted">
                  {t('evening.checklist.later')}
                </Text>
                <ChoiceGroup<LaterChoice>
                  layout="row"
                  accessibilityLabel={t('evening.checklist.later')}
                  choices={[
                    { value: 'tomorrow', label: t('evening.checklist.laterTomorrow') },
                    { value: 'other', label: t('evening.checklist.laterOther') },
                    { value: 'skip', label: t('evening.checklist.laterSkip') },
                  ]}
                  selected={item.later}
                  onSelect={(later) => selectLater(item.blockId, later)}
                />
                {item.later === 'other' ? (
                  <ChoiceGroup<string>
                    accessibilityLabel={t('evening.checklist.laterDay')}
                    choices={days.map((day) => ({ value: day, label: formatShortDay(day, i18n.language) }))}
                    selected={item.laterDate}
                    onSelect={(laterDate) => onChange(item.blockId, { laterDate })}
                  />
                ) : null}
                {item.later === 'tomorrow' || item.later === 'other' ? (
                  <Text variant="caption" tone="textMuted">
                    {t('evening.checklist.laterHint')}
                  </Text>
                ) : null}
              </>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

/** Korak 2: zabrane koje danas vrijede — Držao sam se / Prekršio sam; za prekršaj okidač. */
export function RulesStep({
  draft,
  rules,
  onChange,
}: {
  draft: EveningDraft;
  rules: readonly Rule[];
  onChange: (ruleId: string, patch: Partial<RuleAnswer>) => void;
}) {
  const { t } = useTranslation();
  const byId = new Map(rules.map((rule) => [rule.id, rule]));

  return (
    <View style={styles.list}>
      {draft.rules.map((answer) => {
        const rule = byId.get(answer.ruleId);
        if (!rule) return null;
        return (
          <Card key={answer.ruleId}>
            <Text variant="bodyStrong">{rule.title}</Text>
            {rule.why.trim().length > 0 ? (
              <Text variant="caption" tone="textMuted">
                {t('evening.rules.why', { why: rule.why })}
              </Text>
            ) : null}
            <ChoiceGroup<Answer>
              layout="row"
              accessibilityLabel={rule.title}
              choices={[
                { value: 'yes', label: t('evening.rules.kept') },
                { value: 'no', label: t('evening.rules.broken') },
              ]}
              selected={toAnswer(answer.kept)}
              onSelect={(value) => onChange(answer.ruleId, { kept: value === 'yes' })}
            />
            {answer.kept === false ? (
              <TextField
                label={t('evening.rules.trigger')}
                placeholder={t('evening.rules.triggerPlaceholder')}
                value={answer.trigger}
                onChangeText={(trigger) => onChange(answer.ruleId, { trigger })}
                maxLength={NOTE_MAX}
              />
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Korak 3: ocjena dana 1–5 + jedna rečenica. */
export function RatingStep({
  draft,
  onChange,
}: {
  draft: EveningDraft;
  onChange: (patch: Partial<Pick<EveningDraft, 'rating' | 'note'>>) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      <ChoiceGroup<number>
        layout="row"
        accessibilityLabel={t('evening.rating.label')}
        choices={RATINGS.map((value) => ({ value, label: String(value) }))}
        selected={draft.rating}
        onSelect={(rating) => onChange({ rating })}
      />
      <View style={styles.scale}>
        <Text variant="caption" tone="textMuted">
          {t('evening.rating.low')}
        </Text>
        <Text variant="caption" tone="textMuted">
          {t('evening.rating.high')}
        </Text>
      </View>
      <TextField
        label={t('evening.rating.note')}
        placeholder={t('evening.rating.notePlaceholder')}
        value={draft.note}
        onChangeText={(note) => onChange({ note })}
        maxLength={NOTE_MAX}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  time: { fontVariant: ['tabular-nums'] },
  scale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
});
