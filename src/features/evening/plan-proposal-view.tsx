import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { PlanItem, PlanProposal } from '@/core/schedule';
import { spacing } from '@/core/theme';
import { ExistingRow } from '@/features/today/plan-parts';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';

type PlanProposalViewProps<T extends PlanItem> = {
  proposal: PlanProposal<T>;
  onAccept: () => void;
  onBack: () => void;
};

/**
 * Prijedlog „Složi mi dan“ (korak 22): sažetak, raspored, što nije stalo i pitanja. Korisnik
 * prihvaća ili se vraća na svoj popis; ništa se ne sprema dok ne potvrdi plan.
 */
export function PlanProposalView<T extends PlanItem>({ proposal, onAccept, onBack }: PlanProposalViewProps<T>) {
  const { t } = useTranslation();
  const hasBlocks = proposal.drafts.length > 0;
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
            <Text key={`${index}-${question}`}>• {question}</Text>
          ))}
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
          />
        ) : null}
        <Button variant="secondary" label={t('evening.plan.back')} onPress={onBack} />
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
