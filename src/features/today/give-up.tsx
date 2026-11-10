import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

type GiveUpProps = {
  /** Koliko neriješenih aktivnosti će se zatvoriti. */
  remaining: number;
  /** Zatvori dan; baca grešku ako spremanje ne uspije. */
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
};

/**
 * "Odustajem od svega" (17d): potvrda bez osude. Preostalo postaje neodrađeno (bez XP-a), streak
 * ostaje, a "što se dogodilo" ide u dijagnozu kao kontekst. Nakon potvrde pozivatelj otvara plan
 * za sutra. Glasovni unos dolazi s korakom 30.
 */
export function GiveUp({ remaining, onConfirm, onClose }: GiveUpProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setSaving(true);
    setFailed(false);
    try {
      await onConfirm(note);
    } catch (error: unknown) {
      console.error('Giving up the day failed', error);
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="overline" tone="textMuted">
                {t('giveUp.overline')}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {t('giveUp.title')}
              </Text>
              <Text tone="textMuted">{t('giveUp.body')}</Text>

              <View style={[styles.facts, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text>{t('giveUp.factRemaining', { count: remaining })}</Text>
                <Text>{t('giveUp.factStreak')}</Text>
                <Text>{t('giveUp.factTomorrow')}</Text>
              </View>

              <TextField
                label={t('giveUp.noteLabel')}
                placeholder={t('giveUp.notePlaceholder')}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={2000}
                editable={!saving}
                style={styles.noteInput}
              />
              <Text variant="caption" tone="textMuted">
                {t('giveUp.noteHint')}
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              {failed ? (
                <Text tone="danger" accessibilityLiveRegion="assertive">
                  {t('giveUp.saveError')}
                </Text>
              ) : null}
              <Button label={t('giveUp.confirm')} loading={saving} onPress={() => void confirm()} />
              <Button variant="ghost" label={t('giveUp.cancel')} disabled={saving} onPress={onClose} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  facts: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteInput: { minHeight: 96, textAlignVertical: 'top' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
