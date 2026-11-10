# Plan izrade

Jedan korak = jedna jutarnja sesija. Korak je gotov tek kad su ispunjeni svi kriteriji. Ne preskakati, ne raditi dva koraka odjednom (osim ako je korak gotov a ima još puno budžeta — tada najviše jedan sljedeći mali korak).

Svaki korak mora završiti s: `npx tsc --noEmit` prolazi, `npx expo lint` prolazi, testovi (kad postoje) prolaze, `PROGRESS.md` ažuriran, commit + push.

Status: `[ ]` čeka · `[~]` u tijeku · `[x]` gotovo

## Faza 1 — Jezgra (MVP)

- [x] **0. Skeleton** — Expo projekt (default template), docs/CONCEPT.md, BUILD_PLAN.md, PROGRESS.md, CLAUDE.md, git.
- [x] **1. Čišćenje templatea + tabovi** — ukloniti primjer ekrane/komponente iz templatea; Expo Router tab layout s 5 tabova (Danas, Tjedan, Questovi, Navike, Profil), placeholder ekrani; `src/features/`, `src/core/`, `src/ui/` mape. *Gotovo kad:* app se bundla (`npx expo export --platform android` ili barem typecheck+lint), tabovi postoje.
- [x] **2. Testovi** — postaviti test runner za čisti TS kod (`src/core/**`): jest-expo ili vitest (provjeriti što radi sa SDK verzijom). Jedan sample test. Skripta `npm test`.
- [x] **3. i18n** — i18next + react-i18next + expo-localization; `src/i18n/hr.json`, `en.json`; automatski jezik uređaja; prekidač u Profilu; svi stringovi tabova prevedeni.
- [x] **4. Dizajn tokeni** — dark-first paleta, gradijent po dobu dana (zora/dan/večer kao tokeni), tipografija, razmaci, radius; tema provider. Provjeriti kompatibilnost NativeWinda s trenutnim SDK-om (docs); ako nije stabilno, StyleSheet + tokeni.
- [x] **5. Domenski tipovi** — `src/core/domain/`: TypeScript tipovi + Zod sheme za settings, schedule_blocks, checkins, checkin_items, rules, rule_logs, xp_events (vidi CONCEPT.md / koncept doc model podataka). Testovi validacije.
- [x] **6. Lokalna baza** — expo-sqlite + Drizzle ORM, sheme i migracije za tablice iz koraka 5, repo funkcije (CRUD) za settings i schedule_blocks.
- [x] **7. Logika XP-a i streaka** — čiste funkcije u `src/core/gamification/` (XP iz eventova, glavni streak iz checkina, freeze kasnije). Testovi.
- [x] **8. Onboarding** — jezik → vrijeme buđenja i sati sna → vrijeme jutarnje/večernje obavijesti → 1–3 zabrane. Sprema u settings/rules.
- [x] **9. Notifikacije (logika)** — `src/core/notifications/`: računanje sljedećih okidača (jutro, večer, wind-down) iz settingsa, čisto i testirano; poštuje limit iOS-a (zakazati samo sljedećih par dana).
- [x] **10. Notifikacije (integracija)** — expo-notifications: dopuštenje, zakazivanje, kategorije akcija (Gotovo / Odgodi / Iskrslo), ponovno zakazivanje pri otvaranju appa. Config plugin u app.json.
- [x] **11. Danas — timeline** — prikaz blokova dana, trenutni blok istaknut, označi gotovo, ručno dodaj/uredi/obriši blok.
- [x] **12. Večernji upit — checklist** — korak-po-korak flow: checklist (U redu / Nije + komentar), zabrane, ocjena dana. Sprema checkin + checkin_items + rule_logs + xp_events.
- [x] **12b. Večernji upit — dorade (odluke 2026-11-09)** — opcija Djelomično (`partial`, pola XP-a zadatka zaokruženo naviše: 15 → 8); "kad kasnije?" za Djelomično/Nije (sutra / drugi dan / preskoči → novi blok + status `moved`/`skipped`); upit prije 04:00 ide na prethodni dan; XP odmah na kvačicu timelinea bez dupliciranja u upitu; migracija s jedinstvenim indeksima (checkin po danu i vrsti, rule_log po zabrani i danu).
- [x] **13. Večernji upit — sutra** — "Što imaš sutra?" ručni unos blokova (brzi odabiri + tipkanje), pregled, potvrdi.
- [x] **13b. Podsjetnici blokova** — obavijest na početku svakog bloka osim sna, akcije Gotovo (status + XP) / Odgodi (15 min) / Iskrslo (otvori app); zakazivanje uz dnevne obavijesti, unutar iOS limita.
- [x] **13c. Postavke i onboarding — dorade (odluke 2026-11-09)** — vikend vrijeme buđenja + upozorenje > 1 h; `language: system`; 0–3 zabrane u onboardingu; prekidači za svaku dnevnu obavijest u Profilu; horizont 7 dana; kartica kad je dopuštenje odbijeno; doba dana prema buđenju; privremena ikona/splash.
- [x] **14. Jutarnji brief** — ekran iz notifikacije: pozdrav, prijava sna (2 taba), kartice dana, Prilagodi / Kreni.
- [x] **15. XP traka + streak u UI-ju** — na tabu Danas i Profil.
- [x] **16. Dnevna dijagnoza (lokalna)** — na kraju upita prikaz u strukturi dijagnoze iz CONCEPT.md (Ukratko, Napredak, Pohvale, …) koliko se može bez LLM-a: statistika dana i usporedba s jučer. Sprema u `reports` (period `day`).
- [ ] **16c. Rezultat po odabranim područjima (odluke 2026-11-10)** — `settings` + odabrana područja rezultata (plan / san / zabrane; zadano samo plan) s migracijom; izbor u onboardingu i u Profilu; `dayScore` s težinama 50/30/20 razmjerno odabranim područjima; rekordi tjedna/mjeseca bez uvjeta; Danas: jučerašnji konačni rezultat + današnji "u tijeku"; dijagnoza: ponovljena ideja ostaje + nova ideja. Testovi. (Napomena: stoji iznad 16b samo zbog redoslijeda u datoteci; radi se prije 18.)
- [ ] **16d. Obavijesti i postavke — dorade (odluke 2026-11-10)** — večernji upit i wind-down vikendom pomaknuti kao buđenje; Profil: uređivanje vremena obavijesti i sati sna; prekidač za podsjetnike blokova (zadano uključeni); jutarnja obavijest s fiksnim sadržajem dana; Gotovo/Odgodi na podsjetniku bez otvaranja appa (Iskrslo otvara app).
- [x] **16b. Napredak — dnevni rezultat** — `src/core/progress/` (čisto + testovi): dnevni rezultat 0–100 (plan, zabrane, san; trackeri kasnije), usporedba s jučer i istim danom prošli tjedan, 7 dana vs 7 prije, osobni rekordi. Prikaz rezultata sa strelicom trenda na tabu Danas.
- [ ] **17. Supabase shema** — `supabase/migrations/` SQL za sve tablice + RLS (vlasnik); remote projekt `ritam` postoji (vidi Odluke u PROGRESS.md), primijeniti tek kad migracije prođu lokalno. `supabase/config.toml`.
- [ ] **18. Supabase klijent + auth** — `@supabase/supabase-js`, env varijable (`EXPO_PUBLIC_SUPABASE_URL/KEY`), auth ekran (email magic link) iza feature flaga dok nema accounta.
- [ ] **19. Sync** — red promjena lokalno → Supabase, pull pri pokretanju; konflikti: zadnji updatedAt pobjeđuje.
- [ ] **20. LLM provider** — Edge Function `llm-provider` modul (Claude sada, sučelje za DeepSeek), logiranje u `llm_calls`. Bez ključeva u repou.
- [ ] **21. parse-input** — Edge Function: slobodan tekst → blokovi (JSON). Spojiti na korak 13.
- [ ] **22. plan-day** — Edge Function: raspored sutrašnjeg dana + 0–3 pitanja, validacija u appu, fallback pravila.
- [ ] **23. Provjera faze 1** — expo-doctor, pregled TODO-ova, README s uputama za pokretanje i testiranje.

