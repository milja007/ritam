import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BlockStatus, ScheduleBlock } from '@/core/domain';
import { blockActions, isCancelled, normalizeNote, type BlockPhase } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { ReportPills } from './report-pills';

type BlockSheetProps = {
  block: ScheduleBlock;
  phase: BlockPhase;
  onReport: (status: BlockStatus) => Promise<void>;
  onSaveNote: (note: string | null) => Promise<void>;
  /** Otkaži ili vrati otkazanu aktivnost u plan. */
  onToggleCancel: () => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
};

/**
 * Akcije jedne aktivnosti (17c) — samo one koje faza dopušta: prijava (prošle),
 * Komentar = bilješka (trenutna i prošle), Otkaži (trenutna i buduće), Uredi.
 */
export function BlockSheet({ block, phase, onReport, onSaveNote, onToggleCancel, onEdit, onClose }: BlockSheetProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const actions = blockActions(block, phase);
  const [note, setNote] = useState(block.note ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelled = isCancelled(block);
  const noteChanged = normalizeNote(note) !== (block.note ?? null);

  async function run(action: () => Promise<void>, close: boolean) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      if (close) onClose();
      else setBusy(false);
    } catch (error: unknown) {
      console.error('Block action failed', error);
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('today.sheet.close')}
          onPress={onClose}
        />
        <SafeAreaView
          edges={['bottom']}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text variant="caption" tone="textMuted" style={styles.tabular}>
              {t('today.timeRange', { start: block.start, end: block.end })} · {t(`today.phase.${phase}`)}
            </Text>
            <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
              {block.title}
            </Text>
          </View>

          {actions.report.length > 1 ? (
            <View style={styles.section}>
              <Text variant="caption" tone="textMuted">
                {t('today.sheet.howWent')}
              </Text>
              <ReportPills
                status={block.status}
                disabled={busy}
                onReport={(status) => void run(() => onReport(status), false)}
              />
            </View>
          ) : null}

          {actions.comment ? (
            <View style={styles.section}>
              <TextField
                label={t('today.note.label')}
                placeholder={t('today.note.placeholder')}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={2000}
                editable={!busy}
                style={styles.noteInput}
              />
              {noteChanged ? (
                <Button
                  label={t('today.note.save')}
                  loading={busy}
                  onPress={() => void run(() => onSaveNote(normalizeNote(note)), true)}
                />
              ) : null}
            </View>
          ) : (
            <Text variant="caption" tone="textMuted">
              {t('today.note.onlyNowOrPast')}
            </Text>
          )}

          {failed ? (
            <Text tone="danger" accessibilityLiveRegion="assertive">
              {t('today.actionError')}
            </Text>
          ) : null}

          <View style={styles.footer}>
            {actions.cancel ? (
              <Button
                variant="secondary"
                label={cancelled ? t('today.sheet.restore') : t('today.sheet.cancelActivity')}
                disabled={busy}
                onPress={() => void run(onToggleCancel, true)}
                style={styles.footerButton}
              />
            ) : null}
            <Button
              variant="secondary"
              label={t('today.sheet.edit')}
              disabled={busy}
              onPress={onEdit}
              style={styles.footerButton}
            />
          </View>
          <Button variant="ghost" label={t('today.sheet.close')} onPress={onClose} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill },
  header: { gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  section: { gap: spacing.sm },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1 },
});
