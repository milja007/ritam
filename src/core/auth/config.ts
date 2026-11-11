/**
 * Konfiguracija oblaka (Supabase) iz javnih env varijabli.
 *
 * Auth je iza feature flaga: uključen je samo kad je `EXPO_PUBLIC_FEATURE_AUTH` = `1`/`true`
 * **i** postoje URL i javni ključ. Inače app radi čisto lokalno, kao prije koraka 18.
 */

export type CloudEnv = {
  url?: string;
  key?: string;
  featureAuth?: string;
};

export type CloudConfig =
  | { enabled: true; url: string; key: string }
  | { enabled: false; reason: 'flag-off' | 'missing-url' | 'missing-key' | 'invalid-url' };

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isFlagOn(value: string | undefined): boolean {
  return value !== undefined && TRUTHY.has(value.trim().toLowerCase());
}

export function readCloudConfig(env: CloudEnv): CloudConfig {
  if (!isFlagOn(env.featureAuth)) return { enabled: false, reason: 'flag-off' };
  const url = env.url?.trim() ?? '';
  const key = env.key?.trim() ?? '';
  if (url === '') return { enabled: false, reason: 'missing-url' };
  if (!/^https?:\/\/[^\s/]+/i.test(url)) return { enabled: false, reason: 'invalid-url' };
  if (key === '') return { enabled: false, reason: 'missing-key' };
  return { enabled: true, url: url.replace(/\/+$/, ''), key };
}
