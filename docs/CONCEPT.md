# Ritam — koncept (sažetak)

Puni koncept: https://claude.ai/artifact/WHksM4MdhHutFW9Siw7umX (Claude Docs). Ovo je sažetak da repo bude samodostatan.

## Ukratko
Osobni planer (iOS + Android, React Native / Expo, HR + EN). Svaku večer pita što imaš sutra, LLM složi raspored, ujutro stiže obavijest s gotovim danom. Gamificirano (XP, streakovi, bedževi, orb-plamen avatar, lagani Solo Leveling štih). Princip: **malo po malo** — nikad nagle promjene. Napredak se mjeri **naspram vlastite prošlosti**, ne savršenstva, i mora se vidjeti na prvi pogled.

## Danas — glavni ekran (Borna, 2026-11-10)
- Nema plana za danas (prvo korištenje, tek aktiviran, app nije otvaran) → odmah izrada današnjeg plana, **od sadašnjeg trenutka prema naprijed**, vremena točna prema satu.
- Čim plan postoji → veliki raspored dana: na vrhu **"Trenutno: …"** sa živim satom u sekundama i odbrojavanjem do kraja aktivnosti; ispod ostatak dana.
- Na trenutnoj aktivnosti i na svakom bloku do večernjeg upita: komentar, otkaži, bilješka.
- **Odustajem od svega** — uvijek dostupno, bez osude: preostalo postaje neodrađeno, odmah plan za sutra.
- **Dijagnoza dana** tek kad je svaki blok riješen (odrađen, ili prijavljen da nije / neće biti).
- Ponuđene ideje nisu generičke ("Škola"): svaka ima konkretan naziv, trajanje i najbolje doba dana; primjeri su dopušteni.
- Ovo je najvažniji ekran — mora biti vizualno, umjetnički i dizajnerski vrhunski.
- Glasovni unos plana ("danas moram ovo i ono, ovo ujutro, traje sat…") — kasnije.

## Planovi: godina, mjesec, tjedan (Borna, 2026-11-10)
- Ciljevi žive u **godišnjem, mjesečnom i tjednom** planu (kalendarski prikaz + ciljevi kao kontekst); **dan je samo akcija**.
- Tjedan: kalendar po danima, fiksan ali uvijek promjenjiv; upišeš što znaš, ne mora sve odmah.
- **Zabrane** se postavljaju unutar tih planova, ne kao zaseban popis.
- **Questovi se ukidaju** (zamjenjuju ih mjesečni i godišnji planovi); **navike** ostaju samo u Profilu.
- Tabovi: Danas · Tjedan · Mjesec i godina · Profil.

## Dnevni ciklus
Večernji upit → LLM raspoređivač slaže sutra → wind-down podsjetnik → san → jutarnja obavijest (raspored + prijava sna) → dan (podsjetnici, "Nešto je iskrslo") → večernji upit.

## Večernji upit (1–2 min, sve pripremljeno, korisnik samo tapka)
1. Checklist dana: svaka stavka "Je li sve bilo u redu?" → U redu / Nije; za "Nije" komentar (tipkanje ili glas), za zadatke "kad kasnije?".
2. Zabrane: Držao sam se / Prekršio sam (+ okidač).
3. Otvorena pitanja dana (odgođeni blokovi, neodgovoreni prijedlozi).
4. Ocjena dana 1–5 + rečenica.
5. Dijagnoza dana, pa "Što imaš sutra?" (Google Calendar + brzi odgovori / tipkanje / glas → LLM pretvori u blokove).

## Ostale značajke
- **Tjedni zadaci**: pitanja kod unosa (trajanje, rok, koliko puta, doba dana, što treba, energija); LLM ih smješta, pravila su tvrda ograničenja.
- **Izvanredne okolnosti**: gumb "Nešto je iskrslo" → što, koliko dugo → za svaki pogođeni zadatak: kasnije danas / sutra / drugi dan / preskoči. Ne kvari streak.
- **Zabrane** (unutar godišnjeg/mjesečnog/tjednog plana): naziv, kad vrijedi, razlog (zašto), težina 1–3, svaka ima streak.
- **San**: ciljano buđenje + sati sna → vrijeme kreveta; wind-down obavijest; jutarnja prijava; raspored se prilagođava lošem snu; postupni pomaci po 15 min.
- **Gamifikacija**: XP po akcijama (bez kazni), leveli, glavni streak + freeze tokeni, težina raste polako, orb-plamen avatar (Skia). Igra motivira, nije sama sebi cilj. Lagani Solo Leveling štih: rang E → D → C → B → A → S (raste kad napredak traje tjednima), statovi iz stvarnog ponašanja (Disciplina = plan, Volja = zabrane, Energija = san, Zdravlje = kalorije, Novac = budžet; zadnja dva samo s uključenim trackerima), poruke "[Sustav]". **Bedževi** za napredak i upornost, ne savršenstvo (npr. Prvi tjedan, 7 dana bez prekršaja, Rekord tjedna, 4 bolja tjedna zaredom, Mjesec u budžetu, 100 večernjih upita).

