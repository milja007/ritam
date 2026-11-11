import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';

import { matchesCallbackTarget } from '@/core/auth';

import { authRedirectUrl, completeSignInFromUrl } from './auth-api';
import { setAuthLinkStatus } from './auth-link-status';
import { isAuthEnabled } from './cloud-config';

/**
 * Hvata povratni link magic linka (hladno pokretanje i dok app radi) i dovršava prijavu.
 * Ne renderira ništa; kad je auth isključen, ne radi ništa.
 */
export function AuthLinkHandler() {
  const url = Linking.useLinkingURL();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!isAuthEnabled || !url || !matchesCallbackTarget(url, authRedirectUrl()) || handled.current.has(url)) return;
    handled.current.add(url);
    setAuthLinkStatus('working');
    completeSignInFromUrl(url)
      .then((result) => {
        if (result && !result.ok) console.error('Completing sign-in failed', result.message);
        setAuthLinkStatus(result === null || result.ok ? 'done' : 'failed');
      })
      .catch((error: unknown) => {
        console.error('Completing sign-in failed', error);
        setAuthLinkStatus('failed');
      });
  }, [url]);

  return null;
}
