import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { signOut } from './auth-api';
import { useAuthLinkStatus } from './auth-link-status';
import { SignIn } from './sign-in';
import type { SessionState } from './use-session';

/**
 * Odjeljak "Račun" u Profilu (korak 18). Prikazuje se samo kad je auth uključen (feature flag).
 * Sinkronizacija podataka dolazi s korakom 19 — do tada prijava samo poveže uređaj s računom.
 */
export function AccountCard({ session }: { session: SessionState }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const linkStatus = useAuthLinkStatus();

  if (session.status === 'disabled') return null;

  async function doSignOut() {
    setBusy(true);
    setSignOutFailed(false);
    const result = await signOut().catch((error: unknown) => ({ ok: false as const, message: String(error) }));
    if (!result.ok) {
      console.error('Sign-out failed', result.message);
      setSignOutFailed(true);
    }
    setBusy(false);
  }

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {session.status === 'loading' ? (
        <ActivityIndicator color={colors.accent} />
      ) : session.status === 'signedIn' ? (
        <>
          <Text variant="bodyStrong">{t('profile.account.signedInAs', { email: session.email ?? '—' })}</Text>
          <Text variant="caption" tone="textMuted">
            {t('profile.account.syncSoon')}
          </Text>
          <Button variant="ghost" label={t('profile.account.signOut')} loading={busy} onPress={() => void doSignOut()} />
          {signOutFailed ? (
            <Text tone="danger" accessibilityLiveRegion="assertive">
              {t('profile.account.signOutError')}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text>{t('profile.account.signedOut')}</Text>
          <Button label={t('profile.account.signIn')} onPress={() => setSigningIn(true)} />
        </>
      )}

      {linkStatus === 'working' ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {t('auth.completing')}
        </Text>
      ) : linkStatus === 'failed' ? (
        <Text tone="danger" accessibilityLiveRegion="assertive">
          {t('auth.linkError')}
        </Text>
      ) : null}

      {signingIn ? <SignIn onClose={() => setSigningIn(false)} /> : null}
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
});
