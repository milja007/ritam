# Ritam — upute za Claude sesije

Pročitaj i poštuj `AGENTS.md` (Expo pravila: provjeri verziju SDK-a i čitaj versioned docs, `npx expo install` za pakete).

## Kontekst
- Koncept: `docs/CONCEPT.md` (puni dokument je u Claude Docs, link unutra).
- Plan: `docs/BUILD_PLAN.md` — redoslijed koraka i kriteriji gotovosti.
- Dnevnik: `docs/PROGRESS.md` — kratko aktualno stanje (≤ 5 KB). Stari unosi u `docs/PROGRESS-ARCHIVE.md` — ne čitaj ga cijelog, samo `grep` kad treba.

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
- PR se spaja tek kad zadnja relevantna poruka u #1 ima `STATUS: CODEX_APPROVED` za **točan HEAD SHA** tog PR-a. **Jedina iznimka:** brzi put iz "Brži rad" (PR bez ijedne visokorizične datoteke + zeleni CI + lokalne kontrole → Claude spaja i objavljuje `CLAUDE_MERGED_FAST`). Spajanje: merge commit preko PR-a, bez force pusha, bez brisanja grana.
- Najviše **jedan PR u reviewu** u isto vrijeme. Dok čeka review, ne mijenjaj kod (ni na toj ni na novoj grani).

