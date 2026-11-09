import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { ChecklistAnswer, EveningDraft, RuleAnswer } from '@/core/checkin';
import type { Rule, ScheduleBlock } from '@/core/domain';
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

/** Korak 1: svaka stavka dana — U redu / Nije; za "Nije" komentar. */
export function ChecklistStep({
  draft,
  blocks,
  onChange,
}: {
  draft: EveningDraft;
  blocks: readonly ScheduleBlock[];
  onChange: (blockId: string, patch: Partial<ChecklistAnswer>) => void;
}) {
  const { t } = useTranslation();
  const byId = new Map(blocks.map((block) => [block.id, block]));
  if (draft.items.length === 0) return <Empty text={t('evening.checklist.empty')} />;

  return (
    <View style={styles.list}>
      {draft.items.map((item) => {
        const block = byId.get(item.blockId);
        if (!block) return null;
        return (
          <Card key={item.blockId}>
            <Text variant="caption" tone="textMuted" style={styles.time}>
              {t('today.timeRange', { start: block.start, end: block.end })} ·{' '}
              {t(`today.kind.${block.kind}`)}
            </Text>
            <Text variant="bodyStrong">{block.title}</Text>
            <ChoiceGroup<Answer>
              layout="row"
              accessibilityLabel={t('evening.checklist.question', { title: block.title })}
              choices={[
                { value: 'yes', label: t('evening.checklist.ok') },
                { value: 'no', label: t('evening.checklist.notOk') },
              ]}
              selected={toAnswer(item.ok)}
              onSelect={(value) => onChange(item.blockId, { ok: value === 'yes' })}
            />
            {item.ok === false ? (
              <TextField
                label={t('evening.checklist.comment')}
                placeholder={t('evening.checklist.commentPlaceholder')}
                value={item.comment}
                onChangeText={(comment) => onChange(item.blockId, { comment })}
                maxLength={NOTE_MAX}
                multiline
              />
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
