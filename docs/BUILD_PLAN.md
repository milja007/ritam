# Plan izrade

Jedan korak = jedna jutarnja sesija. Korak je gotov tek kad su ispunjeni svi kriteriji. Ne preskakati, ne raditi dva koraka odjednom (osim ako je korak gotov a ima još puno budžeta — tada najviše jedan sljedeći mali korak).

Svaki korak mora završiti s: `npx tsc --noEmit` prolazi, `npx expo lint` prolazi, testovi (kad postoje) prolaze, `PROGRESS.md` ažuriran, commit + push.

Status: `[ ]` čeka · `[~]` u tijeku · `[x]` gotovo

## Faza 1 — Jezgra (MVP)

- [x] **0. Skeleton** — Expo projekt (default template), docs/CONCEPT.md, BUILD_PLAN.md, PROGRESS.md, CLAUDE.md, git.
- [ ] **1. Čišćenje templatea + tabovi** — ukloniti primjer ekrane/komponente iz templatea; Expo Router tab layout s 5 tabova (Danas, Tjedan, Questovi, Navike, Profil), placeholder ekrani; `src/features/`, `src/core/`, `src/ui/` mape. *Gotovo kad:* app se bundla (`npx expo export --platform android` ili barem typecheck+lint), tabovi postoje.
- [ ] **2. Testovi** — postaviti test runner za čisti TS kod (`src/core/**`): jest-expo ili vitest (provjeriti što radi sa SDK verzijom). Jedan sample test. Skripta `npm test`.
- [ ] **3. i18n** — i18next + react-i18next + expo-localization; `src/i18n/hr.json`, `en.json`; automatski jezik uređaja; prekidač u Profilu; svi stringovi tabova prevedeni.
- [ ] **4. Dizajn tokeni** — dark-first paleta, gradijent po dobu dana (zora/dan/večer kao tokeni), tipografija, razmaci, radius; tema provider. Provjeriti kompatibilnost NativeWinda s trenutnim SDK-om (docs); ako nije stabilno, StyleSheet + tokeni.
- [ ] **5. Domenski tipovi** — `src/core/domain/`: TypeScript tipovi + Zod sheme za settings, schedule_blocks, checkins, checkin_items, rules, rule_logs, xp_events (vidi CONCEPT.md / koncept doc model podataka). Testovi validacije.
- [ ] **6. Lokalna baza** — expo-sqlite + Drizzle ORM, sheme i migracije za tablice iz koraka 5, repo funkcije (CRUD) za settings i schedule_blocks.
- [ ] **7. Logika XP-a i streaka** — čiste funkcije u `src/core/gamification/` (XP iz eventova, glavni streak iz checkina, freeze kasnije). Testovi.
- [ ] **8. Onboarding** — jezik → vrijeme buđenja i sati sna → vrijeme jutarnje/večernje obavijesti → 1–3 zabrane. Sprema u settings/rules.
- [ ] **9. Notifikacije (logika)** — `src/core/notifications/`: računanje sljedećih okidača (jutro, večer, wind-down) iz settingsa, čisto i testirano; poštuje limit iOS-a (zakazati samo sljedećih par dana).
- [ ] **10. Notifikacije (integracija)** — expo-notifications: dopuštenje, zakazivanje, kategorije akcija (Gotovo / Odgodi / Iskrslo), ponovno zakazivanje pri otvaranju appa. Config plugin u app.json.
- [ ] **11. Danas — timeline** — prikaz blokova dana, trenutni blok istaknut, označi gotovo, ručno dodaj/uredi/obriši blok.
- [ ] **12. Večernji upit — checklist** — korak-po-korak flow: checklist (U redu / Nije + komentar), zabrane, ocjena dana. Sprema checkin + checkin_items + rule_logs + xp_events.
- [ ] **13. Večernji upit — sutra** — "Što imaš sutra?" ručni unos blokova (brzi odabiri + tipkanje), pregled, potvrdi.
- [ ] **14. Jutarnji brief** — ekran iz notifikacije: pozdrav, prijava sna (2 taba), kartice dana, Prilagodi / Kreni.
- [ ] **15. XP traka + streak u UI-ju** — na tabu Danas i Profil.
- [ ] **16. Dnevni izvještaj (lokalni)** — statistika dana na kraju upita (bez LLM-a zasad).
- [ ] **17. Supabase shema** — `supabase/migrations/` SQL za sve tablice + RLS (vlasnik), bez remote projekta dok korisnik ne da account. `supabase/config.toml`.
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
- [ ] 31. LLM dnevni izvještaj (`write-report`)

## Faza 3 — Igra i animacije
- [ ] 32. Leveli + otključavanja
- [ ] 33. Orb-plamen avatar (Skia)
- [ ] 34. Questovi (dnevni/tjedni/epski) + freeze tokeni
- [ ] 35. Animacije (checkbox, +XP, level up, streak) + haptika
- [ ] 36. Tjedni izvještaj + prijedlog jedne promjene
- [ ] 37. Mjesečni izvještaj
- [ ] 38. Teme boja

## Faza 4 — Nadogradnje
- [ ] 39. Health sync · 40. DeepSeek provider · 41. Home-screen widget