### Brži rad (odluka Borna, 2026-11-11: "presporo", "treba jače raditi")
- **7 sesija dnevno** (00:43, 06:43, 09:43, 12:43, 15:43, 18:43, 21:43). Svaka radi punim kapacitetom; prazna staje nakon jeftine provjere.
- **Skupina koraka po PR-u:** jedan PR nosi 2–4 povezana koraka iz `BUILD_PLAN.md` (npr. 20–22), svaki korak kao zaseban commit s porukom `Korak N: …`, svaki zasebno označen `[x]` kad je gotov. Grana `wip/korak-N-M` (N = prvi, M = zadnji korak skupine).
- **Predaja:** kad je skupina gotova, **ili** na kraju bilo koje sesije između 12:00 i 22:00 ako PR ima barem jedan gotov korak, a nije predan (da Codex uvijek ima posla). Nedovršeni korak ostaje na grani kao WIP i ne ulazi u predaju (ili se predaja jasno ograniči na gotove korake).
- **Brzi put (fast path)** za PR koji **ne dira nijednu visokorizičnu datoteku**: kad je CI zelen i lokalne kontrole prolaze, Claude ga sam spoji (merge commit) i u #1 objavi `STATUS: CLAUDE_MERGED_FAST` s poljima `PR` (broj i URL), `BASE`, `HEAD` i `MERGE` (puni SHA) te popisom koraka. Codex ga pregleda **naknadno**; nalaze Claude popravlja u novom `fix/…` PR-u (koji ide normalnim putem ako dira visokorizično).
- **Visokorizično (uvijek puni review prije mergea):** `src/features/auth/**`, `src/core/auth/**`, `src/features/sync/**`, `src/core/sync/**`, `src/db/**` (shema, migracije, repoi, sync), `supabase/**` (migracije, RLS, Edge Functions), sve s API ključevima/tajnama/LLM pozivima, obavijesti (`src/features/notifications/**`, `src/core/notifications/**`), `app.json`, `eas.json`, `package.json`/`package-lock.json`, `.github/**`, `.claude/**` (postavke, dopuštenja i hookovi Claude sesija), `scripts/**`, `src/app/_layout.tsx` (spaja auth, sync i obavijesti), `src/app/+native-intent.tsx` (auth deep-link), `app.config.*`, `.env*`, `.gitignore`, konfiguracije koje određuju rezultat obaveznih provjera (`eslint.config.js`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.*`, `.eslintignore`, `.prettierrc*` i svaka nova konfiguracija lintera/testova/TypeScripta), te pravila, koncept i plan: `CLAUDE.md`, `AGENTS.md`, `docs/AUTOMATION.md`, `docs/CONCEPT.md`, `docs/BUILD_PLAN.md` (iznimka: samo označavanje gotovog koraka `- [ ]` → `- [x]` na početku stvarne stavke koraka u `BUILD_PLAN.md` (podebljane `**N.` ili obične `N.`) — ne legende ni drugog teksta — bez ikakve druge izmjene te datoteke, ne čini PR visokorizičnim — provjeri sadržajem diffa, vidi "Završetak" točku 3). Preimenovanje ili premještanje računa i izvornu i odredišnu putanju: ako je bilo koja visokorizična, PR je visokorizičan. U sumnji → visokorizično.
- `CLAUDE_MERGED_FAST` ne blokira **pripremu**: sljedeća sesija smije raditi sljedeću skupinu (commitovi, push, draft PR). **Predaja je blokirana** dok taj merge nema završni Codex status: dok je zadnja poruka u #1 Claudeov `CLAUDE_MERGED_FAST`, ne objavljuj novi `CLAUDE_READY_FOR_REVIEW` ni `CLAUDE_MERGED_FAST` i ne spajaj ništa (Codex obrađuje samo zadnji komentar, pa bi prethodni merge ispao iz pregleda). Na kraju takve sesije gotovi rad ostaje pushan na grani i u draft PR-u. Ako Codex za taj merge traži popravak (`CODEX_CHANGES_REQUESTED` s `MERGE`), popravak ide prije nove predaje.
- **Otvoreni naknadni pregled** = `CLAUDE_MERGED_FAST` u #1 za koji kasnije u #1 ne postoji Codexov `CODEX_APPROVED` ni `CODEX_CHANGES_REQUESTED` s istim `PR` i `MERGE`. Ne gledaj samo zadnju poruku: **prije svake predaje ili mergea** prođi komentare #1 od zadnjeg `CLAUDE_MERGED_FAST` naovamo i usporedi `PR`, `HEAD` i `MERGE`. Ako postoji otvoren naknadni pregled, predaja je blokirana kao gore, bez obzira na to koja je poruka zadnja. Ako ga je potisnula kasnija poruka (npr. `BORNA_DECISION_NEEDED` ili Bornin odgovor), nakon što je pitanje riješeno (Borna odgovorio) ponovno objavi taj `CLAUDE_MERGED_FAST` kao novi komentar s istim `PR`, `BASE`, `HEAD`, `MERGE` i napomenom `REPOST: <URL izvornog komentara>`, da opet bude zadnji i da ga Codex obradi. Dok pitanje čeka Bornu, ne objavljuj ponovljeni handoff (zakopao bi pitanje).
- Claude i Codex ne uređuju istu granu istovremeno. Popravke review nalaza radi Claude (osim ako Borna kaže drukčije).
- Komentare u #1 objavljuj stvarno (GitHub MCP alati; `gh` ako radi). Ako komentar nije objavljen, **ne tvrdi** da je posao predan — obavijesti Bornu (`BLOCKED`).

### Početak svake sesije
1. `git fetch origin --prune`, `git status`; pročitaj tijelo i **sve komentare** issuea #1.
2. Pročitaj `AGENTS.md`, ovaj `CLAUDE.md`, `docs/PROGRESS.md` (vrh), `docs/BUILD_PLAN.md`, a za novi korak i `docs/CONCEPT.md`.
3. Postupi prema **zadnjoj** poruci u #1:
   - `CLAUDE_READY_FOR_REVIEW` (zadnja je Claudeova) → **stani**, ne mijenjaj kod. Bez obavijesti Borni (već je obaviješten pri predaji).
   - `CODEX_CHANGES_REQUESTED` → popravi **samo navedene nalaze** na istoj grani (test koji pokriva nalaz), kontrole, push, zatim `CLAUDE_FIXED` s novim HEAD SHA i istim formatom; obavijesti Bornu.
   - `CODEX_APPROVED` **s poljem `MERGE`** (naknadni pregled brzog puta) → provjeri da je navedeni PR već spojen i da se `HEAD` i `MERGE` poklapaju sa zadnjim `CLAUDE_MERGED_FAST`; ako da, to je samo potvrda — ništa ne spajaj i nastavi normalno (predaja je ponovno dopuštena). Ako se ne poklapaju: javi u #1 i Borni i stani.
   - `CODEX_APPROVED` (bez `MERGE`) → ako se SHA poklapa s HEAD-om otvorenog PR-a: spoji PR, zatim smiješ krenuti na sljedeći korak (nova grana + novi draft PR). Ako se SHA ne poklapa: ne spajaj, javi u #1 i Borni.
   - `BORNA_DECISION_NEEDED` → ne nagađaj; obavijesti Bornu i stani s tim dijelom.
   - `BLOCKED` → objasni točnu prepreku i što treba; obavijesti Bornu.
4. Otvoreni GitHub issueji s greškama s uređaja (osim #1) imaju prednost pred novim korakom — kroz isti PR-first tok.

### Rad na koraku
1. Nađi prvi korak u `BUILD_PLAN.md` koji nije `[x]` (ili nastavi postojeću `wip/korak-N…` granu). Odredi skupinu od 2–4 povezana koraka (vidi "Brži rad").
2. **Prije koda** napiši plan (3–8 točaka) na vrh `PROGRESS.md` pod datumom i provjeri ga protiv koncepta i kriterija gotovosti.
3. Radi samo tu skupinu, korak po korak (svaki korak gotov s testovima prije sljedećeg). Mali, sigurni commitovi; push često. **Jedan agent u isto vrijeme** — bez paralelnih subagenata.
4. Expo: SDK 58 — prije Expo/RN koda čitaj https://docs.expo.dev/versions/v58.0.0/ i https://docs.expo.dev/llms.txt; paketi samo `npx expo install`; npm/npx (nema `bun.lock`); CNG — ne diraj `ios/`/`android/`; navigacija u Expo Routeru (`src/app/`).
5. Ako budžet/kontekst ponestaje: stani na čistom mjestu, commit + push WIP na granu, u `PROGRESS.md` zapiši gdje si stao.

### Obavezne kontrole prije handoffa
- GitHub Actions CI (`.github/workflows/ci.yml`) mora biti zelen na HEAD-u PR-a.
- `npx tsc --noEmit`, `npx expo lint`, `npm test -- --runInBand`, čist `git status`.
- Supabase shema/RLS: `npm run test:supabase` (na Bornovom Macu `env PG_BIN=/opt/homebrew/opt/postgresql@16/bin npm run test:supabase`).
- Expo paketi/konfiguracija: `npx expo install --check`, `npx expo-doctor` (ako se sruši na vlastitom `@expo/env`, to je problem alata — prijavi ga, ne kao PASS ni kao grešku projekta).
- Runtime/native: bundle (`npx expo export --platform android|ios`) ili development build.
- Ekran/navigacija/onboarding/obavijesti/native: za Codex napiši točan simulator smoke scenarij (početno stanje, koraci, očekivano, rubni slučajevi); dokaz ili `NOT RUN` + razlog.
- Visokorizično (migracija, auth/sync, RLS, obavijesti, native konfiguracija): traži dodatni checkpoint review. **Remote Supabase migracije primjenjuj tek nakon `CODEX_APPROVED`** (i Bornove dozvole).

### Završetak koraka / skupine
1. Označi korak u `BUILD_PLAN.md`, ažuriraj `PROGRESS.md` kratko (napravljeno, sljedeće, pitanja); kad prijeđe ~5 KB, starije unose premjesti na vrh `PROGRESS-ARCHIVE.md`.
2. Push grane, otvori/ažuriraj **draft PR** prema `main`. Pokreni obavezne kontrole i pričekaj zeleni CI na HEAD-u.
3. Odaberi **jednu** granu prema diffu PR-a. Popis datoteka uzmi s `git diff --no-renames --name-only -z <BASE>...<HEAD>` (bez `--no-renames` preimenovanje pokazuje samo odredište i može sakriti zaštićenu izvornu putanju) i usporedi ga s popisom visokorizičnog u "Brži rad". Ako je na popisu `docs/BUILD_PLAN.md`, prije primjene iznimke pregledaj `git diff --no-renames -U0 <BASE>...<HEAD> -- docs/BUILD_PLAN.md`: u svakom hunku uklonjeni i dodani retci moraju biti jednakobrojni i spareni **po poziciji** (prvi uklonjeni s prvim dodanim, drugi s drugim … — `-U0` za susjedne stavke ispiše sve uklonjene pa sve dodane); svaki uklonjeni redak mora biti stvarna stavka koraka, tj. odgovarati `^- \[ \] (\*\*)?[0-9]+[a-z]?\. ` (podebljani oblik `- [ ] **20. …` i obični oblik `- [ ] 24. …` iz faza 2+), a njegov par mora biti identičan osim što `- [ ]` postaje `- [x]`; bez ikakvih drugih uklonjenih ili dodanih redaka (legenda, uvod, precrtane stavke i ostali tekst ne spadaju u iznimku — inače visokorizično):
   - **Najprije: predaja blokirana?** Postoji li otvoren naknadni pregled (vidi "Brži rad"; provjeri sve komentare #1 od zadnjeg `CLAUDE_MERGED_FAST`, ne samo zadnju poruku) → ne spajaj i ne objavljuj handoff ni `CLAUDE_MERGED_FAST`; grana i draft PR ostaju pushani, u `PROGRESS.md` zapiši da čekaju naknadni pregled prethodnog mergea. Ako je taj `CLAUDE_MERGED_FAST` potisnut, a pitanje riješeno, ponovno ga objavi (`REPOST`). Tek ako predaja nije blokirana, nastavi:
   - **Dira ijednu visokorizičnu datoteku (ili sumnja)** → handoff, ne merge (točke 4–5).
   - **Ne dira nijednu visokorizičnu datoteku, CI zelen, lokalne kontrole prolaze** → brzi put: PR u ready, spoji ga (merge commit, `expectedHeadSha`), u #1 objavi `STATUS: CLAUDE_MERGED_FAST` s obaveznim poljima `PR` (broj i URL), `BASE`, `HEAD` i `MERGE` (puni SHA), popisom koraka, `CHECKS` i što Codex treba naknadno pregledati; obavijesti Bornu: „Spojeno brzim putem (<SHA>). Kad stigneš, u Codexu pošalji: Naknadno pregledaj zadnji CLAUDE_MERGED_FAST u Ritam issueu #1.“ Smiješ pripremati sljedeću skupinu, ali je ne predaješ dok taj merge ne dobije Codexov status.
4. Handoff: komentar u #1: `FROM: CLAUDE`, `STATUS: CLAUDE_READY_FOR_REVIEW`, `SCOPE`, `BASE` i `HEAD` (puni SHA), `PR`, `SUMMARY`, `CHECKS`, `DEVICE/EVIDENCE`, `RISKS/QUESTIONS`, `REQUEST`. Završi footerom koji traži sustav.
5. Stani s izmjenama i obavijesti Bornu: „Spremno za Codex review. HEAD je <SHA>, PR je <URL>. U Codexu pošalji: Provjeri najnoviji Claude handoff u Ritam issueu #1.“

## Pravila koda
- TypeScript strict, bez `any`. Čista logika (raspoređivanje, XP, streak, notifikacijski okidači) u `src/core/**` bez React importa i s testovima.
- UI tekstovi isključivo kroz i18n (HR i EN) čim korak 3 bude gotov.
- Nikad API ključeve ni tajne u repo. Env kroz `EXPO_PUBLIC_*` samo za javne vrijednosti; LLM ključevi samo u Supabase secrets.
- Ne diraj `ios/` i `android/` (CNG).
- Promjene koncepta (nova značajka, drukčija odluka) ne radi sam — zapiši kao pitanje u `PROGRESS.md` pod "Pitanja za Bornu" i stavi `BORNA_DECISION_NEEDED` u issue #1.
- Mobile-first, pristupačnost (touch područja, labeli), iOS i Android. Bez `ts-ignore`.
