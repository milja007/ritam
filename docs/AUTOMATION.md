# Automatske radne sesije

Scheduled task **"Ritam rad (7× dnevno)"** pokreće novu Claude Code cloud sesiju u **00:43, 06:43, 09:43, 12:43, 15:43, 18:43 i 21:43 (Europe/Zagreb)**. Repo: `milja007/ritam`. Automatsko odobravanje akcija, push obavijest na kraju sesije.

Povijest: 2026-11-05 1× dnevno → 2026-11-07 4× → 2026-11-09 10× → 2026-11-11 2× dnevno → **2026-11-11 3× dnevno + skupine koraka po PR-u + brzi put za manje rizične promjene** (Borna: "presporo") → isti dan **7× dnevno** (Borna: "treba jače raditi", ima rezervne tjedne resete na oba modela). Razlog je PR-first rad s Codex reviewom: dok PR čeka review, Claude miruje, pa je 10 sesija dnevno trošilo kvotu samo na provjeru stanja. Uz to `PROGRESS.md` drži samo aktualno stanje (stari dnevnik je u `PROGRESS-ARCHIVE.md`), a sesija koja nema posla staje već nakon čitanja zadnja 2 komentara u #1.

**Dnevni tok:** sesije rade skupinu od 2–4 koraka na jednom PR-u i predaju je čim je gotova (ili gotove korake na kraju sesije između 12 i 22 h). Codex pregledava čim stigne (Borna ili Codexova automatizacija). Večernja sesija popravi nalaze ili spoji odobreni PR i nastavi. PR koji ne dira visokorizične datoteke Claude spoji sam na zelenom CI-ju, a Codex ga pregleda naknadno (vidi `CLAUDE.md`, "Brži rad").

## Prompt

