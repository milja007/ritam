import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BlockKind } from '@/core/domain';
import {
  canShiftEnd,
  canShiftStart,
  isBlockDraftValid,
  MANUAL_BLOCK_KINDS,
  shiftDraftEnd,
  shiftDraftStart,
  type BlockDraft,
} from '@/core/schedule';
import { spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { ChoiceGroup } from '@/ui/choice-group';
import { Stepper } from '@/ui/stepper';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

type BlockEditorProps = {
  mode: 'add' | 'edit';
  initial: BlockDraft;
  onSave: (draft: BlockDraft) => Promise<void>;
  /** Samo kod uređivanja. */
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

const isManualKind = (kind: BlockKind): kind is (typeof MANUAL_BLOCK_KINDS)[number] =>
  (MANUAL_BLOCK_KINDS as readonly BlockKind[]).includes(kind);

/** Modal za dodavanje/uređivanje bloka: naziv, početak i kraj (±15 min), tip; Spremi / Obriši / Odustani. */
export function BlockEditor({ mode, initial, onSave, onDelete, onClose }: BlockEditorProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<BlockDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      onClose();
    } catch (error: unknown) {
      console.error('Saving block failed', error);
      setFailed(true);
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(t('today.editor.deleteTitle'), t('today.editor.deleteMessage', { title: draft.title }), [
      { text: t('today.editor.cancel'), style: 'cancel' },
      { text: t('today.editor.delete'), style: 'destructive', onPress: () => void run(onDelete) },
    ]);
  }

  const startLabel = t('today.editor.start');
  const endLabel = t('today.editor.end');
  const kindChoices = MANUAL_BLOCK_KINDS.map((kind) => ({ value: kind, label: t(`today.kind.${kind}`) }));

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={busy ? undefined : onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text variant="title" accessibilityRole="header">
              {mode === 'add' ? t('today.editor.addTitle') : t('today.editor.editTitle')}
            </Text>

            <TextField
              label={t('today.editor.name')}
              placeholder={t('today.editor.namePlaceholder')}
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              maxLength={200}
              autoFocus={mode === 'add'}
              returnKeyType="done"
            />

            <Stepper
              label={startLabel}
              value={draft.start}
              onDecrease={() => setDraft(shiftDraftStart(draft, -1))}
              onIncrease={() => setDraft(shiftDraftStart(draft, 1))}
              canDecrease={canShiftStart(draft, -1)}
              canIncrease={canShiftStart(draft, 1)}
              decreaseLabel={t('today.editor.decrease', { label: startLabel })}
              increaseLabel={t('today.editor.increase', { label: startLabel })}
            />
            <Stepper
              label={endLabel}
              value={draft.end}
              onDecrease={() => setDraft(shiftDraftEnd(draft, -1))}
              onIncrease={() => setDraft(shiftDraftEnd(draft, 1))}
              canDecrease={canShiftEnd(draft, -1)}
              canIncrease={canShiftEnd(draft, 1)}
              decreaseLabel={t('today.editor.decrease', { label: endLabel })}
              increaseLabel={t('today.editor.increase', { label: endLabel })}
            />

            <View style={styles.field}>
              <Text variant="caption" tone="textMuted">
                {t('today.editor.kind')}
              </Text>
              {isManualKind(draft.kind) ? (
                <ChoiceGroup
                  layout="row"
                  accessibilityLabel={t('today.editor.kind')}
                  choices={kindChoices}
                  selected={draft.kind}
                  onSelect={(kind) => setDraft({ ...draft, kind })}
                />
              ) : (
                <Text>{t(`today.kind.${draft.kind}`)}</Text>
              )}
            </View>

            {failed ? (
              <Text tone="danger" accessibilityLiveRegion="assertive">
                {t('today.editor.error')}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={t('today.editor.save')}
              disabled={!isBlockDraftValid(draft)}
              loading={busy}
              onPress={() => void run(() => onSave(draft))}
            />
            <View style={styles.row}>
              <Button variant="ghost" label={t('today.editor.cancel')} onPress={onClose} disabled={busy} />
              {mode === 'edit' && onDelete ? (
                <Button
                  variant="ghost"
                  label={t('today.editor.delete')}
                  onPress={confirmDelete}
                  disabled={busy}
                />
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  field: { gap: spacing.xs },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
