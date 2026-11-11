# Supabase (Ritam)

- `migrations/` — izvor istine za shemu na Supabaseu (projekt `ritam`, ref `imsbokdyusrwyvyjvjfw`).
  Ime datoteke = verzija migracije na remoteu (`YYYYMMDDHHMMSS_ime.sql`).
- Svaka lokalna promjena sheme (`src/db/schema.ts` + Drizzle migracija) treba i Supabase migraciju;
  `src/db/supabase-parity.test.ts` pada dok stupac ne postoji i ovdje.
- RLS: svaka tablica — vlasnik (`auth.uid() = user_id`) za `authenticated`; `anon` bez pristupa;
  `llm_calls` piše samo Edge Function (service role), korisnik čita svoje.

## Provjera prije primjene na remote

```bash
npm run test:supabase   # privremeni Postgres + stub `auth`, sve migracije, tests/schema.sql
```

S Dockerom: `npx supabase start && npx supabase db reset` (pravi lokalni Supabase).
Na remote tek kad lokalna provjera prođe (MCP `apply_migration` ili `npx supabase db push`).

## Prijava e-mailom (korak 18)

Prijava je iza feature flaga i zadano isključena — bez nje app radi čisto lokalno.

1. U `.env` (kopija `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable ključ iz Supabase → Project Settings → API Keys) i `EXPO_PUBLIC_FEATURE_AUTH=1`. Zatim ponovo `npx expo start`.
2. Supabase dashboard → Authentication → URL Configuration → **Redirect URLs**: dodaj `ritam://auth/callback` (dev build) i po želji `exp://**` (Expo Go). Bez toga Supabase vraća na Site URL umjesto u app.
3. Profil → Račun → "Prijavi se e-mailom" → link s maila otvori **na istom uređaju** (PKCE: kod se zamjenjuje sesijom koju je app započeo).

Sinkronizacija podataka je korak 19; do tada prijava samo povezuje uređaj s računom.
