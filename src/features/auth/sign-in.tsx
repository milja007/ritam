import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidEmail, normalizeEmail } from '@/core/auth';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { sendMagicLink } from './auth-api';

type Phase = { kind: 'form' } | { kind: 'sent'; email: string };

/**
 * Prijava e-mailom (magic link, korak 18). Bez lozinke: upiši e-mail → link stiže na mail →
 * dodir otvara app (`ritam://auth/callback`) i `AuthLinkHandler` dovršava prijavu.
 * Prijava je neobavezna — app i bez nje radi lokalno.
 */
export function SignIn({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<'invalid' | 'send' | null>(null);

  async function send(address: string) {
    if (!isValidEmail(address)) {
      setError('invalid');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await sendMagicLink(address);
      if (result.ok) setPhase({ kind: 'sent', email: normalizeEmail(address) });
      else {
        console.error('Sending the magic link failed', result.message);
        setError('send');
      }
    } catch (failure: unknown) {
      console.error('Sending the magic link failed', failure);
      setError('send');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="overline" tone="textMuted">
                {t('auth.overline')}
              </Text>
              {phase.kind === 'form' ? (
                <>
                  <Text variant="title" accessibilityRole="header">
                    {t('auth.title')}
                  </Text>
                  <Text tone="textMuted">{t('auth.body')}</Text>
                  <TextField
                    label={t('auth.emailLabel')}
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error === 'invalid') setError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={() => void send(email)}
                    editable={!sending}
                    maxLength={254}
                  />
                  <Text variant="caption" tone="textMuted">
                    {t('auth.localNote')}
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="title" accessibilityRole="header">
                    {t('auth.sentTitle')}
                  </Text>
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text>{t('auth.sentBody', { email: phase.email })}</Text>
                    <Text variant="caption" tone="textMuted">
                      {t('auth.sentHint')}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              {error ? (
                <Text tone="danger" accessibilityLiveRegion="assertive">
                  {t(error === 'invalid' ? 'auth.invalidEmail' : 'auth.sendError')}
                </Text>
              ) : null}
              {phase.kind === 'form' ? (
                <Button label={t('auth.send')} loading={sending} onPress={() => void send(email)} />
              ) : (
                <>
                  <Button label={t('auth.done')} onPress={onClose} />
                  <Button
                    variant="ghost"
                    label={t('auth.resend')}
                    loading={sending}
                    onPress={() => void send(phase.email)}
                  />
                  <Button
                    variant="ghost"
                    label={t('auth.changeEmail')}
                    disabled={sending}
                    onPress={() => setPhase({ kind: 'form' })}
                  />
                </>
              )}
              {phase.kind === 'form' ? (
                <Button variant="ghost" label={t('auth.cancel')} disabled={sending} onPress={onClose} />
              ) : null}
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
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