## Faza 2 — Pametni planer
- [ ] 24. Google Calendar OAuth + uvoz fiksnih obaveza
- [ ] 25. Tjedni zadaci: unos s pitanjima + tab Tjedan
- [ ] 26. Tjedni zadaci u plan-day
- [ ] 27. "Nešto je iskrslo" flow
- [ ] 28. Zabrane: ekran upravljanja + streakovi po zabrani
- [ ] 29. San: wind-down, prilagodba rasporeda lošem snu
- [ ] 30. Glasovni unos (on-device speech-to-text, HR/EN)
- [ ] 31. LLM dnevna dijagnoza (`write-report`) — struktura i ton iz CONCEPT.md (sekcija Dijagnoze), promptovi verzionirani u repou s testnim primjerima podataka, prethodne dijagnoze u kontekstu, gumbi Pomoglo / Nije pomoglo + komentar
- [ ] 31b. Opcionalni trackeri: kalorije i novac — postavke (isključeni po defaultu), unos, večernja provjera, ulaze u dnevni rezultat i dijagnozu; upozorenje za neuobičajeno nizak cilj kalorija

## Faza 3 — Igra i animacije
- [ ] 32. Leveli + otključavanja
- [ ] 33. Orb-plamen avatar (Skia)
- [ ] 34. Questovi (dnevni/tjedni/epski) + freeze tokeni + bedževi
- [ ] 34b. Rang E–S i statovi (Disciplina, Volja, Energija, Zdravlje, Novac) — lagani Solo Leveling štih, poruke "[Sustav]"
- [ ] 35. Animacije (checkbox, +XP, level up, streak) + haptika
- [ ] 36. Tjedna dijagnoza (nedjelja: dan + tjedan) + prijedlog jedne promjene + streak boljih tjedana
- [ ] 37. Mjesečna dijagnoza (zadnji dan u mjesecu: dan + tjedan + mjesec)
- [ ] 37b. Godišnja dijagnoza (31. 12.: dan + tjedan + mjesec + godina)
- [ ] 37c. Grafovi napretka: 30 dana na Profilu, godišnja toplinska karta, arhiva dijagnoza
- [ ] 38. Teme boja

## Faza 4 — Nadogradnje
- [ ] 39. Health sync · 40. DeepSeek provider · 41. Home-screen widget
