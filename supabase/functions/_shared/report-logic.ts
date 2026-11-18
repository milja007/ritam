/**
 * write-report — čista logika dnevne (korak 31) i tjedne (korak 31c) dijagnoze s LLM-om.
 *
 * Bez Deno API-ja i bez uvoza, da je testira Jest u appu (`src/core/diagnosis/report-logic.test.ts`).
 * Prompt je verzioniran ovdje (`DAY_REPORT_PROMPT_VERSION`): svaka promjena teksta upute ili oblika
 * odgovora dobiva novu verziju, a app je sprema uz dijagnozu.
 *
 * Podjela posla: brojke („Napredak“) i trend računa app lokalno i ne mijenjaju se; model piše
 * riječi — Ukratko, Pohvale, Što smo primijetili, Veliki problemi, Ideje za napredak.
 */

export const DAY_REPORT_PROMPT_VERSION = 'llm-day-v1';

export type ReportLocale = 'hr' | 'en';
export type ReportTrend = 'better' | 'same' | 'worse' | 'first';

export type ReportItemComment = { title: string; outcome: 'partial' | 'not'; comment: string };
export type ReportBrokenRule = { title: string; weight: number; trigger: string | null };

/** Sve činjenice jednog dana (iz lokalne statistike `DayStats`). */
export type ReportDay = {
  date: string;
  /** Dnevni rezultat 0–100 ili `null` (nije zaključen). */
  score: number | null;
  plan: { total: number; done: number; partial: number; missed: number; moved: number };
  comments: ReportItemComment[];
  /** Djelomično / nije odrađeni blokovi s početkom (uzorci po dobu dana). */
  misses: { title: string; start: string }[];
  rules: { active: number; kept: number; broken: ReportBrokenRule[] };
  sleep: { minutes: number; onTarget: boolean | null; deviationMinutes: number | null } | null;
  xp: number;
  /** Ocjena dana 1–5 ili `null`. */
  rating: number | null;
  note: string | null;
  streak: number;
  gaveUp: boolean;
  gaveUpNote: string | null;
  /** Trackeri (korak 31b): samo uključeni i s unosima tog dana; stari klijent bez polja → `null`. */
  calories: { total: number; goal: number } | null;
  /** Potrošnja dana i dnevni dio limita, u centima. */
  money: { spentCents: number; dailyBudgetCents: number } | null;
};

/** Kratak trag ranijeg dana — za uzorke („tri utorka zaredom umoran“). */
export type ReportHistoryDay = {
  date: string;
  score: number | null;
  rating: number | null;
  comments: ReportItemComment[];
  broken: ReportBrokenRule[];
};

/** Ranija dijagnoza s povratnom informacijom — prati je li prošli savjet upalio. */
export type ReportPrevious = {
  date: string;
  summary: string;
  ideas: string[];
  helpful: boolean | null;
  comment: string | null;
  /** Odgovor na ponuđenu promjenu („Probat ću“ / „Ne sada“), `null` bez odgovora. */
  suggestionAccepted: boolean | null;
};

export type WriteReportRequest = {
  date: string;
  locale: ReportLocale;
  /** Trend iz lokalne dijagnoze (rezultat naspram jučer). */
  trend: ReportTrend;
  today: ReportDay;
  yesterday: ReportDay | null;
  history: ReportHistoryDay[];
  previous: ReportPrevious[];
};

export type WriteReportText = {
  version: typeof DAY_REPORT_PROMPT_VERSION;
  summary: string;
  praise: string[];
  noticed: string[];
  problems: string[];
  ideas: string[];
};

