/**
 * Tipovi zahtjeva i odgovora za Supabase Edge Functions (koraci 21 i 22).
 * Koriste se s obje strane: app šalje zahtjev, Edge Function vraća odgovor.
 * Nema runtime logike — samo TypeScript tipovi i stroge konstante.
 */

// ---------------------------------------------------------------------------
// Korak 21 — parse-input: slobodan tekst → blokovi
// ---------------------------------------------------------------------------

/** Zahtjev za parse-input Edge Function. */
export type ParseInputRequest = {
  /** Slobodan tekst (npr. "15:00 sastanak s timom, traje sat"). */
  text: string;
  /** Jezik teksta — utječe na sistemski prompt. */
  locale: 'hr' | 'en';
};

/** Pojedinačni blok koji je LLM prepoznao iz teksta. */
export type ParsedBlock = {
  /** Naziv aktivnosti. */
  title: string;
  /** Početak u formatu "HH:MM" ako je prepoznat, inače `null`. */
  start: string | null;
  /** Kraj u formatu "HH:MM" ako je prepoznat, inače `null`. */
  end: string | null;
  /** Trajanje u minutama ako je prepoznato, inače `null`. */
  durationMinutes: number | null;
  /** Grubo doba dana ako je prepoznato, inače `null`. */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
};

/** Odgovor parse-input Edge Functiona. */
export type ParseInputResponse = {
  blocks: ParsedBlock[];
};

// ---------------------------------------------------------------------------
// Korak 22 — plan-day: planiraj sutra
// ---------------------------------------------------------------------------

/** Prioritet koji korisnik ručno unosi (tekst ili blok s trajanjem). */
export type DayPriority = {
  title: string;
  durationMinutes: number | null;
  fixedStart: string | null; // "HH:MM"
  important: boolean;
};

/** Zahtjev za plan-day Edge Function. */
export type PlanDayRequest = {
  /**
   * Datum za koji se planira (ISO, "YYYY-MM-DD").
   * Obično sutrašnji dan (večernji upit pita "što imaš sutra").
   */
  date: string;
  /** Prioriteti koje korisnik nabroji (ručno ili glasom → parse-input). */
  priorities: DayPriority[];
  /**
   * Dostupni prozori: kad korisnik nije fiksno zauzet.
   * Format: `[{ start: "HH:MM", end: "HH:MM" }, ...]`
   */
  freeWindows: { start: string; end: string }[];
  /**
   * Postavke rasporeda: doba dana kad korisnik voli što raditi,
   * dužina fokus-bloka, pauze, itd.
   * Za MVP: `null` → LLM koristi razumne zadane vrijednosti.
   */
  preferences: PlanPreferences | null;
};

export type PlanPreferences = {
  /**
   * Preferirana "energija" po dobu dana:
   * - `high` = zahtjevni zadaci (fokus, kreativnost)
   * - `low` = lagani zadaci (admin, mejlovi)
   */
  morningEnergy: 'high' | 'low';
  afternoonEnergy: 'high' | 'low';
  eveningEnergy: 'high' | 'low';
  /** Koliko dugo želi raditi bez pauze (minuta). Zadano: 90. */
  focusBlockMinutes: number;
  /** Duljina pauze između fokus-blokova (minuta). Zadano: 15. */
  breakMinutes: number;
};

/** Planirani blok koji LLM vraća. */
export type PlannedBlock = {
  title: string;
  /** Početak u formatu "HH:MM". */
  start: string;
  /** Kraj u formatu "HH:MM". */
  end: string;
  /**
   * Je li blok fiksno dodan (npr. iz Google Calendara ili korisnikove
   * zabrane) ili LLM-ov prijedlog.
   */
  kind: 'fixed' | 'suggestion';
};

/** Odgovor plan-day Edge Functiona. */
export type PlanDayResponse = {
  /** Predloženi raspored za taj dan. Korisnik ga mora odobriti. */
  schedule: PlannedBlock[];
  /**
   * Pitanja koja LLM mora razjasniti s korisnikom prije nego što plan
   * postane konačan (0–3 pitanja). Prazno = plan je dovoljno potpun.
   * Npr.: "Koliko dugo traje priprema za prezentaciju?"
   */
  questions: string[];
  /**
   * Tekst kratkog sažetka koji app prikazuje korisniku ispred plana.
   * Na jeziku `locale` iz zahtjeva.
   */
  summary: string;
};
