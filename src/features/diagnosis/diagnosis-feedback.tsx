import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import type { ReportPeriod } from '@/core/domain';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getReport, setReportFeedback } from '@/db/repos';
import { Button } from '@/ui/button';
import { ChoiceGroup } from '@/ui/choice-group';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

const COMMENT_MAX = 2000;

type Answer = 'yes' | 'no';
type Loaded = { key: string; exists: boolean; helpful: boolean | null; comment: string };

const toAnswer = (helpful: boolean | null): Answer | null => (helpful === null ? null : helpful ? 'yes' : 'no');

/**
 * „Pomoglo / Nije pomoglo“ + komentar ispod dijagnoze (korak 31, koncept: „ispod svake
 * dijagnoze“). Odgovor se sprema odmah; komentar na „Spremi komentar“. Spremljeno ide uz
 * dijagnozu (`reports.helpful`, `feedback_comment`) i sinkronizira se kao i ona.
 */
export function DiagnosisFeedback({ period, periodStart }: { period: ReportPeriod; periodStart: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const key = `${period}:${periodStart}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [savedComment, setSavedComment] = useState(false);

  useEffect(() => {
    let active = true;
    getReport(getDb(), LOCAL_USER_ID, period, periodStart)
      .then((report) => {
        if (!active) return;
        const comment = report?.feedbackComment ?? '';
        setLoaded({ key, exists: report !== null, helpful: report?.helpful ?? null, comment });
        setDraft(comment);
        setSavedComment(false);
        setError(false);
      })
      .catch((cause: unknown) => {
        console.error('Loading diagnosis feedback failed', cause);
        if (active) setLoaded({ key, exists: false, helpful: null, comment: '' });
      });
    return () => {
      active = false;
    };
  }, [key, period, periodStart]);

  const current = loaded?.key === key ? loaded : null;

  const save = useCallback(
    (helpful: boolean | null, comment: string): boolean => {
      try {
        setReportFeedback(getDb(), LOCAL_USER_ID, period, periodStart, { helpful, comment });
        setLoaded({ key, exists: true, helpful, comment: comment.trim() });
        setError(false);
        return true;
      } catch (cause: unknown) {
        console.error('Saving diagnosis feedback failed', cause);
        setError(true);
        return false;
      }
    },
    [key, period, periodStart],
  );

  // Dijagnoza još nije spremljena (ili čitanje nije uspjelo) — nema na što odgovoriti.
  if (current === null || !current.exists) return null;

  const answer = toAnswer(current.helpful);
  const commentChanged = draft.trim() !== current.comment;

  const choose = (value: Answer) => {
    const helpful = value === 'yes';
    if (helpful === current.helpful) return;
    if (save(helpful, current.comment)) {
      AccessibilityInfo.announceForAccessibility(t(helpful ? 'diagnosis.feedback.savedYes' : 'diagnosis.feedback.savedNo'));
    }
  };

  const saveComment = () => {
    if (save(current.helpful, draft)) {
      setSavedComment(true);
      AccessibilityInfo.announceForAccessibility(t('diagnosis.feedback.commentSaved'));
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="overline" tone="textMuted" accessibilityRole="header">
        {t('diagnosis.feedback.overline')}
      </Text>
      <Text variant="bodyStrong">{t('diagnosis.feedback.question')}</Text>
      <ChoiceGroup<Answer>
        layout="row"
        accessibilityLabel={t('diagnosis.feedback.question')}
        selected={answer}
        onSelect={choose}
        choices={[
          { value: 'yes', label: t('diagnosis.feedback.yes') },
          { value: 'no', label: t('diagnosis.feedback.no') },
        ]}
      />
      {answer !== null ? (
        <>
          <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
            {t(answer === 'yes' ? 'diagnosis.feedback.thanksYes' : 'diagnosis.feedback.thanksNo')}
          </Text>
          <TextField
            label={t(answer === 'yes' ? 'diagnosis.feedback.commentYes' : 'diagnosis.feedback.commentNo')}
            placeholder={t('diagnosis.feedback.placeholder')}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setSavedComment(false);
            }}
            maxLength={COMMENT_MAX}
            multiline
            style={styles.comment}
          />
          {commentChanged ? (
            <Button variant="secondary" label={t('diagnosis.feedback.saveComment')} onPress={saveComment} />
          ) : savedComment ? (
            <Text variant="caption" tone="success">
              {t('diagnosis.feedback.commentSaved')}
            </Text>
          ) : null}
        </>
      ) : null}
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('diagnosis.feedback.error')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  comment: { minHeight: 88, textAlignVertical: 'top' },
});
