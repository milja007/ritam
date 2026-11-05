# Jutarnja automatska sesija

Scheduled task "Ritam jutarnji rad" svako jutro u 06:43 (Europe/Zagreb) pokreće novu sesiju s ovim promptom. `OWNER/REPO` se zamijeni stvarnim repoom kad se postavi.

## Prompt

```
Ovo je automatska jutarnja sesija za Bornov projekt Ritam (osobni productivity app, React Native / Expo, HR + EN). Nitko ne gleda dok radiš — ne čekaj potvrde, nego postupi razumno i zapiši odluke.

1. Spoji GitHub repo OWNER/REPO s push pristupom i kloniraj ga. Ako to ne uspije, pošalji Borni jednu kratku poruku zašto i stani.
2. Pročitaj CLAUDE.md, docs/PROGRESS.md i docs/BUILD_PLAN.md i strogo prati pravila iz CLAUDE.md.
3. Ako postoji grana wip/korak-N, nastavi taj korak na njoj. Inače uzmi prvi korak u BUILD_PLAN.md koji nije [x].
4. Prije koda napiši plan koraka (3–8 točaka) na vrh docs/PROGRESS.md pod današnjim datumom. Ponovo ga pročitaj kao strogi recenzent: odgovara li konceptu i kriterijima gotovosti? Ispravi ga, pa tek onda kreni.
5. Radi samo taj jedan korak. Jedan agent u isto vrijeme — ne pokreći paralelne subagente.
6. Commitaj i pushaj često (barem nakon svake smislene cjeline), da se ništa ne izgubi ako sesija naglo stane. Dok korak nije gotov, radi na grani wip/korak-N; kad je gotov i prolaze npx tsc --noEmit, npx expo lint i npm test (kad postoji), spoji na main i pushaj.
7. Ako budžet ili kontekst ponestaje: stani na čistom mjestu, commitaj i pushaj WIP, i u PROGRESS.md zapiši točno gdje si stao i što je sljedeće.
8. Ne mijenjaj koncept ni odluke. Sve što zahtijeva Bornovu odluku zapiši u PROGRESS.md pod "Pitanja za Bornu" i nastavi s onim što možeš.
9. Nikad ne commitaj tajne ni API ključeve. Ne briši grane ni povijest.
10. Na kraju pošalji Borni kratku poruku na hrvatskom (2–4 rečenice): koji korak, što je gotovo, što je sljedeće, i ima li pitanja.
```

## Provjera prompta (2026-11-05)
- Samodostatan: nova sesija nema memoriju ovog chata, sve upute su u promptu + CLAUDE.md.
- Pokriva nestanak kredita: česti push + WIP grana + bilješka u PROGRESS.md.
- "Malo po malo": jedan korak po sesiji, plan prije koda, samopregled plana.
- Jedan agent u isto vrijeme: eksplicitno.
- Ništa nepovratno: ne briše grane/povijest, ne mijenja koncept, bez tajni.