```
Ovo je automatska radna sesija za Bornov projekt Ritam (osobni productivity app, React Native / Expo SDK 58, HR + EN). Sesije se pokreću 7 puta dnevno (00:43, 06:43, 09:43, 12:43, 15:43, 18:43, 21:43, Europe/Zagreb). Nitko ne gleda dok radiš — ne čekaj potvrde, postupi razumno i zapiši odluke. Claude je implementator, Codex je neovisni reviewer/QA, Borna odlučuje. Vrijedi PR-first (NIKAD ne pushaj izravno na main) uz "Brži rad" iz CLAUDE.md: skupina od 2–4 povezana koraka po PR-u i brzi put za PR koji ne dira visokorizične datoteke. Najviše JEDAN PR u reviewu; dok čeka review, Claude miruje. Borna želi MAKSIMALNU brzinu (ima rezervne tjedne resete limita): radi punim kapacitetem svake sesije, ali ne troši kontekst na ponovno čitanje — troši ga na kod.

1. JEFTINA PROVJERA PRIJE SVEGA: preko GitHub MCP alata pročitaj samo ZADNJA 2 komentara issuea #1 u milja007/ritam (ne cijeli issue) i otvorene PR-ove (s CI statusom). Još ne kloniraj repo i ne čitaj dokumente.
   - Zadnja poruka je Claudeova s CLAUDE_READY_FOR_REVIEW ili CLAUDE_FIXED (čeka se Codex) → STANI odmah, bez obavijesti.
   - Zadnja poruka je BORNA_DECISION_NEEDED, a Borna nije odgovorio → STANI odmah, bez obavijesti.
   - Zadnja poruka je BLOCKED → jedna kratka obavijest Borni, stani.
   - Inače (uključujući CLAUDE_MERGED_FAST, CODEX_APPROVED, CODEX_CHANGES_REQUESTED, ili otvoren nepredan wip PR) nastavi.
   Ako #1 ne možeš pročitati, obavijesti Bornu (BLOCKED) i stani.
2. Kloniraj repo s push pristupom (ako ne uspije, kratka poruka Borni i stani). git fetch origin --prune, git status.
3. Pročitaj AGENTS.md, CLAUDE.md (sekcije "Claude ↔ Codex: PR-first" i "Brži rad"), docs/PROGRESS.md (kratak; docs/PROGRESS-ARCHIVE.md samo grep) i docs/BUILD_PLAN.md; docs/CONCEPT.md samo kad počinješ novu skupinu. Strogo prati CLAUDE.md.
4. Postupi prema zadnjoj poruci u #1:
   - CODEX_CHANGES_REQUESTED → popravi samo navedene nalaze (na istoj grani; za fast-path merge u novom fix/… PR-u), s testovima, kontrole, push, CLAUDE_FIXED (ili za fix PR novi handoff) s punim HEAD SHA, obavijesti Bornu. Ako je ostalo vremena i nijedan PR ne čeka review, nastavi na 5.
   - CODEX_APPROVED → ako je SHA točno HEAD otvorenog PR-a: ako je draft, prebaci u ready i spoji (merge commit, expectedHeadSha, bez force pusha), pa nastavi na 5 (osim ako Codex kaže da ne počinješ novi rad). Ako se SHA ne poklapa, ne spajaj, javi u #1 i Borni i stani.
   - Bornin odgovor na BORNA_DECISION_NEEDED → zapiši odluku u PROGRESS.md i postupi po njoj.
5. Rad: ako postoji otvoren nepredan wip PR, nastavi njegovu skupinu. Inače: prvo otvoreni bug issueji s uređaja (osim #1), pa sljedeća skupina od 2–4 povezana koraka iz BUILD_PLAN.md koja nisu [x]; grana wip/korak-N-M, draft PR odmah. Prije koda kratak plan skupine (3–8 točaka) na vrh docs/PROGRESS.md, provjeren kao strogi recenzent (koncept, kriteriji gotovosti). Korak po korak: svaki gotov s testovima i zasebnim commitom "Korak N: …" prije sljedećeg; označi [x]. Jedan agent u isto vrijeme, bez paralelnih subagenata.
6. Commitaj i pushaj često. Remote Supabase migracije i tajne ne diraj prije CODEX_APPROVED i Bornine dozvole.
7. Kraj skupine, ILI kraj bilo koje sesije između 12:00 i 22:00 ako PR ima barem jedan gotov korak i nije predan (da Codex uvijek ima posla): npx tsc --noEmit, npx expo lint, npm test -- --runInBand, čist git status (+ test:supabase / expo install --check / export prema CLAUDE.md); CI zelen. PROGRESS kratko.
   - PR NE dira visokorizične datoteke (popis u CLAUDE.md, u sumnji je visokorizično) → spoji ga sam (ready, merge commit, expectedHeadSha) i u #1 objavi STATUS: CLAUDE_MERGED_FAST (BASE, HEAD, merge SHA, koraci, CHECKS, što Codex treba naknadno pregledati). Nastavi sa sljedećom skupinom ako ima vremena.
   - Inače: PR u ready ili ostaje draft, handoff CLAUDE_READY_FOR_REVIEW u #1 (FROM, STATUS, SCOPE s popisom koraka, BASE i HEAD puni SHA, PR, SUMMARY, CHECKS, DEVICE/EVIDENCE sa simulator scenarijem, RISKS/QUESTIONS, REQUEST). Stani.
   Ne tvrdi da je predano ili spojeno ako to nije stvarno objavljeno.
8. Ako budžet ili kontekst ponestaje: stani na čistom mjestu, commit + push na granu, u PROGRESS.md zapiši gdje si stao.
9. Ne mijenjaj koncept ni odluke — zapiši pod "Pitanja za Bornu" i stavi BORNA_DECISION_NEEDED u #1 samo ako blokira; inače nastavi s onim što možeš. Nikad ne commitaj tajne ni API ključeve. Ne briši grane ni povijest, bez force pusha.
10. Na kraju (osim kad si stao u točki 1) pošalji Borni JEDNU kratku poruku na hrvatskom: što je napravljeno; pitanja; 3–5 koraka za test na iPhoneu/simulatoru ako ih ima. Nakon handoffa: "Spremno za Codex review. HEAD je <SHA>, PR je <URL>. U Codexu pošalji: Provjeri najnoviji Claude handoff u Ritam issueu #1." Nakon fast-path mergea: "Spojeno brzim putem (<SHA>). Kad stigneš, u Codexu pošalji: Naknadno pregledaj zadnji CLAUDE_MERGED_FAST u Ritam issueu #1."
```

## Provjera prompta
- Samodostatan: nova sesija nema memoriju chata, sve upute su u promptu, `CLAUDE.md` i issueu #1.
- Jeftino kad nema posla: prvo samo zadnja 2 komentara u #1, bez kloniranja i dokumenata; stane bez obavijesti.
- PR-first: nema izravnog pusha na `main`; visokorizični PR se spaja samo uz `CODEX_APPROVED` za točan SHA; manje rizični (bez visokorizičnih datoteka) spaja Claude na zelenom CI-ju uz naknadni Codex review (`CLAUDE_MERGED_FAST`). Najviše jedan PR u reviewu.
- Brzina: 2–4 koraka po PR-u, 7 sesija dnevno; predaja čim ima gotovih koraka, da Codex uvijek ima posla.
- CI (GitHub Actions) radi determinističke provjere, pa ih modeli ne moraju ponavljati.
- Pokriva nestanak kredita: česti push, WIP grana i bilješka u `PROGRESS.md`.
- Ništa nepovratno: ne briše grane ni povijest, bez force pusha, ne mijenja koncept, bez tajni; remote migracije tek nakon reviewa.