/** Granice ulaza (prompt ostaje kratak) i izlaza (dan se čita za 30 s). */
export const REPORT_LIMITS = {
  title: 200,
  comment: 500,
  note: 600,
  comments: 12,
  misses: 12,
  broken: 10,
  history: 14,
  historyComments: 3,
  previous: 5,
  previousIdeas: 3,
  line: 280,
  summary: 240,
  praise: 3,
  noticed: 3,
  problems: 2,
  ideas: 2,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TRENDS: readonly ReportTrend[] = ['better', 'same', 'worse', 'first'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** Tekst bez suvišnih razmaka; predug se skrati (ulaz), prazan → `null`. */
const clip = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
};

const list = <T>(raw: unknown, max: number, item: (value: unknown) => T | null): T[] =>
  Array.isArray(raw) ? raw.map(item).filter((value): value is T => value !== null).slice(0, max) : [];

function parseComment(raw: unknown): ReportItemComment | null {
  if (!isRecord(raw)) return null;
  const title = clip(raw.title, REPORT_LIMITS.title);
  const comment = clip(raw.comment, REPORT_LIMITS.comment);
  if (title === null || comment === null || (raw.outcome !== 'partial' && raw.outcome !== 'not')) return null;
  return { title, outcome: raw.outcome, comment };
}

function parseBroken(raw: unknown): ReportBrokenRule | null {
  if (!isRecord(raw)) return null;
  const title = clip(raw.title, REPORT_LIMITS.title);
  if (title === null || !isInt(raw.weight, 1, 3)) return null;
  return { title, weight: raw.weight, trigger: clip(raw.trigger, REPORT_LIMITS.comment) };
}

const parseScore = (raw: unknown): number | null | undefined =>
  raw === null || raw === undefined ? null : isInt(raw, 0, 100) ? raw : undefined;
const parseRating = (raw: unknown): number | null | undefined =>
  raw === null || raw === undefined ? null : isInt(raw, 1, 5) ? raw : undefined;

function parseDay(raw: unknown): ReportDay | null {
  if (!isRecord(raw) || !isDate(raw.date) || !isRecord(raw.plan) || !isRecord(raw.rules)) return null;
  const score = parseScore(raw.score);
  const rating = parseRating(raw.rating);
  if (score === undefined || rating === undefined) return null;
  const count = (value: unknown) => isInt(value, 0, 500);
  const { plan, rules } = raw;
  if (![plan.total, plan.done, plan.partial, plan.missed, plan.moved].every(count)) return null;
  if (!count(rules.active) || !count(rules.kept)) return null;
  if (!isInt(raw.xp, 0, 100_000) || !isInt(raw.streak, 0, 100_000)) return null;
  let sleep: ReportDay['sleep'] = null;
  if (raw.sleep !== null && raw.sleep !== undefined) {
    const s = raw.sleep;
    if (!isRecord(s) || !isInt(s.minutes, 0, 24 * 60)) return null;
    const onTarget = typeof s.onTarget === 'boolean' ? s.onTarget : null;
    const deviation = isInt(s.deviationMinutes, -24 * 60, 24 * 60) ? s.deviationMinutes : null;
    sleep = { minutes: s.minutes, onTarget, deviationMinutes: deviation };
  }
  return {
    date: raw.date,
    score,
    plan: {
      total: plan.total as number,
      done: plan.done as number,
      partial: plan.partial as number,
      missed: plan.missed as number,
      moved: plan.moved as number,
    },
    comments: list(raw.comments, REPORT_LIMITS.comments, parseComment),
    misses: list(raw.misses, REPORT_LIMITS.misses, (value) => {
      if (!isRecord(value)) return null;
      const title = clip(value.title, REPORT_LIMITS.title);
      return title !== null && typeof value.start === 'string' && /^\d{2}:\d{2}$/.test(value.start)
        ? { title, start: value.start }
        : null;
    }),
    rules: {
      active: rules.active as number,
      kept: rules.kept as number,
      broken: list(rules.broken, REPORT_LIMITS.broken, parseBroken),
    },
    sleep,
    xp: raw.xp,
    rating,
    note: clip(raw.note, REPORT_LIMITS.note),
    streak: raw.streak,
    gaveUp: raw.gaveUp === true,
    gaveUpNote: clip(raw.gaveUpNote, REPORT_LIMITS.note),
    calories:
      isRecord(raw.calories) && isInt(raw.calories.total, 0, 100_000) && isInt(raw.calories.goal, 1, 10_000)
        ? { total: raw.calories.total, goal: raw.calories.goal }
        : null,
    money:
      isRecord(raw.money) &&
      isInt(raw.money.spentCents, 0, 1_000_000_000) &&
      isInt(raw.money.dailyBudgetCents, 0, 1_000_000_000)
        ? { spentCents: raw.money.spentCents, dailyBudgetCents: raw.money.dailyBudgetCents }
        : null,
  };
}

function parseHistoryDay(raw: unknown): ReportHistoryDay | null {
  if (!isRecord(raw) || !isDate(raw.date)) return null;
  const score = parseScore(raw.score);
  const rating = parseRating(raw.rating);
  if (score === undefined || rating === undefined) return null;
  return {
    date: raw.date,
    score,
    rating,
    comments: list(raw.comments, REPORT_LIMITS.historyComments, parseComment),
    broken: list(raw.broken, REPORT_LIMITS.historyComments, parseBroken),
  };
}

function parsePrevious(raw: unknown): ReportPrevious | null {
  if (!isRecord(raw) || !isDate(raw.date)) return null;
  const summary = clip(raw.summary, REPORT_LIMITS.line);
  if (summary === null) return null;
  const bool = (value: unknown) => (typeof value === 'boolean' ? value : null);
  return {
    date: raw.date,
    summary,
    ideas: list(raw.ideas, REPORT_LIMITS.previousIdeas, (value) => clip(value, REPORT_LIMITS.line)),
    helpful: bool(raw.helpful),
    comment: clip(raw.comment, REPORT_LIMITS.comment),
    suggestionAccepted: bool(raw.suggestionAccepted),
  };
}

/**
 * Zahtjev iz appa, provjeren. `null` kad nedostaje nešto bez čega dijagnoze nema (datum, danas,
 * trend); nevaljane stavke popisa samo otpadaju. Povijest i ranije dijagnoze moraju biti prije
 * dana dijagnoze (budućnost ne ulazi u kontekst).
 */
export function parseWriteReportRequest(raw: unknown): WriteReportRequest | null {
  if (!isRecord(raw) || !isDate(raw.date)) return null;
  const trend = TRENDS.find((value) => value === raw.trend);
  const today = parseDay(raw.today);
  if (trend === undefined || today === null || today.date !== raw.date) return null;
  const date = raw.date;
  const yesterday = raw.yesterday === null || raw.yesterday === undefined ? null : parseDay(raw.yesterday);
  const before = <T extends { date: string }>(items: T[]) => items.filter((item) => item.date < date);
  return {
    date,
    locale: raw.locale === 'en' ? 'en' : 'hr',
    trend,
    today,
    yesterday: yesterday !== null && yesterday.date < date ? yesterday : null,
    history: before(list(raw.history, REPORT_LIMITS.history, parseHistoryDay)),
    previous: before(list(raw.previous, REPORT_LIMITS.previous, parsePrevious)),
  };
}

// ---------------------------------------------------------------------------
// Prompt (llm-day-v1)
// ---------------------------------------------------------------------------

const LANGUAGE: Record<ReportLocale, string> = { hr: 'hrvatskom', en: 'engleskom' };

/** Sistemska uputa: ton i struktura iz koncepta (sekcija „Dijagnoze“). */
export function buildReportSystemPrompt(locale: ReportLocale): string {
  return `\
Ti si iskren i topao osobni trener u appu Ritam. Pišeš DNEVNU dijagnozu korisnikova dana.
Ton: kao dobar trener — iskren, topao, konkretan. Prvo činjenice, pa tumačenje. Svaka kritika ima ideju što napraviti. Bez posramljivanja, bez osude, bez uljepšavanja. Nikad crveno, nikad kazna: neodrađeno je informacija, ne neuspjeh.
Dan se čita za 30 sekundi: kratke rečenice, obraćaš se korisniku s "ti".

Brojke ("Napredak") app prikazuje sam — ne ponavljaj ih sve, koristi ih samo kad nešto znače.
Napiši, uvijek ovim redom:
1. summary — JEDNA rečenica: kakav je bio dan i kamo ide trend (trend ti je zadan, ne mijenjaj ga).
2. praise — 0–${REPORT_LIMITS.praise} pohvale: što je išlo super i neka tako ostane. Samo stvarne, iz podataka.
3. noticed — 0–${REPORT_LIMITS.noticed} uzorka i mogući uzroci, psihološki pogled (kad padaš, što te diže, što pomaže). Komentari korisnika postaju uvidi: ako se ista riječ ili razlog ponavlja kroz povijest (npr. "umoran" tri utorka zaredom), reci to.
4. problems — 0–${REPORT_LIMITS.problems} velika problema: iskreno i objektivno, ali nikad bezobrazno. Ako ih nema, prazan popis.
5. ideas — 1–${REPORT_LIMITS.ideas} konkretna mala koraka za sutra. Malo po malo: radije jedna ideja koja će se stvarno dogoditi nego tri.

Prethodne dijagnoze: pogledaj je li prošli savjet upalio. Ako je korisnik rekao "Nije pomoglo" ili napisao zašto, ne ponavljaj isti savjet — probaj drukčiji pristup. Ako je "Pomoglo", možeš ga potvrditi. Prijedlog odbijen s "Ne sada" ne nudi ponovo.
Ako je korisnik odustao od dana ("Odustajem"), budi posebno blag: bez prijekora, fokus na to da sutra krene lakše.
Ne izmišljaj podatke koji nisu dani. Ne spominji da si AI, model ili app.
Svaki redak najviše ${REPORT_LIMITS.line} znakova, summary najviše ${REPORT_LIMITS.summary}.
Piši na ${LANGUAGE[locale]} jeziku.

Vrati SAMO JSON objekt (bez markdowna):
{"summary":"...","praise":["..."],"noticed":["..."],"problems":["..."],"ideas":["..."]}`;
}

const TREND_TEXT: Record<ReportTrend, string> = {
  better: 'bolje nego jučer',
  same: 'otprilike isto kao jučer',
  worse: 'lošije nego jučer',
  first: 'nema usporedbe (prvi dan ili jučer nije zaključen)',
};

const WEEKDAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];

/** Dan u tjednu iz datuma (UTC podne — bez pomaka zone). */
export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? '';
}

const minutesText = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
const outcomeText = (outcome: ReportItemComment['outcome']) => (outcome === 'partial' ? 'djelomično' : 'nije');
const quote = (value: string) => `"${value.replace(/"/g, "'")}"`;

