# Automatske radne sesije

Scheduled task "Ritam rad (4× dnevno)" pokreće novu sesiju u 06:43, 10:43, 13:43 i 20:43 (Europe/Zagreb) s ovim promptom. Repo: `milja007/ritam`. Postavljeno 2026-11-05 (1× dnevno), prošireno na 4× dnevno 2026-11-07. Automatsko odobravanje akcija, push obavijest na kraju svake sesije.

## Prompt

```
Ovo je automatska radna sesija za Bornov projekt Ritam (osobni productivity app, React Native / Expo, HR + EN). Sesije se pokreću 4 puta dnevno (06:43, 10:43, 13:43, 20:43). Nitko ne gleda dok radiš — ne čekaj potvrde, nego postupi razumno i zapiši odluke.

1. Spoji GitHub repo milja007/ritam s push pristupom i kloniraj ga. Ako to ne uspije, pošalji Borni jednu kratku poruku zašto i stani.
2. Ako postoji grana wip/korak-N s pushom u zadnjih 60 minuta, prethodna sesija možda još radi — pošalji Borni jednu kratku poruku i stani, da se dvije sesije ne sudare.
3. Pročitaj CLAUDE.md, docs/PROGRESS.md i docs/BUILD_PLAN.md i strogo prati pravila iz CLAUDE.md.
4. Ako postoji grana wip/korak-N, nastavi taj korak na njoj. Inače uzmi prvi korak u BUILD_PLAN.md koji nije [x].
5. Prije koda napiši plan koraka (3–8 točaka) na vrh docs/PROGRESS.md pod današnjim datumom i vremenom. Ponovo ga pročitaj kao strogi recenzent: odgovara li konceptu i kriterijima gotovosti? Ispravi ga, pa tek onda kreni.
6. Radi samo taj jedan korak. Jedan agent u isto vrijeme — ne pokreći paralelne subagente.
7. Commitaj i pushaj često (barem nakon svake smislene cjeline), da se ništa ne izgubi ako sesija naglo stane. Dok korak nije gotov, radi na grani wip/korak-N; kad je gotov i prolaze npx tsc --noEmit, npx expo lint i npm test (kad postoji), spoji na main i pushaj.
8. Ako budžet ili kontekst ponestaje: stani na čistom mjestu, commitaj i pushaj WIP, i u PROGRESS.md zapiši točno gdje si stao i što je sljedeće.
9. Ne mijenjaj koncept ni odluke. Sve što zahtijeva Bornovu odluku zapiši u PROGRESS.md pod "Pitanja za Bornu" i nastavi s onim što možeš.
10. Nikad ne commitaj tajne ni API ključeve. Ne briši grane ni povijest.
11. Na kraju pošalji Borni kratku poruku na hrvatskom (2–4 rečenice): koji korak, što je gotovo, što je sljedeće, i ima li pitanja.
```

## Provjera prompta
- Samodostatan: nova sesija nema memoriju chata, sve upute su u promptu + CLAUDE.md.
- Pokriva nestanak kredita: česti push + WIP grana + bilješka u PROGRESS.md.
- "Malo po malo": jedan korak po sesiji, plan prije koda, samopregled plana.
- Jedan agent u isto vrijeme: eksplicitno; zaštita od sudara dviju sesija (točka 2).
- Ništa nepovratno: ne briše grane/povijest, ne mijenja koncept, bez tajni.
