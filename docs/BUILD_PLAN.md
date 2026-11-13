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
- [x] **16-dev. Development build za iPhone (Borna, 2026-11-10)** — radi se PRIJE 16c. `npx expo install expo-dev-client`; `eas.json` s profilom `development` (`developmentClient: true`, `distribution: internal`) i `preview`; `app.json`: `ios.bundleIdentifier` i `android.package` = `com.milja007.ritam` (može se promijeniti prije prvog store builda — zapisati kao pitanje). `npx expo-doctor` mora proći. U README/PROGRESS kratke upute za Bornu: `npx eas-cli login`, `eas device:create` (registrira iPhone), `eas build --profile development --platform ios`, pa `npx expo start` i otvaranje u dev buildu. Sesija ne pokreće build (treba Bornov Expo/Apple login). **Borna ima Mac (2026-11-10):** prvi, besplatni put je lokalni build na njegovom Macu — `npx expo run:ios --device` s besplatnim Apple ID-em u Xcodeu (app istječe nakon 7 dana, zatim ponovni build); upute za to idu prve. EAS build / TestFlight tek kad Borna plati Apple Developer Program.
- [x] **16c. Rezultat po odabranim područjima (odluke 2026-11-10)** — `settings` + odabrana područja rezultata (plan / san / zabrane; zadano samo plan) s migracijom; izbor u onboardingu i u Profilu; `dayScore` s težinama 50/30/20 razmjerno odabranim područjima; rekordi tjedna/mjeseca bez uvjeta; Danas: jučerašnji konačni rezultat + današnji "u tijeku"; dijagnoza: ponovljena ideja ostaje + nova ideja; XP traka bez broja razine. Testovi. (Napomena: stoji iznad 16b samo zbog redoslijeda u datoteci; radi se prije 18.)
- [x] **16d. Obavijesti i postavke — dorade (odluke 2026-11-10)** — večernji upit i wind-down vikendom pomaknuti kao buđenje; Profil: uređivanje vremena obavijesti i sati sna; prekidač za podsjetnike blokova (zadano uključeni); brzi odabiri uče iz povijesti (ponavljajući blokovi u svom terminu); jutarnja obavijest s fiksnim sadržajem dana; Gotovo/Odgodi na podsjetniku bez otvaranja appa (Iskrslo otvara app).
- [x] **16b. Napredak — dnevni rezultat** — `src/core/progress/` (čisto + testovi): dnevni rezultat 0–100 (plan, zabrane, san; trackeri kasnije), usporedba s jučer i istim danom prošli tjedan, 7 dana vs 7 prije, osobni rekordi. Prikaz rezultata sa strelicom trenda na tabu Danas.
- [x] **17. Supabase shema** — `supabase/migrations/` SQL za sve tablice + RLS (vlasnik); remote projekt `ritam` postoji (vidi Odluke u PROGRESS.md), primijeniti tek kad migracije prođu lokalno. `supabase/config.toml`.
- [x] **17b. Danas — plan za danas pri ulasku (Borna, 2026-11-10)** — radi se PRIJE 18. Ako za danas nema plana (prvo korištenje, tek aktiviran, app nije otvaran), Danas odmah vodi u izradu današnjeg plana. Plan počinje **od sada**: ništa u prošlosti, prvi slobodni termin zaokružen na sljedećih 5 min, vremena točna prema satu (čisto u `src/core/`, testovi). Unos: korisnik sam napiše aktivnost + od–do ili samo trajanje (glas dolazi s 30); upisane ideje (naziv, trajanje, doba dana) se pamte i nude. Samo 2–3 primjera, jasno označena kao "primjer kako se piše" (npr. "Ponavljanje kemije · 45 min · poslijepodne"), ne gotov popis i ne zauzimaju mjesto; generičke kategorije ("Škola") se uklanjaju.
- [x] **17c. Danas — veliki raspored + trenutna aktivnost (Borna, 2026-11-10; zamjenjuje 22b)** — čim plan postoji: na vrhu "Trenutno: …" sa živim satom u sekundama i odbrojavanjem do kraja aktivnosti (i do sljedeće), ispod ostatak dana od sada prema naprijed. **Komentar** (= bilješka) samo na trenutnoj i prošlim aktivnostima; **Otkaži** na trenutnoj i budućim; prošle se prijavljuju U redu / Djelomično / Nije izravno na rasporedu. **Dizajn je najvažniji dio appa**: vizualno i umjetnički razrađen ekran (tokeni, gradijent doba dana, tipografija), provjera na iPhoneu.
- [x] **17d. Odustajem od svega + dijagnoza čim je sve riješeno + ležeran večernji podsjetnik (Borna, 2026-11-10)** — "Odustajem od svega" (potvrda, bez osude, **ne ruši streak**): preostali blokovi → neodrađeni bez XP-a, polje "što se dogodilo" (tekst; glas s 30) sprema se kao kontekst za dijagnozu, zatim odmah plan za sutra. Dijagnoza se otključa čim je svaki blok riješen i "pokupi" se na Dan. Večernji upit postaje ležeran podsjetnik samo kad nešto fali (neprijavljeni blokovi, nema plana za sutra, nepokupljena dijagnoza); ocjena dana i zabrane ostaju kratke i lagane. Čista logika + testovi.
- [x] **17e. Tabovi po novom konceptu (Borna, 2026-11-10)** — Dan · Tjedan · Mjesec · Godina · Profil; tabovi Questovi i Navike se uklanjaju, navike, san i (epski) questovi idu u Profil. Placeholderi za Mjesec i Godina dok ne dođe 25b.
- [x] **18. Supabase klijent + auth** — `@supabase/supabase-js`, env varijable (`EXPO_PUBLIC_SUPABASE_URL/KEY`), auth ekran (email magic link) iza feature flaga dok nema accounta.
- [x] **19. Sync** — red promjena lokalno → Supabase, pull pri pokretanju; konflikti: zadnji updatedAt pobjeđuje.
- [ ] **20. LLM provider** — Edge Function `llm-provider` modul (Claude sada, sučelje za DeepSeek), logiranje u `llm_calls`. Bez ključeva u repou.
- [ ] **21. parse-input** — Edge Function: slobodan tekst → blokovi (JSON). Spojiti na korak 13.
- [ ] **22. plan-day** — Edge Function: raspored sutrašnjeg dana + 0–3 pitanja, validacija u appu, fallback pravila. Plan se slaže zajedno s korisnikom (što mora, kada, mogućnosti, što ne može i zašto) i **korisnik ga odobrava** prije nego postane plan za sutra (vidljiv već iste noći).
  - *Koraci 20–22: kod je spojen (PR #16, 2026-11-13), ali ostaju `[ ]` dok funkcije nisu deployane (Borna: tajna + deploy), pokrivene testovima i `parse-input` spojen na korak 13.*
- [x] ~~**22b. Danas kao raspored sati (odluka 2026-11-10)**~~ *(zamijenjeno korakom 17c)* — dashboard dana kao školski raspored dok vrijeme ide: trenutni blok otvoren/istaknut, sljedeće ispod, status "trenutno: …" sa strane.
- [ ] **23. Provjera faze 1** — expo-doctor, pregled TODO-ova, README s uputama za pokretanje i testiranje.

## Faza 2 — Pametni planer
- [ ] 24. Google Calendar OAuth + uvoz fiksnih obaveza
- [ ] 25. Tjedni plan kao kalendar (7 dana; fiksan, uvijek promjenjiv, ne mora se sve ispuniti) + ciljevi tjedna + tjedni zadaci s pitanjima *(P54: planiranje nedjeljom za sljedeći tjedan; mjesečno/godišnje na kraju razdoblja za novo; ulazak usred razdoblja → plan odmah, uz jasno "ostalo je manje dana/tjedana/mjeseci")*
- [ ] 25b. Mjesečni i godišnji plan, svaki kao kalendar u svom tabu + ciljevi (kontekst za tjedan i dan)
- [ ] 26. Tjedni zadaci i ciljevi (tjedan/mjesec/godina) u plan-day
- [ ] 27. "Nešto je iskrslo" flow
- [ ] 28. Zabrane unutar godišnjeg / mjesečnog / tjednog plana (ne zaseban popis) + streakovi po zabrani
- [ ] 29. San: wind-down, prilagodba rasporeda lošem snu
- [ ] 30. Glasovni unos (on-device speech-to-text, HR/EN) — i za plan dana: "danas moram ovo i ono, ovo ujutro, traje sat…" → parse-input → blokovi
- [ ] 31. LLM dnevna dijagnoza (`write-report`) — struktura i ton iz CONCEPT.md (sekcija Dijagnoze), promptovi verzionirani u repou s testnim primjerima podataka, prethodne dijagnoze u kontekstu, gumbi Pomoglo / Nije pomoglo + komentar
- [ ] 31b. Opcionalni trackeri: kalorije i novac — postavke (isključeni po defaultu), unos, večernja provjera, ulaze u dnevni rezultat i dijagnozu; upozorenje za neuobičajeno nizak cilj kalorija

## Smjer „Žar“ (prioritet do 2026-11-17, odluka Borna 2026-11-12)

„Dan izgori u žar“: orb-plamen putuje niz današnji raspored (odrađeno iza njega svijetli, plan ispred je tek ocrtan), a svaki dan je jedan žar čija svjetlina znači dnevni rezultat — isti žar se vidi u tjednu, mjesecu i godini. Neodrađeno je **ugašen žar**, nikad crveni X ni kazna; **žar pali samo konačni rezultat** (nakon večernjeg upita), nikad rezultat „u tijeku“. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu

Ovi koraci idu ispred koraka 20–22 dok prioritet traje. Numeracija je zasebna (`Žar N: …` u commitovima), jer presijeca faze 1 i 3.

- [x] **Ž1. Jezgra žara** — `src/core/ember`: svjetlina iz dnevnog rezultata (granice 55/70/85), stanje točke na traci dana, boje za tamnu i svijetlu shemu; tokeni `ember*`. Testovi.
- [x] **Ž2. Dan — traka s plamenom** — kronološka traka (ranije → „Sada“ → ostatak dana), izgorjela puna linija iza plamena, crtkana ispred, orb s pulsom (Reanimated, poštuje „smanji kretanje“), bez crvene za neodrađeno.
- [x] **Ž3. Tjedan** — 7 stupaca dana s blokovima (06–24 h), linija „sada“, žar i rezultat ispod svakog dana, razlika prosjeka prema prošlom tjednu.
- [x] **Ž4. Mjesec** — kalendar žarova, legenda svjetline, usporedba prosjeka s prošlim mjesecom, najjači dan.
- [x] **Ž5. Godina** — 365 točkica po mjesecima, rekordi (najduži niz u godini, najjači mjesec, broj ocijenjenih dana).
- [x] **Ž6. Profil** — kartica napretka s orbom u prstenovima + graf „Zadnjih 30 dana“ (`trend`, `TrendCard`).
- [x] **Ž7. Zaglavlje Dana** — datum iznad naslova „Danas“, pilula niza (žar svijetli dok niz traje) i pilula rezultata sa strelicom trenda (`scorePill`).
- [x] **Ž8. Kartica „Trenutno“** — veliki živi sat sa sekundama u boji plamena, „još mm:ss“ desno, tanki obrub.
- [x] **Ž9. Paljenje žara** — žar današnjeg dana u zaglavlju Dana: ugašen obrub dok dan traje, pa se nakon večernjeg upita upali na svoju razinu uz jednokratnu animaciju (`todayEmber`, `shouldIgnite`, `EmberIgnite`; poštuje „smanji kretanje“).
- [x] **Ž10. Godina → dodir mjeseca** — redak mjeseca u Godini otvara taj mjesec u tabu Mjesec, „Ovaj mjesec“ vraća na tekući; budući mjesec nije dodirljiv.
- [ ] **Ž11. Haptika** *(„+N XP“ animacija je gotova bez haptike; level-up ide uz korak 32)* — dio koraka 35; traži `expo-haptics` (novi paket → `package.json`, visokorizično, samo kroz `npx expo install`).
- [x] **Ž12. Arhiva dijagnoza** — popis prošlih dnevnih dijagnoza na Profilu, po mjesecima, najnovija prvo; dodir otvara dijagnozu tog dana, „Prikaži još“ dodaje sljedećih deset. Nepročitane su označene točkom. Čita se samo popis (`listDayReportArchive`) — dijagnoza se ne generira dok se red ne otvori.

Namjerno izvan smjera „Žar“ (čeka svoje korake): ciljevi tjedna/mjeseca/godine (25, 25b), „[Sustav]“ poruke te rang i statovi (34b), bedževi i otključavanja (32, 34), listanje prošlih razdoblja strelicama (34b), točkice fiksnih obaveza (24).

## Faza 3 — Igra i animacije
- [ ] 32. Leveli + otključavanja
- [ ] 33. Orb-plamen avatar (Skia)
- [ ] 34. Epski questovi u Profilu (samo dugoročni, sam ih postaviš; bez dnevnih/tjednih — 2026-11-10) + freeze tokeni + bedževi
- [x] 34b. Rang E–S i statovi (Disciplina, Volja, Energija, Zdravlje, Novac) — lagani Solo Leveling štih, poruke "[Sustav]" — *rang iz „dobrih tjedana“, statovi iz dijelova konačnog rezultata zadnjih 30 dana, kartica na Profilu; Zdravlje i Novac dobivaju vrijednost s trackerima (31b).*
- [ ] 35. Animacije (checkbox, +XP, level up, streak) + haptika — *dio gotov u smjeru „Žar“:* klizanje ispune `ProgressBar`-a (tokeni `src/core/theme/motion.ts`) i paljenje žara (Ž9). „+N XP“ uz XP traku na Danu je gotov (2026-11-13). Ostaje haptika → **Ž11**, level-up (uz korak 32) i animacija niza.
- [ ] 36. Tjedna dijagnoza (nedjelja: dan + tjedan) + prijedlog jedne promjene + streak boljih tjedana
- [ ] 37. Mjesečna dijagnoza (zadnji dan u mjesecu: dan + tjedan + mjesec)
- [ ] 37b. Godišnja dijagnoza (31. 12.: dan + tjedan + mjesec + godina)
- [ ] 37c. Grafovi napretka: 30 dana na Profilu, godišnja toplinska karta, arhiva dijagnoza — *dio gotov u smjeru „Žar“:* graf 30 dana (Ž6), godišnja karta žarova (Ž5), dodir žara dana otvara dijagnozu tog dana. Ostaje popis arhive dijagnoza → **Ž12**.
- [ ] 38. Teme boja

## Faza 4 — Nadogradnje
- [ ] 39. Health sync · 40. DeepSeek provider · 41. Home-screen widget
