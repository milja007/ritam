# Ritam — upute za Claude sesije

Pročitaj i poštuj `AGENTS.md` (Expo pravila: provjeri verziju SDK-a i čitaj versioned docs, `npx expo install` za pakete).

## Kontekst
- Koncept: `docs/CONCEPT.md` (puni dokument je u Claude Docs, link unutra).
- Plan: `docs/BUILD_PLAN.md` — redoslijed koraka i kriteriji gotovosti.
- Dnevnik: `docs/PROGRESS.md` — što je zadnje napravljeno i što je sljedeće.

## Git autor (odluka Borna, 2026-11-10)
Prije prvog commita u sesiji postavi autora na Bornu, da se commitovi vide u njegovom GitHub grafu aktivnosti:
```bash
git config user.name "Borna Miljković"
git config user.email "162634695+milja007@users.noreply.github.com"
```
Claude ostaje koautor kroz `Co-Authored-By` redak u poruci commita. Stare commitove ne prepisuj.

## Claude ↔ Codex: PR-first (odluka Borna, 2026-11-11 — ima prednost nad starijim uputama)
Claude je primarni implementator, **Codex** je neovisni reviewer/QA, Borna donosi proizvodne odluke.
Zajednički mailbox: issue **#1** (`milja007/ritam`). Format handoffa i statusi su u tijelu issuea #1.

- **Nikad ne spajaj na `main` i ne pushaj na `main` izravno.** Svaki korak/popravak ide na `wip/korak-N` (ili `fix/…`, `docs/…`) i kroz **draft PR prema `main`**.
- PR se spaja tek kad zadnja relevantna poruka u #1 ima `STATUS: CODEX_APPROVED` za **točan HEAD SHA** tog PR-a. Spajanje: merge commit preko PR-a, bez force pusha, bez brisanja grana.
- Najviše **jedan PR u reviewu** u isto vrijeme. Dok čeka review, ne mijenjaj kod (ni na toj ni na novoj grani).
- Claude i Codex ne uređuju istu granu istovremeno. Popravke review nalaza radi Claude (osim ako Borna kaže drukčije).
- Komentare u #1 objavljuj stvarno (GitHub MCP alati; `gh` ako radi). Ako komentar nije objavljen, **ne tvrdi** da je posao predan — obavijesti Bornu (`BLOCKED`).

### Početak svake sesije
1. `git fetch origin --prune`, `git status`; pročitaj tijelo i **sve komentare** issuea #1.
2. Pročitaj `AGENTS.md`, ovaj `CLAUDE.md`, `docs/PROGRESS.md` (vrh), `docs/BUILD_PLAN.md`, a za novi korak i `docs/CONCEPT.md`.
3. Postupi prema **zadnjoj** poruci u #1:
   - `CLAUDE_READY_FOR_REVIEW` (zadnja je Claudeova) → **stani**, ne mijenjaj kod. Bez obavijesti Borni (već je obaviješten pri predaji).
   - `CODEX_CHANGES_REQUESTED` → popravi **samo navedene nalaze** na istoj grani (test koji pokriva nalaz), kontrole, push, zatim `CLAUDE_FIXED` s novim HEAD SHA i istim formatom; obavijesti Bornu.
   - `CODEX_APPROVED` → ako se SHA poklapa s HEAD-om otvorenog PR-a: spoji PR, zatim smiješ krenuti na sljedeći korak (nova grana + novi draft PR). Ako se SHA ne poklapa: ne spajaj, javi u #1 i Borni.
   - `BORNA_DECISION_NEEDED` → ne nagađaj; obavijesti Bornu i stani s tim dijelom.
   - `BLOCKED` → objasni točnu prepreku i što treba; obavijesti Bornu.
4. Otvoreni GitHub issueji s greškama s uređaja (osim #1) imaju prednost pred novim korakom — kroz isti PR-first tok.

### Rad na koraku
1. Nađi prvi korak u `BUILD_PLAN.md` koji nije `[x]` (ili nastavi postojeću `wip/korak-N` granu).
2. **Prije koda** napiši plan (3–8 točaka) na vrh `PROGRESS.md` pod datumom i provjeri ga protiv koncepta i kriterija gotovosti.
3. Radi samo taj korak. Mali, sigurni commitovi; push često. **Jedan agent u isto vrijeme** — bez paralelnih subagenata.
4. Expo: SDK 58 — prije Expo/RN koda čitaj https://docs.expo.dev/versions/v58.0.0/ i https://docs.expo.dev/llms.txt; paketi samo `npx expo install`; npm/npx (nema `bun.lock`); CNG — ne diraj `ios/`/`android/`; navigacija u Expo Routeru (`src/app/`).
5. Ako budžet/kontekst ponestaje: stani na čistom mjestu, commit + push WIP na granu, u `PROGRESS.md` zapiši gdje si stao.

### Obavezne kontrole prije handoffa
- `npx tsc --noEmit`, `npx expo lint`, `npm test -- --runInBand`, čist `git status`.
- Supabase shema/RLS: `npm run test:supabase` (na Bornovom Macu `env PG_BIN=/opt/homebrew/opt/postgresql@16/bin npm run test:supabase`).
- Expo paketi/konfiguracija: `npx expo install --check`, `npx expo-doctor` (ako se sruši na vlastitom `@expo/env`, to je problem alata — prijavi ga, ne kao PASS ni kao grešku projekta).
- Runtime/native: bundle (`npx expo export --platform android|ios`) ili development build.
- Ekran/navigacija/onboarding/obavijesti/native: za Codex napiši točan simulator smoke scenarij (početno stanje, koraci, očekivano, rubni slučajevi); dokaz ili `NOT RUN` + razlog.
- Visokorizično (migracija, auth/sync, RLS, obavijesti, native konfiguracija): traži dodatni checkpoint review. **Remote Supabase migracije primjenjuj tek nakon `CODEX_APPROVED`** (i Bornove dozvole).

### Završetak koraka = handoff, ne merge
1. Označi korak u `BUILD_PLAN.md`, ažuriraj `PROGRESS.md` (napravljeno, sljedeće, problemi, pitanja).
2. Push grane, otvori/ažuriraj **draft PR** prema `main`.
3. Komentar u #1: `FROM: CLAUDE`, `STATUS: CLAUDE_READY_FOR_REVIEW`, `SCOPE`, `BASE` i `HEAD` (puni SHA), `PR`, `SUMMARY`, `CHECKS`, `DEVICE/EVIDENCE`, `RISKS/QUESTIONS`, `REQUEST`. Završi footerom koji traži sustav.
4. Stani s izmjenama i obavijesti Bornu: „Spremno za Codex review. HEAD je <SHA>, PR je <URL>. U Codexu pošalji: Provjeri najnoviji Claude handoff u Ritam issueu #1.“

## Pravila koda
- TypeScript strict, bez `any`. Čista logika (raspoređivanje, XP, streak, notifikacijski okidači) u `src/core/**` bez React importa i s testovima.
- UI tekstovi isključivo kroz i18n (HR i EN) čim korak 3 bude gotov.
- Nikad API ključeve ni tajne u repo. Env kroz `EXPO_PUBLIC_*` samo za javne vrijednosti; LLM ključevi samo u Supabase secrets.
- Ne diraj `ios/` i `android/` (CNG).
- Promjene koncepta (nova značajka, drukčija odluka) ne radi sam — zapiši kao pitanje u `PROGRESS.md` pod "Pitanja za Bornu" i stavi `BORNA_DECISION_NEEDED` u issue #1.
- Mobile-first, pristupačnost (touch područja, labeli), iOS i Android. Bez `ts-ignore`.
