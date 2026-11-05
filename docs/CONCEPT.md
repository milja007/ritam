# Ritam — koncept (sažetak)

Puni koncept: https://claude.ai/artifact/WHksM4MdhHutFW9Siw7umX (Claude Docs). Ovo je sažetak da repo bude samodostatan.

## Ukratko
Osobni planer (iOS + Android, React Native / Expo, HR + EN). Svaku večer pita što imaš sutra, LLM složi raspored, ujutro stiže obavijest s gotovim danom. Gamificirano (XP, streakovi, questovi, orb-plamen avatar). Princip: **malo po malo** — nikad nagle promjene.

## Dnevni ciklus
Večernji upit → LLM raspoređivač slaže sutra → wind-down podsjetnik → san → jutarnja obavijest (raspored + prijava sna) → dan (podsjetnici, "Nešto je iskrslo") → večernji upit.

## Večernji upit (1–2 min, sve pripremljeno, korisnik samo tapka)
1. Checklist dana: svaka stavka "Je li sve bilo u redu?" → U redu / Nije; za "Nije" komentar (tipkanje ili glas), za zadatke "kad kasnije?".
2. Zabrane: Držao sam se / Prekršio sam (+ okidač).
3. Otvorena pitanja dana (odgođeni blokovi, neodgovoreni prijedlozi).
4. Ocjena dana 1–5 + rečenica.
5. Dnevni izvještaj, pa "Što imaš sutra?" (Google Calendar + brzi odgovori / tipkanje / glas → LLM pretvori u blokove).

## Ostale značajke
- **Tjedni zadaci**: pitanja kod unosa (trajanje, rok, koliko puta, doba dana, što treba, energija); LLM ih smješta, pravila su tvrda ograničenja.
- **Izvanredne okolnosti**: gumb "Nešto je iskrslo" → što, koliko dugo → za svaki pogođeni zadatak: kasnije danas / sutra / drugi dan / preskoči. Ne kvari streak.
- **Zabrane**: naziv, kad vrijedi, razlog (zašto), težina 1–3, svaka ima streak.
- **San**: ciljano buđenje + sati sna → vrijeme kreveta; wind-down obavijest; jutarnja prijava; raspored se prilagođava lošem snu; postupni pomaci po 15 min.
- **Gamifikacija**: XP po akcijama (bez kazni), leveli, glavni streak + freeze tokeni, dnevni/tjedni/epski questovi, težina raste polako, orb-plamen avatar (Skia).
- **Izvještaji**: dnevni (kraj večernjeg upita), tjedni (nedjelja), mjesečni (zadnji dan). Najviše 1 prijedlog promjene tjedno, 2 mjesečno; nova promjena tek kad je prethodna stabilna ~2 tjedna.

## Tehnika (odluke)
Expo (SDK iz package.json) + TypeScript, Expo Router, Zustand + TanStack Query, Supabase cloud (Auth, Postgres, Edge Functions, RLS) — account stiže kasnije, do tada lokalno; expo-sqlite kao offline cache; LLM preko Edge Functiona iza `LLMProvider` sučelja (Claude sada, DeepSeek kasnije); Google Calendar (read-only); expo-notifications (lokalne) s akcijama; Reanimated + Skia + Lottie; i18next (HR/EN).

## Faze
1. **Jezgra (MVP)**: jutarnja obavijest, večernji upit + checklist s komentarom, dnevni izvještaj, timeline + uređivanje, Supabase + HR/EN, osnovni XP + streak. Gotovo kad: 7 dana zaredom ispunjen upit.
2. **Pametni planer**: LLM raspoređivač, Google Calendar, tjedni zadaci, "Nešto je iskrslo", zabrane + san, glasovni unos.
3. **Igra i animacije**: leveli, orb-plamen, questovi + freeze, animacije i haptika, tjedni i mjesečni izvještaj.
4. **Nadogradnje**: Health sync, prelazak na DeepSeek, home-screen widget.
