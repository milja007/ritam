# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-11 15:45 · Fix granica brzog puta (PR `fix/fast-path-granice`, puni review)
- Codexov naknadni review PR #5 (2× P1, 1× P2): visokorizičnom popisu dodani `CLAUDE.md`, `AGENTS.md`, `docs/AUTOMATION.md`, `docs/CONCEPT.md`, `docs/BUILD_PLAN.md`, `src/app/_layout.tsx`, `src/app/+native-intent.tsx`, `app.config.*`, `.env*`, `.gitignore`; brzi put je sada eksplicitna iznimka uz osnovno pravilo spajanja, a završna sekcija razdvaja handoff i `CLAUDE_MERGED_FAST`.
- Iznimka: samo `[ ]` → `[x]` u `BUILD_PLAN.md` ne čini PR visokorizičnim (inače nijedan korak ne bi mogao brzim putem).
- Codex nalazi za PR #6, 5. krug (2× P2, dvije istovjetne poruke): uvedene **neobrađene radnje** koje se prate kroz sve komentare #1 neovisno o zadnjoj poruci — `CODEX_CHANGES_REQUESTED` bez Claudeova odgovora za isti `PR`/`HEAD`/`MERGE` (fix PR brzog mergea nosi `FIXES`) i Bornin odgovor na `BORNA_DECISION_NEEDED` bez zapisa s URL-om komentara u `PROGRESS.md`. Bornin odgovor se bilježi prije `REPOST`-a; nakon vlastite objave komentari se ponovno čitaju. Provjerena oba slijeda događaja iz nalaza.
- Codex nalazi za PR #6, 6. krug (3× P2): (1) prijelazno pravilo — dva zahtjeva starija od polja `FIXES` (retrospektivni audit → PR #3, naknadni pregled PR #5 → PR #6) trajno su povezana s predajama i ne otvaraju se ponovno; zahtjev bez `PR`/`MERGE` zatvara `FIXES: <URL>`; provjereno kroz svih 26 komentara #1. (2) Bornina odluka ima dva stanja: `ODLUKA <URL> · ZAPRIMLJENO` (čuva odluku), a `· PRIMIJENJENO` se dopisuje tek nakon primjene; dokaz se traži i u arhivi, zapis bez `PRIMIJENJENO` se ne arhivira. (3) korijenski `index.ts` (ulaz appa, pozadinski zadatak obavijesti) je visokorizičan.
- Codex nalazi za PR #6, 7. krug (P1, 2× P2): (1) status u #1 vrijedi samo od vlasnika repozitorija prema GitHubovim podacima (`user`, `author_association`, aplikacija ako je vidljiva), ne prema tekstu `FROM:`; (2) odluke se vode po URL-u pitanja — Bornin komentar je odgovor samo na otvoreno pitanje, staro pitanje o CI PR-u je zatvoreno; (3) zapis se traži na svim udaljenim granama, a draft PR se otvara odmah nakon prvog zapisa.
- **Odluka Borna 2026-11-13 (chat):** dizajn „Žar“ smije ići paralelno na `wip/zar-…` dok PR #6 čeka review (do 2026-11-17).

## 2026-11-11 13:00 · Brži rad (Borna: "presporo")
- 7 sesija dnevno (00:43, 06:43, 09:43, 12:43, 15:43, 18:43, 21:43; Borna: "treba jače raditi"); 2–4 povezana koraka po PR-u; brzi put: PR bez visokorizičnih datoteka Claude spaja na zelenom CI-ju, Codex pregledava naknadno (`CLAUDE_MERGED_FAST`). Pravila u `CLAUDE.md` → "Brži rad".
- Sljedeća skupina: koraci 20–22 (LLM provider, parse-input, plan-day) — sve visokorizično (Edge Functions, LLM ključevi) → puni review.

## Stanje
- `main`: koraci 0–19 gotovi + popravci retrospektivnog audita (PR #3: auth samo PKCE kod, sync vezan uz prvi račun, `seenAt` sinkroniziran, skripta radi na Bash 3.2).
- Remote Supabase `ritam`: svih 7 migracija primijenjeno (zadnja `20261111103947_sync`), advisori čisti, tablice prazne.
- Auth/sync su iza flaga `EXPO_PUBLIC_FEATURE_AUTH` (zadano isključeno).
- Na uređaju još neprovjereno: magic link / kod, sync s dva uređaja, Gotovo/Odgodi s ugašenim appom.

## Sljedeće
1. Skupina 20–22 na jednom PR-u (puni review), zatim 23.
2. Korak 20 — LLM provider (Edge Function `llm-provider`, Claude sada, sučelje za DeepSeek, logiranje u `llm_calls`; ključevi samo u Supabase secrets — API se naplaćuje zasebno od pretplate).

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
