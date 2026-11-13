# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 10:15 · Žar 6–8 + dijelovi koraka 35 i 37c (grana `wip/zar-profil`, draft PR #9, **nije predano**)
- Gotovo na grani (svaki zaseban commit, s testovima):
  1. Ž6 Profil: kartica napretka s orbom u prstenovima + graf „Zadnjih 30 dana“ (`trend`, `TrendCard`).
  2. Ž7 zaglavlje Dana po platnu: datum iznad naslova „Danas“, pilule niza (žar svijetli dok niz traje) i rezultata sa strelicom trenda (`scorePill` u `src/core/progress`, `DayPills`).
  3. Ž8 kartica „Trenutno“ po platnu: veliki živi sat sa sekundama u boji plamena, desno „još mm:ss“, tanki obrub.
  4. Korak 35 (dio): ispuna `ProgressBar` klizi do nove vrijednosti (`src/core/theme/motion.ts`; poštuje „smanji kretanje“).
  5. Korak 37c (dio): žar dana s rezultatom u Mjesecu otvara dijagnozu tog dana (`hasDiagnosis`).
- Koraci 35 i 37c **nisu** označeni `[x]`: ostaje haptika i +XP/level-up animacije (`expo-haptics` → `package.json`, visokorizično) te popis arhive dijagnoza (traži novi upit u `src/db/**`, visokorizično). Rang, statovi, „[Sustav]“ i bedževi s platna čekaju 34b i 32.
- Sljedeće na ovoj grani ili novoj: paljenje žara nakon večernjeg upita (animacija), Godina → dodir mjeseca; zatim visokorizični PR (haptika, upit arhive, redoslijed „Žar“ u `BUILD_PLAN.md`).
- **Predaja blokirana** dok brzi merge PR-a #8 (`aa3f2b3`) nema Codexov završni status. PR #9 ne dira visokorizične datoteke (brzi put kad se odblokira). Na uređaju neprovjereno.

## 2026-11-13 06:45 · Popravci naknadnog pregleda PR-a #7 (grana `fix/zar-pregled-pr7`)
- Codex `CODEX_CHANGES_REQUESTED` za merge `7af71be` (https://github.com/milja007/ritam/issues/1#issuecomment-6842886626), tri nalaza, sva popravljena s testovima:
  1. P2 jedan orb na traci: kod preklopa (09–11 i 10–12 u 10:30) plamen nosi samo redak „Sada“; druga aktivnost koja traje ostaje ocrtana i dalje se otvara (`railState(…, flame)`, `flameBlockId` u `src/core/ember/ember.ts`).
  2. P2 „Rekordi ove godine“: najduži niz samo unutar prikazane godine, uz pravilo „Odustajem“ (`longestStreakInYear`; dani iz `listEveningCheckins`).
  3. P3 „Najjači mjesec“ uspoređuje stvarne prosjeke, zaokružuje samo prikaz.
- Sljedeće: Ž6 Profil po platnu, zatim faza 3 (33, 35, 34b, 37c, 38) i docs PR s redoslijedom „Žar“ u `BUILD_PLAN.md` (visokorizično).

## 2026-11-13 · Smjer „Žar“ (Ž1–5 spojeni: PR #7 `7af71be`)
- **Odluka Borna 2026-11-12:** smjer „Žar“ („dan izgori u žar“) ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu. Dan, Tjedan, Mjesec, Godina su na `main`; detalji plana u arhivi.
- Sve na lokalnim podacima; žar pali samo konačni rezultat. **Na uređaju neprovjereno** (cloud sesija nema simulator).
- Namjerno izostavljeno: ciljevi tjedna/mjeseca/godine, „[Sustav]“ poruke, točkice fiksnih obaveza, listanje prošlih razdoblja (koraci 25, 25b, 34b). Redoslijed „Žar“ u `BUILD_PLAN.md` (visokorizično) ide zasebnim docs PR-om.

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
