# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 06:45 · Popravci naknadnog pregleda PR-a #7 (grana `fix/zar-pregled-pr7`)
- Codex `CODEX_CHANGES_REQUESTED` za merge `7af71be` (https://github.com/milja007/ritam/issues/1#issuecomment-6842886626), tri nalaza, sva popravljena s testovima:
  1. P2 jedan orb na traci: kod preklopa (09–11 i 10–12 u 10:30) plamen nosi samo redak „Sada“; druga aktivnost koja traje ostaje ocrtana i dalje se otvara (`railState(…, flame)`, `flameBlockId` u `src/core/ember/ember.ts`).
  2. P2 „Rekordi ove godine“: najduži niz samo unutar prikazane godine, uz pravilo „Odustajem“ (`longestStreakInYear`; dani iz `listEveningCheckins`).
  3. P3 „Najjači mjesec“ uspoređuje stvarne prosjeke, zaokružuje samo prikaz.
- Sljedeće: Ž6 Profil po platnu, zatim faza 3 (33, 35, 34b, 37c, 38) i docs PR s redoslijedom „Žar“ u `BUILD_PLAN.md` (visokorizično).

## 2026-11-13 · Smjer „Žar“ (grana `wip/zar-dan-tjedan`)
- **Odluka Borna 2026-11-12:** vizualni smjer „Žar“ („dan izgori u žar“) ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu (Dan, Tjedan, Mjesec, Godina, Profil). **Odluka Borna 2026-11-13 (chat):** smije ići paralelno dok PR #6 čeka review.
- Ideja: orb-plamen putuje niz današnji raspored; odrađeno iza njega svijetli, plan ispred je tek ocrtan; svaki dan je žar čija svjetlina znači dnevni rezultat (tjedan: 7 stupaca, mjesec: kalendar žarova, godina: 365 točkica); neodrađeno je ugašen žar, nikad crveni X.
- Plan skupine (redom, svaki korak zaseban commit `Žar N: …`):
  1. Ž1 jezgra `src/core/ember` (svjetlina iz rezultata 55/70/85, stanje točke na traci, boje za tamnu i svijetlu shemu) + tokeni `ember*`, testovi. **Gotovo.**
  2. Ž2 Dan: kronološka traka (ranije → plamen „Sada“ → ostatak dana), izgorjela puna linija iza, crtkana ispred, orb s pulsom (Reanimated, poštuje „smanji kretanje“), bez crvene za neodrađeno. **Gotovo** (`src/ui/ember.tsx`, `now-row.tsx`, `block-card.tsx`); na uređaju još neprovjereno.
  3. Ž3 Tjedan: 7 stupaca dana s blokovima (06–24 h), linija „sada“, žar i rezultat ispod svakog dana, razlika prosjeka prema prošlom tjednu. **Gotovo.**
  4. Ž4 Mjesec: kalendar žarova, legenda, usporedba prosjeka s prošlim mjesecom, najjači dan. **Gotovo.** Ž5 Godina: 365 točkica po mjesecima, rekordi (najduži niz, najjači mjesec, broj ocijenjenih dana). **Gotovo.**
  5. Sljedeća skupina: Ž6 Profil po platnu, zatim faza 3 (33 orb, 35 animacije i haptika, 34b rang i statovi, 37c grafovi, 38 teme); zaglavlje Dana s pilulama (niz, rezultat) i kartica „Trenutno“ po platnu.
- Stanje: sve na lokalnim podacima (`listDayScores`, `listBlocksBetween`); žar pali samo konačni rezultat (nakon večernjeg upita). **Na uređaju neprovjereno** (cloud sesija nema simulator; web export ne radi zbog SQLite-a) — prošli su tsc, lint, Jest i iOS bundle.
- Nije napravljeno namjerno: ciljevi tjedna/mjeseca/godine, „[Sustav]“ poruke, točkice fiksnih obaveza u mjesecu, listanje prošlih tjedana/mjeseci (čekaju korake 25, 25b, 34b).
- Provjera plana: bez novih paketa (samo `View`, `boxShadow`, Reanimated koji već postoji), pa PR ne dira visokorizične datoteke. Ciljevi tjedna/mjeseca/godine i „[Sustav]“ poruke s platna još nemaju podatke (koraci 25, 25b, 34b) — ne izmišljam ih, sekcije dolaze s tim koracima. Redoslijed u `BUILD_PLAN.md` (visokorizično) ide zasebnim docs PR-om kad PR #6 prođe.

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
