import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PLAN_MAX_ANSWER_LENGTH, planAnswers, type PlanAnswer, type PlanItem, type PlanProposal } from '@/core/schedule';
import { spacing } from '@/core/theme';
import { ExistingRow } from '@/features/today/plan-parts';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';

type PlanProposalViewProps<T extends PlanItem> = {
  proposal: PlanProposal<T>;
  onAccept: () => void;
  onBack: () => void;
  /** Korak 22: odgovori na pitanja → isti popis se slaže ponovo, s odgovorima za model. */
  onAnswer: (answers: PlanAnswer[]) => void;
  /** Ponovno slaganje u tijeku. */
  busy: boolean;
  /** Ponovno slaganje nije uspjelo (prijedlog ostaje). */
  error: boolean;
};

/**
 * Prijedlog „Složi mi dan“ (korak 22): sažetak, raspored, što nije stalo i pitanja. Korisnik
 * prihvaća ili se vraća na svoj popis; ništa se ne sprema dok ne potvrdi plan.
 */
export function PlanProposalView<T extends PlanItem>({
  proposal,
  onAccept,
  onBack,
  onAnswer,
  busy,
  error,
}: PlanProposalViewProps<T>) {
  const { t } = useTranslation();
  const hasBlocks = proposal.drafts.length > 0;
  // Odgovori po indeksu pitanja; novi prijedlog dolazi s novim `key`, pa kreću prazni.
  const [replies, setReplies] = useState<string[]>([]);
  const answers = planAnswers(proposal.questions, replies);

  function setReply(index: number, value: string) {
    setReplies((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  return (
    <View style={styles.root}>
      <Text variant="overline" tone="accent">
        {t('evening.plan.overline')}
      </Text>
      <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
        {t(hasBlocks ? 'evening.plan.title' : 'evening.plan.titleEmpty')}
      </Text>
      {proposal.summary ? <Text tone="textMuted">{proposal.summary}</Text> : null}

      {hasBlocks ? (
        <View style={styles.section}>
          {proposal.drafts.map((draft, index) => (
            <ExistingRow key={`${draft.start}-${index}`} block={draft} />
          ))}
        </View>
      ) : null}

      {proposal.leftOut.length > 0 ? (
        <View style={styles.section}>
          <Text variant="caption" tone="textMuted">
            {t('evening.plan.leftOut')}
          </Text>
          {proposal.leftOut.map((item, index) => (
            <Text key={`${item.draft.title}-${index}`}>• {item.draft.title}</Text>
          ))}
        </View>
      ) : null}

      {proposal.questions.length > 0 ? (
        <View style={styles.section}>
          <Text variant="caption" tone="textMuted">
            {t('evening.plan.questions')}
          </Text>
          {proposal.questions.map((question, index) => (
            <TextField
              key={`${index}-${question}`}
              label={question}
              placeholder={t('evening.plan.answerPlaceholder')}
              value={replies[index] ?? ''}
              onChangeText={(value) => setReply(index, value)}
              maxLength={PLAN_MAX_ANSWER_LENGTH}
              editable={!busy}
              dictation
            />
          ))}
          <Button
            variant="secondary"
            label={t('evening.plan.answer')}
            accessibilityHint={t('evening.plan.answerHint')}
            disabled={answers.length === 0}
            loading={busy}
            onPress={() => onAnswer(answers)}
          />
          {error ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              {t('evening.plan.error')}
            </Text>
          ) : null}
          <Text variant="caption" tone="textMuted">
            {t('evening.plan.questionsHint')}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {hasBlocks ? (
          <Button
            label={t('evening.plan.accept')}
            accessibilityHint={t('evening.plan.acceptHint')}
            onPress={onAccept}
            disabled={busy}
          />
        ) : null}
        <Button variant="secondary" label={t('evening.plan.back')} onPress={onBack} disabled={busy} />
        <Text variant="caption" tone="textMuted">
          {t('evening.plan.nothingSaved')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.lg, gap: spacing.sm },
  section: { marginTop: spacing.md, gap: spacing.sm },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
});