## Dijagnoze (najvažniji dio appa — moraju biti vrhunske)
Svaku večer u dogovoreno vrijeme (kraj večernjeg upita) dijagnoza dana; veće se slažu po kalendaru:
- svaki dan → **dan**; nedjelja → **dan + tjedan**; zadnji dan u mjesecu → **dan + tjedan + mjesec** (ako nije nedjelja, tjedni dio = zadnjih 7 dana); 31. 12. → **dan + tjedan + mjesec + godina**.

Struktura svake dijagnoze, uvijek istim redom:
1. **Ukratko** — jedna rečenica + trend (bolje / isto / lošije nego prije).
2. **Napredak** — brojke naspram prošlosti: jučer, isti dan prošli tjedan, prošli tjedan, prošli mjesec, osobni rekord.
3. **Pohvale** — što je išlo super i neka tako ostane.
4. **Što smo primijetili** — uzorci i mogući uzroci, psihološki pogled (kad padaš, što te diže, što pomaže).
5. **Veliki problemi** — iskreno i objektivno, bez uljepšavanja, ali nikad bezobrazno ni s osudom.
6. **Ideje za napredak** — konkretni mali koraci; malo po malo: najviše 1 nova promjena tjedno, 2 mjesečno, nova tek kad je prethodna stabilna ~2 tjedna; odbijeni prijedlog se ne nudi ponovo 2 tjedna.

Dan se čita za 30 s; tjedan, mjesec i godina su detaljni. Ton: kao dobar trener — iskren, topao, konkretan; prvo činjenice pa tumačenje; svaka kritika s idejom što napraviti; bez posramljivanja.
Kvaliteta: LLM dobiva sve iz razdoblja (checklist + komentari, zabrane, san, XP, trackeri, prethodne dijagnoze — prati je li prošli savjet upalio); komentari postaju uvidi ("tri utorka zaredom *umoran*…"); promptovi verzionirani u repou i testirani na primjerima podataka; ispod svake dijagnoze **Pomoglo / Nije pomoglo** + komentar; arhiva svih dijagnoza na Profilu.

## Napredak u odnosu na prošlost
Savršen tjedan/mjesec gotovo nitko nikad neće imati — mjeri se jesi li bolji nego prije.
- **Dnevni rezultat 0–100**: udio odrađenog plana, poštovane zabrane, san na vrijeme, + kalorije i budžet ako su uključeni (što se ne bilježi, ne ulazi).
- **Usporedbe**: danas vs jučer i isti dan prošli tjedan; zadnjih 7 dana vs 7 prije; mjesec vs prošli mjesec; godina vs prošla; osobni rekordi (dan, tjedan, mjesec, najduži streak).
- **Streak boljih tjedana**: tjedni zaredom jednako dobri ili bolji od prethodnog.
- **Prikaz**: na Danas rezultat + strelica trenda; na Profilu graf 30 dana i godišnja toplinska karta (kao GitHub kontribucije).

## Opcionalni trackeri (isključeni po defaultu, uključuju se u Profilu)
- **Kalorije**: dnevni cilj, unos kcal (po obroku ili zbroj) → večernja provjera: unutar / iznad / ispod i koliko. Upozorenje ako je cilj neuobičajeno nizak.
- **Novac**: limit potrošnje za dan/tjedan/mjesec (npr. "najviše 100 € ovaj tjedan"), po želji trenutno stanje; unos potrošnje (iznos + bilješka) → koliko je ostalo, tjedni/mjesečni zbroj.
- Kalorije i novac ulaze u dnevni rezultat i dijagnoze samo kad su uključeni; ciljeve postavlja korisnik.

## Tehnika (odluke)
Expo (SDK iz package.json) + TypeScript, Expo Router, Zustand + TanStack Query, Supabase cloud (Auth, Postgres, Edge Functions, RLS) — account stiže kasnije, do tada lokalno; expo-sqlite kao offline cache; LLM preko Edge Functiona iza `LLMProvider` sučelja (Claude sada, DeepSeek kasnije); Google Calendar (read-only); expo-notifications (lokalne) s akcijama; Reanimated + Skia + Lottie; i18next (HR/EN).

## Faze
1. **Jezgra (MVP)**: jutarnja obavijest, večernji upit + checklist s komentarom, dnevna dijagnoza, timeline + uređivanje, Supabase + HR/EN, osnovni XP + streak + dnevni rezultat i usporedba s prošlošću. Gotovo kad: 7 dana zaredom ispunjen upit.
2. **Pametni planer**: LLM raspoređivač, Google Calendar, tjedni zadaci, "Nešto je iskrslo", zabrane + san, glasovni unos, LLM dnevna dijagnoza, trackeri kalorija i novca.
3. **Igra i animacije**: leveli, orb-plamen, freeze tokeni, animacije i haptika, bedževi + rang E–S i statovi, tjedna/mjesečna/godišnja dijagnoza, grafovi napretka.
4. **Nadogradnje**: Health sync, prelazak na DeepSeek, home-screen widget.