function dayLines(day: ReportDay): string[] {
  const lines: string[] = [];
  lines.push(`Rezultat: ${day.score === null ? 'nije zaključen' : `${day.score}/100`}`);
  const p = day.plan;
  lines.push(
    `Plan: ${p.total} aktivnosti — odrađeno ${p.done}, djelomično ${p.partial}, neodrađeno ${p.missed} (od toga premješteno ${p.moved})`,
  );
  for (const miss of day.misses) lines.push(`- propušteno/djelomično: ${quote(miss.title)} u ${miss.start}`);
  for (const c of day.comments) lines.push(`- komentar (${outcomeText(c.outcome)}) ${quote(c.title)}: ${quote(c.comment)}`);
  lines.push(`Zabrane: vrijedilo ${day.rules.active}, poštovano ${day.rules.kept}`);
  for (const rule of day.rules.broken) {
    lines.push(
      `- prekršena ${quote(rule.title)} (težina ${rule.weight}/3)${rule.trigger ? `, okidač: ${quote(rule.trigger)}` : ''}`,
    );
  }
  if (day.sleep !== null) {
    const target =
      day.sleep.onTarget === null
        ? ''
        : day.sleep.onTarget
          ? ', u krevet na vrijeme'
          : `, u krevet ${day.sleep.deviationMinutes ?? '?'} min od cilja`;
    lines.push(`San: ${minutesText(day.sleep.minutes)}${target}`);
  } else {
    lines.push('San: nije zapisan');
  }
  if (day.calories !== null) lines.push(`Kalorije: ${day.calories.total} kcal (cilj ${day.calories.goal})`);
  if (day.money !== null) {
    const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`;
    lines.push(`Potrošnja: ${euro(day.money.spentCents)} (dnevni dio limita ${euro(day.money.dailyBudgetCents)})`);
  }
  lines.push(`XP: ${day.xp} · niz: ${day.streak} dana · ocjena dana: ${day.rating === null ? '—' : `${day.rating}/5`}`);
  if (day.note !== null) lines.push(`Bilješka korisnika: ${quote(day.note)}`);
  if (day.gaveUp) lines.push(`Odustao od dana${day.gaveUpNote ? `: ${quote(day.gaveUpNote)}` : ''}`);
  return lines;
}

/** Korisnička poruka: činjenice dana, jučer, povijest i ranije dijagnoze. */
export function buildReportUserMessage(req: WriteReportRequest): string {
  const lines: string[] = [];
  lines.push(`Dijagnoza za ${req.date} (${weekdayOf(req.date)}). Trend: ${TREND_TEXT[req.trend]}.`);
  lines.push('', 'DANAS', ...dayLines(req.today));
  if (req.yesterday !== null) lines.push('', `JUČER (${req.yesterday.date})`, ...dayLines(req.yesterday));
  if (req.history.length > 0) {
    lines.push('', 'RANIJI DANI (za uzorke)');
    for (const day of req.history) {
      const parts = [
        `${day.date} (${weekdayOf(day.date)})`,
        `rezultat ${day.score ?? '—'}`,
        `ocjena ${day.rating ?? '—'}`,
        ...day.comments.map((c) => `${quote(c.title)} ${outcomeText(c.outcome)}: ${quote(c.comment)}`),
        ...day.broken.map((rule) => `prekršena ${quote(rule.title)}${rule.trigger ? ` (${quote(rule.trigger)})` : ''}`),
      ];
      lines.push(`- ${parts.join('; ')}`);
    }
  }
  if (req.previous.length > 0) {
    lines.push('', 'PRETHODNE DIJAGNOZE (je li savjet upalio?)');
    for (const prev of req.previous) {
      const feedback =
        prev.helpful === null ? 'bez odgovora' : prev.helpful ? 'korisnik: Pomoglo' : 'korisnik: Nije pomoglo';
      const accepted =
        prev.suggestionAccepted === null ? '' : prev.suggestionAccepted ? '; prijedlog: Probat ću' : '; prijedlog: Ne sada';
      lines.push(`- ${prev.date}: ${quote(prev.summary)}`);
      if (prev.ideas.length > 0) lines.push(`  ideje: ${prev.ideas.map(quote).join(' | ')}`);
      lines.push(`  ${feedback}${prev.comment ? ` — ${quote(prev.comment)}` : ''}${accepted}`);
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Odgovor modela
// ---------------------------------------------------------------------------

function readLines(raw: unknown, max: number): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const lines: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') return null;
    const line = value.replace(/\s+/g, ' ').trim();
    if (line.length === 0) continue;
    if (line.length > REPORT_LIMITS.line) return null;
    lines.push(line);
  }
  return lines.slice(0, max);
}

/**
 * Odgovor modela kao tekst dijagnoze, ali samo ako drži oblik: summary jedna rečenica do
 * granice, popisi nizova kratkih redaka, barem jedna ideja. Prazni retci otpadaju, višak se
 * reže; predug redak ili krivi tip → `null` (app ostaje na lokalnoj dijagnozi).
 */
export function acceptModelReport(raw: string): WriteReportText | null {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  return readReportText(parsed);
}

/** Provjera već raspakiranog teksta (isto za odgovor modela i odgovor funkcije u appu). */
export function readReportText(parsed: unknown): WriteReportText | null {
  if (!isRecord(parsed) || typeof parsed.summary !== 'string') return null;
  const summary = parsed.summary.replace(/\s+/g, ' ').trim();
  if (summary.length === 0 || summary.length > REPORT_LIMITS.summary) return null;
  const praise = readLines(parsed.praise, REPORT_LIMITS.praise);
  const noticed = readLines(parsed.noticed, REPORT_LIMITS.noticed);
  const problems = readLines(parsed.problems, REPORT_LIMITS.problems);
  const ideas = readLines(parsed.ideas, REPORT_LIMITS.ideas);
  if (praise === null || noticed === null || problems === null || ideas === null || ideas.length === 0) return null;
  return { version: DAY_REPORT_PROMPT_VERSION, summary, praise, noticed, problems, ideas };
}

// ===========================================================================
// Tjedna dijagnoza riječima (korak 31c, prompt llm-week-v1)
// ===========================================================================

/**
 * Tjedna dijagnoza: brojke („Napredak“), trend i **promjenu tjedna** bira app lokalno (najviše
 * jedna nova promjena tjedno, „Probat ću / Ne sada“, odbijena se ne nudi dva tjedna). Model piše
 * Ukratko, Pohvale, Što smo primijetili, Velike probleme i jednu rečenicu zašto baš ta promjena.
 */
export const WEEK_REPORT_PROMPT_VERSION = 'llm-week-v1';

export type ReportRuleSummary = { title: string; weight: number; broken: number; triggers: string[] };

/** Statistika tjedna (iz lokalne `PeriodStats`). */
export type ReportWeek = {
  start: string;
  end: string;
  /** Zaključeni dani 0–7. */
  recorded: number;
  average: number | null;
  best: { date: string; score: number } | null;
  worst: { date: string; score: number } | null;
  plan: { total: number; done: number; partial: number; missed: number; moved: number };
  rules: { active: number; kept: number; broken: number; byRule: ReportRuleSummary[] };
  sleep: { nights: number; averageMinutes: number; shortNights: number; onTarget: number; withTarget: number } | null;
  xp: number;
  /** Prosječna ocjena dana 1–5 (jedna decimala) ili `null`. */
  rating: number | null;
  gaveUpDays: number;
  misses: { morning: number; afternoon: number; evening: number };
  repeatedMisses: { title: string; count: number }[];
  calories: { days: number; within: number; over: number; under: number } | null;
  money: { days: number; spentCents: number; budgetCents: number; overDays: number } | null;
};

/** Promjena tjedna koju je odabrala lokalna logika (tekst na jeziku appa). */
export type ReportWeekIdea = {
  text: string;
  /** Prenesena prihvaćena promjena (još nije stabilna) — ne nudi se nova. */
  carried: boolean;
};

export type WriteWeekReportRequest = {
  period: 'week';
  /** Ponedjeljak tjedna. */
  start: string;
  locale: ReportLocale;
  trend: ReportTrend;
  /** Niz boljih tjedana zaključno s ovim. */
  betterWeeks: number;
  week: ReportWeek;
  previousWeek: ReportWeek | null;
  /** Dani tjedna ukratko (rezultat, ocjena, komentari, prekršaji) — za uzorke po danu. */
  days: ReportHistoryDay[];
  /** `null` = „zadrži ritam“ (nema promjene). */
  idea: ReportWeekIdea | null;
  /** Ranije tjedne dijagnoze (`date` = ponedjeljak) s odgovorom Pomoglo / Nije pomoglo. */
  previous: ReportPrevious[];
};

export type WriteWeekReportText = {
  version: typeof WEEK_REPORT_PROMPT_VERSION;
  summary: string;
  praise: string[];
  noticed: string[];
  problems: string[];
  /** Jedna rečenica: zašto baš ova promjena (ili zašto zadržati ritam); `null` bez nje. */
  ideaWhy: string | null;
};

export const WEEK_REPORT_LIMITS = {
  byRule: 6,
  triggers: 3,
  repeated: 5,
  previous: 4,
  idea: 400,
} as const;

const nonNegative = (value: unknown, max: number) => isInt(value, 0, max);

function parseDated(raw: unknown): { date: string; score: number } | null {
  return isRecord(raw) && isDate(raw.date) && isInt(raw.score, 0, 100) ? { date: raw.date, score: raw.score } : null;
}

function parseWeek(raw: unknown, maxDays = 7): ReportWeek | null {
  if (!isRecord(raw) || !isDate(raw.start) || !isDate(raw.end) || raw.end < raw.start) return null;
  if (!isRecord(raw.plan) || !isRecord(raw.rules) || !isRecord(raw.misses)) return null;
  const { plan, rules, misses } = raw;
  // Godina ima i više od 5000 blokova — granica raste s duljinom razdoblja (tjedan i mjesec ostaju 5000).
  const count = (value: unknown) => nonNegative(value, Math.max(5000, maxDays * 50));
  if (!isInt(raw.recorded, 0, maxDays)) return null;
  if (![plan.total, plan.done, plan.partial, plan.missed, plan.moved].every(count)) return null;
  if (![rules.active, rules.kept, rules.broken].every(count)) return null;
  if (![misses.morning, misses.afternoon, misses.evening].every(count)) return null;
  if (!nonNegative(raw.xp, 1_000_000) || !isInt(raw.gaveUpDays, 0, maxDays)) return null;
  const average = parseScore(raw.average);
  if (average === undefined) return null;
  let sleep: ReportWeek['sleep'] = null;
  if (raw.sleep !== null && raw.sleep !== undefined) {
    const s = raw.sleep;
    if (
      !isRecord(s) ||
      !isInt(s.nights, 0, maxDays) ||
      !isInt(s.averageMinutes, 0, 24 * 60) ||
      !isInt(s.shortNights, 0, maxDays) ||
      !isInt(s.onTarget, 0, maxDays) ||
      !isInt(s.withTarget, 0, maxDays)
    ) {
      return null;
    }
    sleep = {
      nights: s.nights,
      averageMinutes: s.averageMinutes,
      shortNights: s.shortNights,
      onTarget: s.onTarget,
      withTarget: s.withTarget,
    };
  }
  const rating =
    typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5 ? Math.round(raw.rating * 10) / 10 : null;
  const c = raw.calories;
  const m = raw.money;
  return {
    start: raw.start,
    end: raw.end,
    recorded: raw.recorded,
    average,
    best: parseDated(raw.best),
    worst: parseDated(raw.worst),
    plan: {
      total: plan.total as number,
      done: plan.done as number,
      partial: plan.partial as number,
      missed: plan.missed as number,
      moved: plan.moved as number,
    },
    rules: {
      active: rules.active as number,
      kept: rules.kept as number,
      broken: rules.broken as number,
      byRule: list(rules.byRule, WEEK_REPORT_LIMITS.byRule, (value) => {
        if (!isRecord(value)) return null;
        const title = clip(value.title, REPORT_LIMITS.title);
        if (title === null || !isInt(value.weight, 1, 3) || !isInt(value.broken, 1, maxDays)) return null;
        return {
          title,
          weight: value.weight,
          broken: value.broken,
          triggers: list(value.triggers, WEEK_REPORT_LIMITS.triggers, (t) => clip(t, REPORT_LIMITS.comment)),
        };
      }),
    },
    sleep,
    xp: raw.xp,
    rating,
    gaveUpDays: raw.gaveUpDays,
    misses: { morning: misses.morning as number, afternoon: misses.afternoon as number, evening: misses.evening as number },
    repeatedMisses: list(raw.repeatedMisses, WEEK_REPORT_LIMITS.repeated, (value) => {
      if (!isRecord(value)) return null;
      const title = clip(value.title, REPORT_LIMITS.title);
      return title !== null && isInt(value.count, 2, Math.max(50, maxDays)) ? { title, count: value.count } : null;
    }),
    calories:
      isRecord(c) && isInt(c.days, 1, maxDays) && [c.within, c.over, c.under].every((v) => isInt(v, 0, maxDays))
        ? { days: c.days, within: c.within as number, over: c.over as number, under: c.under as number }
        : null,
    money:
      isRecord(m) &&
      isInt(m.days, 1, maxDays) &&
      isInt(m.spentCents, 0, 1_000_000_000) &&
      isInt(m.budgetCents, 0, 1_000_000_000) &&
      isInt(m.overDays, 0, maxDays)
        ? { days: m.days, spentCents: m.spentCents, budgetCents: m.budgetCents, overDays: m.overDays }
        : null,
  };
}

/**
 * Zahtjev za tjednu dijagnozu, provjeren. `null` bez valjanog tjedna (ponedjeljak, statistika
 * tog tjedna) ili trenda; dani izvan tjedna, prošli tjedan koji nije prije, ranije dijagnoze
 * koje nisu prije i nevaljane stavke otpadaju.
 */
export function parseWriteWeekReportRequest(raw: unknown): WriteWeekReportRequest | null {
  if (!isRecord(raw) || raw.period !== 'week' || !isDate(raw.start)) return null;
  if (new Date(`${raw.start}T12:00:00Z`).getUTCDay() !== 1) return null;
  const start = raw.start;
  const trend = TRENDS.find((value) => value === raw.trend);
  const week = parseWeek(raw.week);
  if (trend === undefined || week === null || week.start !== start) return null;
  const previousWeek = raw.previousWeek === null || raw.previousWeek === undefined ? null : parseWeek(raw.previousWeek);
  const ideaText = isRecord(raw.idea) ? clip(raw.idea.text, WEEK_REPORT_LIMITS.idea) : null;
  return {
    period: 'week',
    start,
    locale: raw.locale === 'en' ? 'en' : 'hr',
    trend,
    betterWeeks: isInt(raw.betterWeeks, 0, 1000) ? raw.betterWeeks : 0,
    week,
    previousWeek: previousWeek !== null && previousWeek.end < start ? previousWeek : null,
    days: list(raw.days, 7, parseHistoryDay).filter((day) => day.date >= week.start && day.date <= week.end),
    idea:
      ideaText === null
        ? null
        : { text: ideaText, carried: isRecord(raw.idea) && raw.idea.carried === true },
    previous: list(raw.previous, WEEK_REPORT_LIMITS.previous, parsePrevious).filter((prev) => prev.date < start),
  };
}

/** Sistemska uputa tjedne dijagnoze: isti ton i red sekcija, promjenu tjedna ne bira model. */
export function buildWeekReportSystemPrompt(locale: ReportLocale): string {
  return `\
Ti si iskren i topao osobni trener u appu Ritam. Pišeš TJEDNU dijagnozu korisnikova tjedna.
Ton: kao dobar trener — iskren, topao, konkretan. Prvo činjenice, pa tumačenje. Svaka kritika ima ideju što napraviti. Bez posramljivanja, bez osude, bez uljepšavanja. Nikad kazna: neodrađeno je informacija, ne neuspjeh.
Čita se za minutu: kratke rečenice, obraćaš se korisniku s "ti".

Brojke ("Napredak") app prikazuje sam — koristi ih samo kad nešto znače.
Napiši, uvijek ovim redom:
1. summary — JEDNA rečenica: kakav je bio tjedan i kamo ide trend (trend ti je zadan, ne mijenjaj ga).
2. praise — 0–${REPORT_LIMITS.praise} pohvale: što je išlo super i neka tako ostane. Samo stvarne, iz podataka.
3. noticed — 0–${REPORT_LIMITS.noticed} uzorka kroz tjedan i mogući uzroci, psihološki pogled: koji dani ili doba dana padaju, što te diže, što pomaže. Komentari korisnika postaju uvidi ako se razlog ponavlja. Ako su trackeri (kalorije, potrošnja) dani, poveži ih s ostalim kad ima smisla.
4. problems — 0–${REPORT_LIMITS.problems} velika problema: iskreno i objektivno, ali nikad bezobrazno. Ako ih nema, prazan popis.
5. ideaWhy — JEDNA rečenica zašto je baš PROMJENA TJEDNA (zadana ti je) dobar sljedeći korak, iz podataka ovog tjedna. Promjenu NE mijenjaj, ne predlaži drugu ni dodatnu: malo po malo, najviše jedna nova promjena tjedno. Ako promjene nema ("zadrži ritam"), reci zašto je dobro zadržati ritam. Ako je promjena prenesena (već prihvaćena, još nije stabilna), ohrabri da je drži.

Prethodne tjedne dijagnoze: pogledaj je li prošli savjet upalio. Ako je korisnik rekao "Nije pomoglo", ne hvali isti pristup — priznaj to i budi konkretniji. Prijedlog odbijen s "Ne sada" ne spominji kao obavezu.
Ne izmišljaj podatke koji nisu dani. Ne spominji da si AI, model ili app.
Svaki redak najviše ${REPORT_LIMITS.line} znakova, summary najviše ${REPORT_LIMITS.summary}.
Piši na ${LANGUAGE[locale]} jeziku.

Vrati SAMO JSON objekt (bez markdowna):
{"summary":"...","praise":["..."],"noticed":["..."],"problems":["..."],"ideaWhy":"..."}`;
}

const WEEK_TREND_TEXT: Record<ReportTrend, string> = {
  better: 'bolje nego prošli tjedan',
  same: 'otprilike isto kao prošli tjedan',
  worse: 'lošije nego prošli tjedan',
  first: 'nema usporedbe (prvi tjedan ili prošli nema zaključenih dana)',
};

const euroText = (cents: number) => `${(cents / 100).toFixed(2)} €`;

function weekLines(week: ReportWeek, length = 7): string[] {
  const lines: string[] = [];
  lines.push(`Zaključeni dani: ${week.recorded}/${length} · prosjek ${week.average === null ? '—' : `${week.average}/100`}`);
  if (week.best !== null) lines.push(`Najbolji dan: ${week.best.date} (${weekdayOf(week.best.date)}) ${week.best.score}`);
  if (week.worst !== null) lines.push(`Najslabiji dan: ${week.worst.date} (${weekdayOf(week.worst.date)}) ${week.worst.score}`);
  const p = week.plan;
  lines.push(
    `Plan: ${p.total} aktivnosti — odrađeno ${p.done}, djelomično ${p.partial}, neodrađeno ${p.missed} (premješteno ${p.moved})`,
  );
  lines.push(
    `Propušteno po dobu dana: jutro ${week.misses.morning}, popodne ${week.misses.afternoon}, večer ${week.misses.evening}`,
  );
  for (const miss of week.repeatedMisses) lines.push(`- ponavlja se propust: ${quote(miss.title)} ${miss.count}×`);
  lines.push(`Zabrane: vrijedilo ${week.rules.active}, poštovano ${week.rules.kept}, prekršeno ${week.rules.broken}`);
  for (const rule of week.rules.byRule) {
    const triggers = rule.triggers.length > 0 ? `, okidači: ${rule.triggers.map(quote).join(', ')}` : '';
    lines.push(`- ${quote(rule.title)} (težina ${rule.weight}/3) prekršena ${rule.broken}×${triggers}`);
  }
  if (week.sleep !== null) {
    const s = week.sleep;
    const target = s.withTarget > 0 ? `, u krevet na vrijeme ${s.onTarget}/${s.withTarget}` : '';
    lines.push(`San: prosjek ${minutesText(s.averageMinutes)} (${s.nights} noći, kratkih ${s.shortNights}${target})`);
  } else {
    lines.push('San: nije praćen');
  }
  if (week.calories !== null) {
    const c = week.calories;
    lines.push(`Kalorije (dani s unosom ${c.days}): unutar cilja ${c.within}, iznad ${c.over}, ispod ${c.under}`);
  }
  if (week.money !== null) {
    const m = week.money;
    lines.push(
      `Potrošnja (dani s unosom ${m.days}): ${euroText(m.spentCents)} naspram dijela limita ${euroText(m.budgetCents)}, dana iznad ${m.overDays}`,
    );
  }
  lines.push(
    `XP: ${week.xp} · prosječna ocjena dana: ${week.rating === null ? '—' : `${week.rating}/5`}${week.gaveUpDays > 0 ? ` · dana s "Odustajem": ${week.gaveUpDays}` : ''}`,
  );
  return lines;
}

/** Korisnička poruka tjedne dijagnoze: tjedan, dani, prošli tjedan, promjena tjedna, ranije dijagnoze. */
export function buildWeekReportUserMessage(req: WriteWeekReportRequest): string {
  const lines: string[] = [];
  lines.push(
    `Tjedna dijagnoza za ${req.week.start} – ${req.week.end}. Trend: ${WEEK_TREND_TEXT[req.trend]}. Niz boljih tjedana: ${req.betterWeeks}.`,
  );
  lines.push('', 'OVAJ TJEDAN', ...weekLines(req.week));
  if (req.days.length > 0) {
    lines.push('', 'DANI');
    for (const day of req.days) {
      const parts = [
        `${day.date} (${weekdayOf(day.date)})`,
        `rezultat ${day.score ?? '—'}`,
        `ocjena ${day.rating ?? '—'}`,
        ...day.comments.map((c) => `${quote(c.title)} ${outcomeText(c.outcome)}: ${quote(c.comment)}`),
        ...day.broken.map((rule) => `prekršena ${quote(rule.title)}${rule.trigger ? ` (${quote(rule.trigger)})` : ''}`),
      ];
      lines.push(`- ${parts.join('; ')}`);
    }
  }
  if (req.previousWeek !== null) lines.push('', `PROŠLI TJEDAN (${req.previousWeek.start})`, ...weekLines(req.previousWeek));
  lines.push('', 'PROMJENA TJEDNA (odabrana, ne mijenjaj je)');
  if (req.idea === null) lines.push('- nema nove promjene: zadrži ritam');
  else lines.push(`- ${quote(req.idea.text)}${req.idea.carried ? ' (prenesena — prihvaćena prošli tjedan, drži se još tjedan)' : ''}`);
  if (req.previous.length > 0) {
    lines.push('', 'PRETHODNE TJEDNE DIJAGNOZE (je li savjet upalio?)');
    for (const prev of req.previous) {
      const feedback =
        prev.helpful === null ? 'bez odgovora' : prev.helpful ? 'korisnik: Pomoglo' : 'korisnik: Nije pomoglo';
      const accepted =
        prev.suggestionAccepted === null ? '' : prev.suggestionAccepted ? '; promjena: Probat ću' : '; promjena: Ne sada';
      lines.push(`- tjedan od ${prev.date}: ${quote(prev.summary)}`);
      if (prev.ideas.length > 0) lines.push(`  promjena: ${prev.ideas.map(quote).join(' | ')}`);
      lines.push(`  ${feedback}${prev.comment ? ` — ${quote(prev.comment)}` : ''}${accepted}`);
    }
  }
  return lines.join('\n');
}

/** Odgovor modela za tjedan, ili `null` ako ne drži oblik (app ostaje na lokalnoj dijagnozi). */
export function acceptModelWeekReport(raw: string): WriteWeekReportText | null {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return readWeekReportText(JSON.parse(jsonText));
  } catch {
    return null;
  }
}

/** Provjera teksta tjedne dijagnoze (odgovor modela i odgovor funkcije u appu). */
export function readWeekReportText(parsed: unknown): WriteWeekReportText | null {
  if (!isRecord(parsed) || typeof parsed.summary !== 'string') return null;
  const summary = parsed.summary.replace(/\s+/g, ' ').trim();
  if (summary.length === 0 || summary.length > REPORT_LIMITS.summary) return null;
  const praise = readLines(parsed.praise, REPORT_LIMITS.praise);
  const noticed = readLines(parsed.noticed, REPORT_LIMITS.noticed);
  const problems = readLines(parsed.problems, REPORT_LIMITS.problems);
  if (praise === null || noticed === null || problems === null) return null;
  let ideaWhy: string | null = null;
  if (parsed.ideaWhy !== undefined && parsed.ideaWhy !== null) {
    if (typeof parsed.ideaWhy !== 'string') return null;
    const text = parsed.ideaWhy.replace(/\s+/g, ' ').trim();
    if (text.length > REPORT_LIMITS.line) return null;
    ideaWhy = text.length > 0 ? text : null;
  }
  return { version: WEEK_REPORT_PROMPT_VERSION, summary, praise, noticed, problems, ideaWhy };
}

// ===========================================================================
// Mjesečna dijagnoza riječima (korak 31d, prompt llm-month-v1)
// ===========================================================================

/**
 * Mjesečna dijagnoza: brojke, trend i **ideje-smjer** (najviše dvije, bez prihvaćanja — promjene
 * po jednu nudi tjedna) računa app lokalno. Model piše Ukratko, Pohvale, Što smo primijetili,
 * Velike probleme i jednu rečenicu uz smjer.
 */
export const MONTH_REPORT_PROMPT_VERSION = 'llm-month-v1';

/** Statistika razdoblja (isti oblik za tjedan i mjesec). */
export type ReportPeriodStats = ReportWeek;

export type WriteMonthReportRequest = {
  period: 'month';
  /** Prvi dan mjeseca. */
  start: string;
  locale: ReportLocale;
  trend: ReportTrend;
  month: ReportPeriodStats;
  previousMonth: ReportPeriodStats | null;
  /** Zaključeni dani mjeseca ukratko — uzorci po danu u tjednu i polovicama. */
  days: ReportHistoryDay[];
  /** Lokalne ideje-smjer (1–2), tekst na jeziku appa. */
  ideas: string[];
  /** Odgovori na tjedne promjene tog mjeseca. */
  changes: { accepted: number; rejected: number };
  /** Ranije mjesečne dijagnoze (`date` = prvi dan) s odgovorom Pomoglo / Nije pomoglo. */
  previous: ReportPrevious[];
};

export type WriteMonthReportText = {
  version: typeof MONTH_REPORT_PROMPT_VERSION;
  summary: string;
  praise: string[];
  noticed: string[];
  problems: string[];
  /** Jedna rečenica zašto je taj smjer dobar za idući mjesec; `null` bez nje. */
  ideasWhy: string | null;
};

export const MONTH_REPORT_LIMITS = { days: 31, ideas: 2, previous: 3, comments: 2 } as const;

const lastDayOfMonth = (start: string): string | null => {
  const [y, m] = start.split('-').map(Number);
  if (y === undefined || m === undefined) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${start.slice(0, 8)}${String(last).padStart(2, '0')}`;
};

/**
 * Zahtjev za mjesečnu dijagnozu, provjeren. `null` bez valjanog mjeseca (prvi dan, statistika
 * tog mjeseca do njegova zadnjeg dana) ili trenda; dani izvan mjeseca, prošli mjesec koji nije
 * prije, kasnije dijagnoze i nevaljane stavke otpadaju.
 */
export function parseWriteMonthReportRequest(raw: unknown): WriteMonthReportRequest | null {
  if (!isRecord(raw) || raw.period !== 'month' || !isDate(raw.start) || !raw.start.endsWith('-01')) return null;
  const start = raw.start;
  const end = lastDayOfMonth(start);
  const trend = TRENDS.find((value) => value === raw.trend);
  const month = parseWeek(raw.month, MONTH_REPORT_LIMITS.days);
  if (end === null || trend === undefined || month === null || month.start !== start || month.end !== end) return null;
  const previousMonth =
    raw.previousMonth === null || raw.previousMonth === undefined
      ? null
      : parseWeek(raw.previousMonth, MONTH_REPORT_LIMITS.days);
  const changes = isRecord(raw.changes) ? raw.changes : {};
  return {
    period: 'month',
    start,
    locale: raw.locale === 'en' ? 'en' : 'hr',
    trend,
    month,
    previousMonth: previousMonth !== null && previousMonth.end < start ? previousMonth : null,
    days: list(raw.days, MONTH_REPORT_LIMITS.days, (value) => {
      const day = parseHistoryDay(value);
      return day === null
        ? null
        : {
            ...day,
            comments: day.comments.slice(0, MONTH_REPORT_LIMITS.comments),
            broken: day.broken.slice(0, MONTH_REPORT_LIMITS.comments),
          };
    }).filter((day) => day.date >= start && day.date <= end),
    ideas: list(raw.ideas, MONTH_REPORT_LIMITS.ideas, (value) => clip(value, WEEK_REPORT_LIMITS.idea)),
    changes: {
      accepted: isInt(changes.accepted, 0, 10) ? changes.accepted : 0,
      rejected: isInt(changes.rejected, 0, 10) ? changes.rejected : 0,
    },
    previous: list(raw.previous, MONTH_REPORT_LIMITS.previous, parsePrevious).filter((prev) => prev.date < start),
  };
}

/** Sistemska uputa mjesečne dijagnoze: isti ton i red, smjer ne bira model. */
export function buildMonthReportSystemPrompt(locale: ReportLocale): string {
  return `\
Ti si iskren i topao osobni trener u appu Ritam. Pišeš MJESEČNU dijagnozu korisnikova mjeseca.
Ton: kao dobar trener — iskren, topao, konkretan. Prvo činjenice, pa tumačenje. Svaka kritika ima ideju što napraviti. Bez posramljivanja, bez osude, bez uljepšavanja. Nikad kazna: neodrađeno je informacija, ne neuspjeh.
Čita se za dvije minute: kratke rečenice, obraćaš se korisniku s "ti".

Brojke ("Napredak") app prikazuje sam — koristi ih samo kad nešto znače.
Napiši, uvijek ovim redom:
1. summary — JEDNA rečenica: kakav je bio mjesec i kamo ide trend (trend ti je zadan, ne mijenjaj ga).
2. praise — 0–${REPORT_LIMITS.praise} pohvale: što je išlo super i neka tako ostane. Samo stvarne, iz podataka.
3. noticed — 0–${REPORT_LIMITS.noticed} uzorka kroz mjesec i mogući uzroci, psihološki pogled: dani u tjednu koji padaju ili nose, prva naspram druge polovice, koje tjedne promjene su prihvaćene i drže li, što se ponavlja u komentarima. Ako su trackeri (kalorije, potrošnja) dani, poveži ih s ostalim kad ima smisla.
4. problems — 0–${REPORT_LIMITS.problems} velika problema: iskreno i objektivno, ali nikad bezobrazno. Ako ih nema, prazan popis.
5. ideasWhy — JEDNA rečenica zašto je SMJER ZA IDUĆI MJESEC (zadan ti je, najviše dvije stavke) dobar, iz podataka ovog mjeseca. Smjer NE mijenjaj i ne dodaj nove promjene: malo po malo, nove promjene dolaze jedna po jedna kroz tjedne dijagnoze.

Prethodne mjesečne dijagnoze: pogledaj je li prošli smjer upalio. Ako je korisnik rekao "Nije pomoglo", priznaj to i budi konkretniji.
Ne izmišljaj podatke koji nisu dani. Ne spominji da si AI, model ili app.
Svaki redak najviše ${REPORT_LIMITS.line} znakova, summary najviše ${REPORT_LIMITS.summary}.
Piši na ${LANGUAGE[locale]} jeziku.

Vrati SAMO JSON objekt (bez markdowna):
{"summary":"...","praise":["..."],"noticed":["..."],"problems":["..."],"ideasWhy":"..."}`;
}

const MONTH_TREND_TEXT: Record<ReportTrend, string> = {
  better: 'bolje nego prošli mjesec',
  same: 'otprilike isto kao prošli mjesec',
  worse: 'lošije nego prošli mjesec',
  first: 'nema usporedbe (prvi mjesec ili prošli nema zaključenih dana)',
};

/** Korisnička poruka mjesečne dijagnoze. */
export function buildMonthReportUserMessage(req: WriteMonthReportRequest): string {
  const lines: string[] = [];
  lines.push(`Mjesečna dijagnoza za ${req.month.start} – ${req.month.end}. Trend: ${MONTH_TREND_TEXT[req.trend]}.`);
  lines.push('', 'OVAJ MJESEC', ...weekLines(req.month, dayCount(req.month)));
  lines.push(`Tjedne promjene ovog mjeseca: prihvaćeno ${req.changes.accepted}, odbijeno ${req.changes.rejected}`);
  if (req.days.length > 0) {
    lines.push('', 'DANI');
    for (const day of req.days) {
      const parts = [
        `${day.date} (${weekdayOf(day.date)})`,
        `rezultat ${day.score ?? '—'}`,
        `ocjena ${day.rating ?? '—'}`,
        ...day.comments.map((c) => `${quote(c.title)} ${outcomeText(c.outcome)}: ${quote(c.comment)}`),
        ...day.broken.map((rule) => `prekršena ${quote(rule.title)}${rule.trigger ? ` (${quote(rule.trigger)})` : ''}`),
      ];
      lines.push(`- ${parts.join('; ')}`);
    }
  }
  const previousMonth = req.previousMonth;
  if (previousMonth !== null) {
    lines.push('', `PROŠLI MJESEC (${previousMonth.start})`, ...weekLines(previousMonth, dayCount(previousMonth)));
  }
  lines.push('', 'SMJER ZA IDUĆI MJESEC (odabran, ne mijenjaj ga)');
  for (const idea of req.ideas) lines.push(`- ${quote(idea)}`);
  if (req.ideas.length === 0) lines.push('- zadrži ritam');
  if (req.previous.length > 0) {
    lines.push('', 'PRETHODNE MJESEČNE DIJAGNOZE (je li smjer upalio?)');
    for (const prev of req.previous) {
      const feedback =
        prev.helpful === null ? 'bez odgovora' : prev.helpful ? 'korisnik: Pomoglo' : 'korisnik: Nije pomoglo';
      lines.push(`- mjesec od ${prev.date}: ${quote(prev.summary)}`);
      if (prev.ideas.length > 0) lines.push(`  smjer: ${prev.ideas.map(quote).join(' | ')}`);
      lines.push(`  ${feedback}${prev.comment ? ` — ${quote(prev.comment)}` : ''}`);
    }
  }
  return lines.join('\n');
}

/** Broj kalendarskih dana razdoblja (za „zaključeni dani x/N“). */
function dayCount(stats: ReportPeriodStats): number {
  const ms = Date.parse(`${stats.end}T12:00:00Z`) - Date.parse(`${stats.start}T12:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** Odgovor modela za mjesec, ili `null` ako ne drži oblik. */
export function acceptModelMonthReport(raw: string): WriteMonthReportText | null {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return readMonthReportText(JSON.parse(jsonText));
  } catch {
    return null;
  }
}

/** Provjera teksta mjesečne dijagnoze (odgovor modela i odgovor funkcije u appu). */
export function readMonthReportText(parsed: unknown): WriteMonthReportText | null {
  if (!isRecord(parsed)) return null;
  const week = readWeekReportText({ ...parsed, ideaWhy: parsed.ideasWhy });
  if (week === null) return null;
  return {
    version: MONTH_REPORT_PROMPT_VERSION,
    summary: week.summary,
    praise: week.praise,
    noticed: week.noticed,
    problems: week.problems,
    ideasWhy: week.ideaWhy,
  };
}

// ===========================================================================
// Godišnja dijagnoza riječima (korak 31e, prompt llm-year-v1)
// ===========================================================================

/**
 * Godišnja dijagnoza: brojke, trend, prosjek po mjesecima i **smjer** (najviše dvije ideje) računa
 * app lokalno. Model dobiva godinu, prošlu godinu, mjesece (prosjek i sažetak mjesečne dijagnoze)
 * i ranije godišnje dijagnoze — ne pojedinačne dane (365 dana je previše za jedan poziv).
 */
export const YEAR_REPORT_PROMPT_VERSION = 'llm-year-v1';

export type ReportYearMonth = {
  /** "YYYY-MM". */
  month: string;
  /** Prosjek ocijenjenih dana; `null` bez njih. */
  average: number | null;
  /** Ukratko mjesečne dijagnoze (riječi modela ili lokalni redak); `null` bez dijagnoze. */
  summary: string | null;
};

export type WriteYearReportRequest = {
  period: 'year';
  /** 1. 1. te godine. */
  start: string;
  locale: ReportLocale;
  trend: ReportTrend;
  year: ReportPeriodStats;
  previousYear: ReportPeriodStats | null;
  months: ReportYearMonth[];
  /** Lokalni smjer za iduću godinu (1–2), tekst na jeziku appa. */
  ideas: string[];
  /** Odgovori na tjedne promjene te godine. */
  changes: { accepted: number; rejected: number };
  /** Ranije godišnje dijagnoze (`date` = 1. 1.) s odgovorom Pomoglo / Nije pomoglo. */
  previous: ReportPrevious[];
};

export type WriteYearReportText = {
  version: typeof YEAR_REPORT_PROMPT_VERSION;
  summary: string;
  praise: string[];
  noticed: string[];
  problems: string[];
  /** Jedna rečenica zašto je taj smjer dobar za iduću godinu; `null` bez nje. */
  ideasWhy: string | null;
};

export const YEAR_REPORT_LIMITS = { days: 366, months: 12, ideas: 2, previous: 2, changes: 60 } as const;

function parseYearMonth(raw: unknown, year: string): ReportYearMonth | null {
  if (!isRecord(raw) || typeof raw.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)) return null;
  if (!raw.month.startsWith(`${year}-`)) return null;
  const average = parseScore(raw.average);
  if (average === undefined) return null;
  return {
    month: raw.month,
    average,
    summary: raw.summary === null || raw.summary === undefined ? null : clip(raw.summary, REPORT_LIMITS.line),
  };
}

/**
 * Zahtjev za godišnju dijagnozu, provjeren. `null` bez valjane godine (1. 1., statistika do 31. 12.)
 * ili trenda; mjeseci druge godine i ponovljeni mjeseci, prošla godina koja nije prije, kasnije
 * dijagnoze i nevaljane stavke otpadaju.
 */
export function parseWriteYearReportRequest(raw: unknown): WriteYearReportRequest | null {
  if (!isRecord(raw) || raw.period !== 'year' || !isDate(raw.start) || !raw.start.endsWith('-01-01')) return null;
  const start = raw.start;
  const yearText = start.slice(0, 4);
  const trend = TRENDS.find((value) => value === raw.trend);
  const year = parseWeek(raw.year, YEAR_REPORT_LIMITS.days);
  if (trend === undefined || year === null || year.start !== start || year.end !== `${yearText}-12-31`) return null;
  const previousYear =
    raw.previousYear === null || raw.previousYear === undefined ? null : parseWeek(raw.previousYear, YEAR_REPORT_LIMITS.days);
  const changes = isRecord(raw.changes) ? raw.changes : {};
  const byMonth = new Map<string, ReportYearMonth>();
  for (const month of list(raw.months, YEAR_REPORT_LIMITS.months, (value) => parseYearMonth(value, yearText))) {
    if (!byMonth.has(month.month)) byMonth.set(month.month, month);
  }
  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  return {
    period: 'year',
    start,
    locale: raw.locale === 'en' ? 'en' : 'hr',
    trend,
    year,
    previousYear: previousYear !== null && previousYear.end < start ? previousYear : null,
    months,
    ideas: list(raw.ideas, YEAR_REPORT_LIMITS.ideas, (value) => clip(value, WEEK_REPORT_LIMITS.idea)),
    changes: {
      accepted: isInt(changes.accepted, 0, YEAR_REPORT_LIMITS.changes) ? changes.accepted : 0,
      rejected: isInt(changes.rejected, 0, YEAR_REPORT_LIMITS.changes) ? changes.rejected : 0,
    },
    previous: list(raw.previous, YEAR_REPORT_LIMITS.previous, parsePrevious).filter((prev) => prev.date < start),
  };
}

/** Sistemska uputa godišnje dijagnoze: isti ton i red, smjer ne bira model. */
export function buildYearReportSystemPrompt(locale: ReportLocale): string {
  return `\
Ti si iskren i topao osobni trener u appu Ritam. Pišeš GODIŠNJU dijagnozu korisnikove godine.
Ton: kao dobar trener — iskren, topao, konkretan. Prvo činjenice, pa tumačenje. Svaka kritika ima ideju što napraviti. Bez posramljivanja, bez osude, bez uljepšavanja. Nikad kazna: neodrađeno je informacija, ne neuspjeh.
Čita se za dvije minute: kratke rečenice, obraćaš se korisniku s "ti". Godina je velika — vidi luk, ne pojedinosti.

Brojke ("Napredak") i traku mjeseci app prikazuje sam — koristi ih samo kad nešto znače.
Napiši, uvijek ovim redom:
1. summary — JEDNA rečenica: kakva je bila godina i kamo ide trend (trend ti je zadan, ne mijenjaj ga).
2. praise — 0–${REPORT_LIMITS.praise} pohvale: što je kroz godinu išlo super i neka tako ostane. Samo stvarne, iz podataka.
3. noticed — 0–${REPORT_LIMITS.noticed} uzorka kroz godinu i mogući uzroci, psihološki pogled: najjači i najslabiji mjeseci i što ih dijeli, prva naspram druge polovice, koje tjedne promjene su prihvaćene i drže li, što se ponavlja u sažecima mjeseci. Ako su trackeri (kalorije, potrošnja) dani, poveži ih s ostalim kad ima smisla.
4. problems — 0–${REPORT_LIMITS.problems} velika problema: iskreno i objektivno, ali nikad bezobrazno. Ako ih nema, prazan popis.
5. ideasWhy — JEDNA rečenica zašto je SMJER ZA IDUĆU GODINU (zadan ti je, najviše dvije stavke) dobar, iz podataka ove godine. Smjer NE mijenjaj i ne dodaj nove promjene: malo po malo, nove promjene dolaze jedna po jedna kroz tjedne dijagnoze.

Prethodne godišnje dijagnoze: pogledaj je li prošli smjer upalio. Ako je korisnik rekao "Nije pomoglo", priznaj to i budi konkretniji.
Ne izmišljaj podatke koji nisu dani. Ne spominji da si AI, model ili app.
Svaki redak najviše ${REPORT_LIMITS.line} znakova, summary najviše ${REPORT_LIMITS.summary}.
Piši na ${LANGUAGE[locale]} jeziku.

Vrati SAMO JSON objekt (bez markdowna):
{"summary":"...","praise":["..."],"noticed":["..."],"problems":["..."],"ideasWhy":"..."}`;
}

const YEAR_TREND_TEXT: Record<ReportTrend, string> = {
  better: 'bolje nego prošla godina',
  same: 'otprilike isto kao prošla godina',
  worse: 'lošije nego prošla godina',
  first: 'nema usporedbe (prva godina ili prošla nema zaključenih dana)',
};

/** Korisnička poruka godišnje dijagnoze. */
export function buildYearReportUserMessage(req: WriteYearReportRequest): string {
  const lines: string[] = [];
  lines.push(`Godišnja dijagnoza za ${req.year.start} – ${req.year.end}. Trend: ${YEAR_TREND_TEXT[req.trend]}.`);
  lines.push('', 'OVA GODINA', ...weekLines(req.year, dayCount(req.year)));
  lines.push(`Tjedne promjene ove godine: prihvaćeno ${req.changes.accepted}, odbijeno ${req.changes.rejected}`);
  if (req.months.length > 0) {
    lines.push('', 'MJESECI (prosjek · sažetak mjesečne dijagnoze)');
    for (const month of req.months) {
      const average = month.average === null ? 'bez ocijenjenih dana' : `prosjek ${month.average}/100`;
      lines.push(`- ${month.month}: ${average}${month.summary ? ` · ${quote(month.summary)}` : ''}`);
    }
  }
  const previousYear = req.previousYear;
  if (previousYear !== null) {
    lines.push('', `PROŠLA GODINA (${previousYear.start.slice(0, 4)})`, ...weekLines(previousYear, dayCount(previousYear)));
  }
  lines.push('', 'SMJER ZA IDUĆU GODINU (odabran, ne mijenjaj ga)');
  for (const idea of req.ideas) lines.push(`- ${quote(idea)}`);
  if (req.ideas.length === 0) lines.push('- zadrži ritam');
  if (req.previous.length > 0) {
    lines.push('', 'PRETHODNE GODIŠNJE DIJAGNOZE (je li smjer upalio?)');
    for (const prev of req.previous) {
      const feedback =
        prev.helpful === null ? 'bez odgovora' : prev.helpful ? 'korisnik: Pomoglo' : 'korisnik: Nije pomoglo';
      lines.push(`- godina ${prev.date.slice(0, 4)}: ${quote(prev.summary)}`);
      if (prev.ideas.length > 0) lines.push(`  smjer: ${prev.ideas.map(quote).join(' | ')}`);
      lines.push(`  ${feedback}${prev.comment ? ` — ${quote(prev.comment)}` : ''}`);
    }
  }
  return lines.join('\n');
}

/** Odgovor modela za godinu, ili `null` ako ne drži oblik. */
export function acceptModelYearReport(raw: string): WriteYearReportText | null {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return readYearReportText(JSON.parse(jsonText));
  } catch {
    return null;
  }
}

/** Provjera teksta godišnje dijagnoze (odgovor modela i odgovor funkcije u appu). */
export function readYearReportText(parsed: unknown): WriteYearReportText | null {
  const month = readMonthReportText(parsed);
  return month === null ? null : { ...month, version: YEAR_REPORT_PROMPT_VERSION };
}
