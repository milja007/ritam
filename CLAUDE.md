# Ritam — upute za Claude sesije

Pročitaj i poštuj `AGENTS.md` (Expo pravila: provjeri verziju SDK-a i čitaj versioned docs, `npx expo install` za pakete).

## Kontekst
- Koncept: `docs/CONCEPT.md` (puni dokument je u Claude Docs, link unutra).
- Plan: `docs/BUILD_PLAN.md` — redoslijed koraka i kriteriji gotovosti.
- Dnevnik: `docs/PROGRESS.md` — što je zadnje napravljeno i što je sljedeće.

## Git autor (odluka Borna, 2026-11-10)
Prije prvog commita u sesiji postavi autora na Bornu, da se commitovi vide u njegovom GitHub grafu aktivnosti:
```bash
git config user.name "Borna Miljković"
git config user.email "162634695+milja007@users.noreply.github.com"
```
Claude ostaje koautor kroz `Co-Authored-By` redak u poruci commita. Stare commitove ne prepisuj.

## Kako radiš (svaka sesija)
1. Pročitaj `docs/PROGRESS.md` (vrh) i `docs/BUILD_PLAN.md`; nađi prvi korak koji nije `[x]`.
1b. Pogledaj otvorene GitHub issue u `milja007/ritam` s greškama s uređaja (Borna ih prijavljuje). Ako postoje, prvo popravi njih (mali commitovi, test koji pokriva grešku, komentar na issue kad je popravljeno), pa tek onda nastavi s korakom.
2. **Prije koda** napiši kratki plan tog koraka (3–8 točaka) na vrh `PROGRESS.md` pod novim datumom i provjeri ga protiv koncepta i kriterija gotovosti.
3. Radi samo taj korak. Mali, sigurni commitovi. Nikad ne radi više koraka odjednom osim ako je korak gotov i ostalo je puno budžeta (tada najviše jedan sljedeći mali korak).
4. **Jedan agent u isto vrijeme** — ne pokreći paralelne subagente. Ako trebaš pomoć, najviše jedan subagent, i čekaj ga.
5. Prije commita: `npx tsc --noEmit`, `npx expo lint`, `npm test` (kad postoji) — sve mora proći.
6. Završi: označi korak u `BUILD_PLAN.md`, ažuriraj `PROGRESS.md` (napravljeno, sljedeće, problemi), commit, push na `main`.
7. Ako budžet/kontekst ponestaje prije kraja koraka: stani na čistom mjestu, commitaj WIP na granu `wip/korak-N`, push, i u `PROGRESS.md` zapiši točno gdje si stao. Sljedeća sesija nastavlja od tamo.

## Pravila koda
- TypeScript strict, bez `any`. Čista logika (raspoređivanje, XP, streak, notifikacijski okidači) u `src/core/**` bez React importa i s testovima.
- UI tekstovi isključivo kroz i18n (HR i EN) čim korak 3 bude gotov.
- Nikad API ključeve ni tajne u repo. Env kroz `EXPO_PUBLIC_*` samo za javne vrijednosti; LLM ključevi samo u Supabase secrets.
- Ne diraj `ios/` i `android/` (CNG).
- Promjene koncepta (nova značajka, drukčija odluka) ne radi sam — zapiši kao pitanje u `PROGRESS.md` pod "Pitanja za Bornu".
