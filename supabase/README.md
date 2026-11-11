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

## Sync (korak 19)

Kad je korisnik prijavljen, app sinkronizira pri pokretanju, po povratku u prvi plan, odmah nakon
prijave i na "Sinkroniziraj sada" (Profil → Račun). Prolaz = pull pa push.

- Lokalno: okidači (`src/db/migrations/0009_sync.sql`) pune `sync_queue` pri svakom upisu u 8 tablica.
  Prva prijava (ili drugi račun) stavlja sve lokalne retke u red.
- Poslužitelj (`20261111103947_sync.sql`): `synced_at` postavlja okidač (kursor pulla ne ovisi o satu
  uređaja), `sync_tombstones` bilježi brisanja (i kaskadna) za druge uređaje.
- Konflikt: cijeli redak, zadnji `updated_at` pobjeđuje; isti dan/razdoblje/postavke s dva uređaja
  (drugi id) — noviji ostaje, stariji se briše.
- Za rad na remoteu moraju biti primijenjene **sve** migracije (`block_notes`, `day_close`, `sync`),
  inače push javlja grešku (nepostojeći stupci) i red ostaje lokalno do sljedećeg pokušaja.
