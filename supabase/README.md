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
