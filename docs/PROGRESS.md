# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 13:20 · Žar 9–10 (grana `wip/zar-paljenje-godina`, PR #11)
- Gotovo na grani (svaki zaseban commit, s testovima):
  1. **Ž9 Paljenje žara.** Žar današnjeg dana stoji uz broj rezultata u zaglavlju Dana: ugašen obrub dok dan traje, a kad večernji upit da konačni rezultat upali se na svoju razinu uz jednokratnu animaciju (aureola nabuja i smiri se, žar malo naraste i vrati se). Čisto: `todayEmber` (pali **samo konačni rezultat**, pravilo P43 — rezultat „u tijeku“ i istaknuti jučerašnji ostavljaju žar ugašen) i `shouldIgnite` (prvo crtanje i gašenje ne animiraju); tokeni `IGNITE_DURATION_MS` / `IGNITE_SWELL_MS`; `EmberIgnite` poštuje „smanji kretanje“.
  2. **Ž10 Godina → dodir mjeseca.** Redak mjeseca u Godini otvara taj mjesec u tabu Mjesec, „Ovaj mjesec“ vraća na tekući; budući mjesec nije dodirljiv. Čisto: `isMonthOpenable` i `monthHeader` (pilula „još N dana“ / „završen“). Odabir stoji u `src/features/ember/selected-month.ts` (`useSyncExternalStore`, uzorak zahtjeva obavijesti), jer su tabovi odvojeni ekrani. Prazan prošli mjesec ima svoju poruku.
- Uz Ž10 je ispravljena visina dodira retka mjeseca u Godini: bila je 14 px, sad 44 px (`minHeight`), pa je grid godine zračniji.
- Namjerno izvan opsega: listanje prošlih razdoblja strelicama (korak 34b).
- Redoslijed „Žar“ (Ž1–Ž12) je sada u `BUILD_PLAN.md`, sa zasebnom numeracijom i vezama na dijelove koraka 35 i 37c.
- **Na uređaju neprovjereno** (cloud sesija nema simulator).
- Zapreka u ovoj sesiji: GitHub credential servis i GitHub API su oko 13:05 UTC vraćali 503 („retry shortly“), pa push i merge čekaju. Commitovi su lokalno na grani.

## 2026-11-13 · Samostalan rad (odluka Borna, 2026-11-13 chat; isto poslano Codexu)
- Codex zaustavlja Claudea samo kod P0/P1 greške koja mijenja sve; inače Claude radi sam i sam spaja PR na zelenom CI-ju, Codex pregledava usporedno. P2/P3 idu u sljedeći PR. Pravila u `CLAUDE.md` ("samostalan rad") i prompt u `docs/AUTOMATION.md` prepisani; stara pravila čekanja i `REPOST` mehanizmi više ne vrijede.
- Bez Borne i dalje ne ide: remote Supabase migracije, tajne, promjene koncepta, brisanje.

## 2026-11-13 · Smjer „Žar“ (Ž1–5 spojeni: PR #7 `7af71be`)
- **Odluka Borna 2026-11-12:** smjer „Žar“ („dan izgori u žar“) ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu. Dan, Tjedan, Mjesec, Godina su na `main`; detalji plana u arhivi.
- Ž6–8 (Profil, zaglavlje Dana, kartica „Trenutno“) + dijelovi koraka 35 i 37c spojeni su PR-om #9 (`7dc46e4`); detalji u arhivi.
- Sve na lokalnim podacima; žar pali samo konačni rezultat. **Na uređaju neprovjereno** (cloud sesija nema simulator).
- Namjerno izostavljeno: ciljevi tjedna/mjeseca/godine, „[Sustav]“ poruke, točkice fiksnih obaveza, listanje prošlih razdoblja (koraci 25, 25b, 34b). Redoslijed „Žar“ u `BUILD_PLAN.md` (visokorizično) ide zasebnim docs PR-om.

## Stanje
- `main`: koraci 0–19 gotovi + popravci retrospektivnog audita (PR #3: auth samo PKCE kod, sync vezan uz prvi račun, `seenAt` sinkroniziran, skripta radi na Bash 3.2).
- Remote Supabase `ritam`: svih 7 migracija primijenjeno (zadnja `20261111103947_sync`), advisori čisti, tablice prazne.
- Auth/sync su iza flaga `EXPO_PUBLIC_FEATURE_AUTH` (zadano isključeno).
- Na uređaju još neprovjereno: magic link / kod, sync s dva uređaja, Gotovo/Odgodi s ugašenim appom.

## Sljedeće
1. **Ž12 arhiva dijagnoza** (dio koraka 37c): popis prošlih dijagnoza; traži novi upit u `src/db/**` → visokorizično, zaseban mali PR.
2. **Ž11 haptika + XP/level-up animacije** (dio koraka 35): traži `expo-haptics`. **Zapreka:** u cloud sandboxu `npx expo install` ne prolazi (proxy vraća `Forbidden` za Expo API), a paket se po `AGENTS.md` ne smije dodati ručno. Treba Bornin `npx expo install expo-haptics` na Macu, ili sesija s pristupom Expo API-ju.
3. Zatim skupina 20–22 na jednom PR-u, pa 23. Korak 20 = LLM provider (Edge Function `llm-provider`, Claude sada, sučelje za DeepSeek, logiranje u `llm_calls`; ključevi samo u Supabase secrets — API se naplaćuje zasebno od pretplate).

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
