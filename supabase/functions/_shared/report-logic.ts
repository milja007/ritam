/**
 * write-report — čista logika dnevne dijagnoze s LLM-om (korak 31).
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
