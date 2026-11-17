# Ritam

Osobni productivity app (React Native / **Expo SDK 58**, Expo Router, TypeScript strict, HR + EN). Dan se planira ujutro, zaključuje večernjim upitom i „izgori u žar“; tjedan, mjesec i godina dobivaju lokalne dijagnoze. Podaci su lokalno u SQLiteu (Drizzle); prijava i sinkronizacija preko Supabasea su iza feature flaga.

- Koncept: [`docs/CONCEPT.md`](docs/CONCEPT.md) · plan: [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) · stanje: [`docs/PROGRESS.md`](docs/PROGRESS.md) · pravila za AI sesije: [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md)

## Pokretanje

```bash
npm ci
cp .env.example .env   # samo javne vrijednosti (EXPO_PUBLIC_*); ključ se upisuje lokalno
npx expo start --dev-client
```

Ritam koristi nativne pakete (SQLite, obavijesti), pa treba **development build** (ne Expo Go) — vidi „Ritam na iPhoneu“. Android: `npx expo run:android`. Projekt je CNG: `ios/` i `android/` se generiraju i nisu u gitu. Paketi se dodaju samo s `npx expo install <paket>`.

| Varijabla | Značenje |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` | Supabase projekt (javni ključ) — za prijavu i sync |
| `EXPO_PUBLIC_FEATURE_AUTH` | `1` uključuje prijavu e-mailom i sync; zadano `0` (app radi potpuno lokalno) |

LLM ključ (`ANTHROPIC_API_KEY`) i neobavezne zamjene modela (`LLM_MODEL_PARSE_INPUT`, `LLM_MODEL_PLAN_DAY`) nikad nisu u repou — samo u Supabase → Edge Functions → Secrets.

## Testovi i kontrole

```bash
npx tsc --noEmit                 # TypeScript
npx expo lint                    # ESLint
npm test -- --runInBand          # Jest (core logika, SQLite repo, i18n)
npm run test:supabase            # migracije + RLS na privremenom Postgresu (bez Dockera)
npx expo install --check         # usklađenost paketa sa SDK-om
npx expo export --platform ios   # provjera bundla
```

Na Macu s Homebrewom: `env PG_BIN=/opt/homebrew/opt/postgresql@16/bin npm run test:supabase`. Isto (TypeScript · lint · Jest i Supabase migracije · RLS) vrti GitHub Actions na svakom PR-u (`.github/workflows/ci.yml`). `npx expo-doctor` treba pristup Expo API-ju; bez mreže dvije provjere padaju zbog mreže, ne projekta.

## Struktura

- `src/app/` — rute (Expo Router); samo ekrani i layouti
- `src/core/` — čista logika bez Reacta (raspored, rezultat dana, XP, niz, dijagnoze, obavijesti, teme) s testovima
- `src/db/` — SQLite shema, Drizzle migracije i repozitoriji
- `src/features/` — ekrani i hookovi po područjima; `src/ui/` — zajedničke komponente
- `src/i18n/` — `hr.json`, `en.json`
- `supabase/` — migracije, RLS testovi, Edge Functions (`parse-input`, `plan-day`, još nisu deployane)

## Ritam na iPhoneu (development build, besplatni Apple ID)

Treba: Mac s Xcodeom ≥ 26.4 (licenca prihvaćena, Apple ID prijavljen u Xcode → Settings → Accounts), iPhone s uključenim Developer Modeom, spojen kabelom i otključan, na istoj Wi-Fi mreži kao Mac.

```bash
npm ci
LANG=en_US.UTF-8 npx expo run:ios --device
```

`run:ios` generira `ios/` (CNG, nije u gitu), instalira podove, gradi i instalira app (pri prvom pokretanju odaberi svoj osobni tim). Ako CocoaPods padne na `UnicodeNormalize`, nedostaje `LANG=en_US.UTF-8`.

Prvi put na iPhoneu: **Postavke → Općenito → VPN i upravljanje uređajem → Apple Development: … → Vjeruj**.

Svakodnevno: `npx expo start --dev-client` na Macu, pa otvori Ritam na iPhoneu (promjene JS koda stižu bez novog builda; novi build samo kad se mijenjaju nativni paketi ili `app.json`).

Besplatni profil vrijedi **7 dana** — nakon toga ponovi `npx expo run:ios --device`. EAS build / TestFlight (`eas.json`, profil `development`) tek uz plaćeni Apple Developer Program: `npx eas-cli login`, `eas device:create`, `eas build --profile development --platform ios`.
