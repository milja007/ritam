import { readCloudConfig, type CloudConfig } from '@/core/auth';

/**
 * `EXPO_PUBLIC_*` varijable Metro ugrađuje samo kad im se pristupa izravno (`process.env.X`),
 * zato se čitaju ovdje, a odluka je u čistom `readCloudConfig`.
 */
export const cloudConfig: CloudConfig = readCloudConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  featureAuth: process.env.EXPO_PUBLIC_FEATURE_AUTH,
});

export const isAuthEnabled = cloudConfig.enabled;
