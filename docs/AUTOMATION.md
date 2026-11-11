# Automatske radne sesije

Scheduled task **"Ritam rad (2× dnevno)"** pokreće novu Claude Code cloud sesiju u **06:43 i 18:43 (Europe/Zagreb)**. Repo: `milja007/ritam`. Automatsko odobravanje akcija, push obavijest na kraju sesije.

Povijest: 2026-11-05 1× dnevno → 2026-11-07 4× → 2026-11-09 10× → **2026-11-11 2× dnevno** (Borna). Razlog je PR-first rad s Codex reviewom: dok PR čeka review, Claude miruje, pa je 10 sesija dnevno trošilo kvotu samo na provjeru stanja. Uz to `PROGRESS.md` drži samo aktualno stanje (stari dnevnik je u `PROGRESS-ARCHIVE.md`), a sesija koja nema posla staje već nakon čitanja zadnja 2 komentara u #1.

**Dnevni tok:** jutarnja sesija implementira jedan mali korak i preda PR. Borna otvori laptop i pošalje Codexu review, po potrebi testira. Večernja sesija popravi nalaze ili spoji odobreni PR. Ako reviewa nema, sesija odmah stane.

## Prompt

```
Ovo je automatska radna sesija za Bornov projekt Ritam (osobni productivity app, React Native / Expo SDK 58, HR + EN). Sesije se pokreću 2 puta dnevno (06:43 i 18:43, Europe/Zagreb). Nitko ne gleda dok radiš — ne čekaj potvrde, postupi razumno i zapiši odluke. Claude je implementator, Codex je neovisni reviewer/QA, Borna odlučuje. Vrijedi PR-first: NIKAD ne spajaj i ne pushaj izravno na main. Najviše JEDAN aktivni implementacijski PR; dok čeka review, Claude miruje. Štedi kvotu: Borna ima najjeftiniju pretplatu.

1. JEFTINA PROVJERA PRIJE SVEGA: preko GitHub MCP alata pročitaj samo ZADNJA 2 komentara issuea #1 u milja007/ritam (ne cijeli issue) i popis otvorenih PR-ova (s CI statusom). Još ne kloniraj repo i ne čitaj dokumente.
   - Zadnja poruka je Claudeova s CLAUDE_READY_FOR_REVIEW ili CLAUDE_FIXED (čeka se Codex) → STANI odmah, bez obavijesti.
   - Zadnja poruka je BORNA_DECISION_NEEDED, a Borna nije odgovorio (nema novog komentara iza nje) → STANI odmah, bez obavijesti.
   - Zadnja poruka je BLOCKED → jedna kratka obavijest Borni, stani.
   - Inače nastavi.
   Ako #1 ne možeš pročitati, obavijesti Bornu (BLOCKED) i stani.
2. Kloniraj repo s push pristupom (ako ne uspije, kratka poruka Borni i stani). git fetch origin --prune, git status.
3. Pročitaj AGENTS.md, CLAUDE.md (sekcija "Claude ↔ Codex: PR-first"), docs/PROGRESS.md (kratak, samo aktualno stanje; docs/PROGRESS-ARCHIVE.md ne čitaj, samo grep kad treba konkretan detalj) i docs/BUILD_PLAN.md; docs/CONCEPT.md samo kad počinješ novi korak. Strogo prati CLAUDE.md.
4. Postupi prema zadnjoj poruci u #1:
   - CODEX_CHANGES_REQUESTED → popravi samo navedene nalaze na istoj grani (s testovima), kontrole, push, komentar CLAUDE_FIXED s novim punim HEAD SHA u formatu iz #1, obavijesti Bornu i stani.
   - CODEX_APPROVED → ako je SHA točno HEAD otvorenog PR-a: ako je draft, prebaci ga u ready, pa ga spoji (merge commit, expectedHeadSha, bez force pusha). Ako Codex u istoj poruci kaže da ne počinješ novi rad, poštuj to. Ako se SHA ne poklapa, ne spajaj, javi u #1 i Borni i stani.
   - Bornin odgovor na BORNA_DECISION_NEEDED → zapiši odluku u PROGRESS.md i postupi po njoj.
5. Novi rad (samo kad nijedan PR ne čeka review): prvo otvoreni bug issueji s uređaja (osim #1), inače prvi korak u BUILD_PLAN.md koji nije [x]. Grana wip/korak-N (ili fix/…). Prije koda plan od 3–8 točaka na vrh docs/PROGRESS.md; pročitaj ga kao strogi recenzent (koncept, kriteriji gotovosti), ispravi, pa kreni. Samo taj jedan mali korak; jedan agent u isto vrijeme, bez paralelnih subagenata.
6. Commitaj i pushaj često na granu. Remote Supabase migracije ne primjenjuj prije CODEX_APPROVED.
7. Kad je korak gotov: npx tsc --noEmit, npx expo lint, npm test -- --runInBand, čist git status (+ test:supabase / expo install --check / export / simulator scenarij prema CLAUDE.md); GitHub Actions CI na PR-u mora biti zelen. Označi BUILD_PLAN, ažuriraj PROGRESS kratko (stari unosi na vrh docs/PROGRESS-ARCHIVE.md kad prijeđe ~5 KB), push, otvori ili ažuriraj DRAFT PR prema main, objavi u #1 handoff CLAUDE_READY_FOR_REVIEW (FROM, STATUS, SCOPE, BASE i HEAD puni SHA, PR, SUMMARY, CHECKS, DEVICE/EVIDENCE, RISKS/QUESTIONS, REQUEST). Ne tvrdi da je predano ako komentar nije stvarno objavljen.
8. Ako budžet ili kontekst ponestaje: stani na čistom mjestu, commit + push WIP na granu, u PROGRESS.md zapiši gdje si stao.
9. Ne mijenjaj koncept ni odluke — zapiši u PROGRESS.md pod "Pitanja za Bornu" i stavi BORNA_DECISION_NEEDED u #1. Nikad ne commitaj tajne ni API ključeve (ni u issue). Ne briši grane ni povijest, bez force pusha.
10. Na kraju (osim kad si stao u točki 1) pošalji Borni JEDNU kratku poruku na hrvatskom kao paket: što je napravljeno; pitanja za njega; 3–5 koraka za test na iPhoneu/simulatoru ako ih ima. Nakon handoffa dodaj: "Spremno za Codex review. HEAD je <SHA>, PR je <URL>. U Codexu pošalji: Provjeri najnoviji Claude handoff u Ritam issueu #1."
```

## Provjera prompta
- Samodostatan: nova sesija nema memoriju chata, sve upute su u promptu, `CLAUDE.md` i issueu #1.
- Jeftino kad nema posla: prvo samo zadnja 2 komentara u #1, bez kloniranja i dokumenata; stane bez obavijesti.
- PR-first: nema izravnog spajanja na `main`; merge samo uz `CODEX_APPROVED` za točan SHA; najviše jedan aktivni PR, a dok čeka review, Claude miruje.
- CI (GitHub Actions) radi determinističke provjere, pa ih modeli ne moraju ponavljati.
- Pokriva nestanak kredita: česti push, WIP grana i bilješka u `PROGRESS.md`.
- Ništa nepovratno: ne briše grane ni povijest, bez force pusha, ne mijenja koncept, bez tajni; remote migracije tek nakon reviewa.
