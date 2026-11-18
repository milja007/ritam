/**
 * Čista logika Edge Functions `plan-day` i `parse-input` (koraci 21–22): validacija ulaza,
 * lokalni (fallback) raspored i provjera rasporeda koji vrati model. Bez Deno API-ja i bez
 * udaljenih importa, pa je testiraju i Jest testovi appa (`src/core/schedule/plan-logic.test.ts`).
 *
 * Pregled Codexa (PR #16, P2): fiksni blok rezervira vrijeme; predug zadatak ne troši prozore
 * ostalima; nevaljano tijelo → 400 umjesto iznimke; blok izvan prozora ili s vremenom 99:99 se
 * ne prihvaća.
 */

export type DayPriority = {
  title: string;
  durationMinutes: number | null;
  fixedStart: string | null;
  important: boolean;
};

export type PlanPreferences = {
  morningEnergy: 'high' | 'low';
  afternoonEnergy: 'high' | 'low';
  eveningEnergy: 'high' | 'low';
  focusBlockMinutes: number;
  breakMinutes: number;
};

export type TimeWindow = { start: string; end: string };

/** Tjedni zadatak kojem još fale termini (korak 26): model ga smije smjestiti jednom u dan. */
export type PlanContextTask = {
  title: string;
  durationMinutes: number;
  /** Koliko puta još treba ovaj tjedan. */
  timesLeft: number;
  partOfDay: 'any' | 'morning' | 'afternoon' | 'evening';
  energy: 'low' | 'medium' | 'high';
  /** Rok ("YYYY-MM-DD") ili `null`. */
  deadline: string | null;
  needs: string;
};

/**
 * Kontekst plana (korak 26): ciljevi razdoblja u kojem je dan, tjedni zadaci kojima fale termini
 * i zabrane koje taj dan vrijede. Stari klijent bez polja → prazan kontekst.
 */
export type PlanContext = {
  goals: { period: 'week' | 'month' | 'year'; title: string; done: boolean }[];
  tasks: PlanContextTask[];
  rules: { title: string; why: string }[];
};

export type PlanDayRequest = {
  date: string;
  /** Jezik sažetka i pitanja (stari klijent bez polja → hrvatski). */
  locale: 'hr' | 'en';
  priorities: DayPriority[];
  freeWindows: TimeWindow[];
  preferences: PlanPreferences | null;
  context: PlanContext;
};

export type PlannedBlock = {
  title: string;
  start: string;
  end: string;
  kind: 'fixed' | 'suggestion';
};

export type PlanDayResponse = {
  schedule: PlannedBlock[];
  questions: string[];
  summary: string;
};

const DAY_MINUTES = 24 * 60;
const DEFAULT_DURATION = 60;
const DEFAULT_BREAK = 15;
const MAX_PRIORITIES = 30;
const MAX_WINDOWS = 12;
const MAX_TITLE = 200;
const MAX_QUESTIONS = 3;
/** Granice konteksta (korak 26): dovoljno za tjedan/mjesec/godinu, a prompt ostaje kratak. */
export const MAX_CONTEXT_GOALS = 15;
export const MAX_CONTEXT_TASKS = 10;
export const MAX_CONTEXT_RULES = 15;
const MAX_NOTE = 300;

/** Edge Functions koje zovu model. */
export type LlmFunctionName = 'parse-input' | 'plan-day' | 'write-report';

/**
 * Model po funkciji. Odluka Borne 2026-11-18 („najjeftiniji, ali dobar za ovo“; bez DeepSeeka):
 * `parse-input` i `plan-day` → Haiku 5.5 (strukturirani JSON), `write-report` ostaje Sonnet 5.5
 * (tekst dijagnoze na hrvatskom). Ranije (2026-11-09) je `plan-day` bio Sonnet. Mijenja se bez
 * koda varijablom `LLM_MODEL_<FUNKCIJA>` u Supabase secrets. `claude-sonnet-4-5` se povlači
 * 30. 11. 2026. (Codex, PR #16).
 */
export const LLM_MODELS: Readonly<Record<LlmFunctionName, string>> = {
  'parse-input': 'claude-haiku-5-5',
  'plan-day': 'claude-haiku-5-5',
  'write-report': 'claude-sonnet-5-5',
};

/** Ime varijable kojom se model jedne funkcije može zamijeniti bez novog koda. */
export const LLM_MODEL_ENV: Readonly<Record<LlmFunctionName, string>> = {
  'parse-input': 'LLM_MODEL_PARSE_INPUT',
  'plan-day': 'LLM_MODEL_PLAN_DAY',
  'write-report': 'LLM_MODEL_WRITE_REPORT',
};

/**
 * Model za funkciju: varijabla `LLM_MODEL_<FUNKCIJA>` (ako je postavljena i nije prazna), inače
 * zadani iz `LLM_MODELS`. `read` je `Deno.env.get` u funkciji, a u testu obična mapa.
 */
export function llmModelFor(fn: LlmFunctionName, read: (name: string) => string | undefined): string {
  const override = read(LLM_MODEL_ENV[fn])?.trim();
  return override ? override : LLM_MODELS[fn];
}

/** "HH:MM" s valjanim satom (00–23) i minutom (00–59). */
export function isClock(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return hours <= 23 && minutes <= 59;
}

export function clockToMinutes(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parsePriority(raw: unknown): DayPriority | null {
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0 || title.length > MAX_TITLE) return null;
  const duration = raw.durationMinutes ?? null;
  if (duration !== null && (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0 || duration > DAY_MINUTES)) {
    return null;
  }
  const fixedStart = raw.fixedStart ?? null;
  if (fixedStart !== null && !isClock(fixedStart)) return null;
  const important = raw.important ?? false;
  if (typeof important !== 'boolean') return null;
  return { title, durationMinutes: duration, fixedStart, important };
}

function parseWindow(raw: unknown): TimeWindow | null {
  if (!isRecord(raw) || !isClock(raw.start) || !isClock(raw.end)) return null;
  return clockToMinutes(raw.start) < clockToMinutes(raw.end) ? { start: raw.start, end: raw.end } : null;
}

function parsePreferences(raw: unknown): PlanPreferences | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return undefined;
  const energy = (value: unknown) => value === 'high' || value === 'low';
  const minutes = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 240;
  if (!energy(raw.morningEnergy) || !energy(raw.afternoonEnergy) || !energy(raw.eveningEnergy)) return undefined;
  if (!minutes(raw.focusBlockMinutes) || !minutes(raw.breakMinutes)) return undefined;
  return {
    morningEnergy: raw.morningEnergy as PlanPreferences['morningEnergy'],
    afternoonEnergy: raw.afternoonEnergy as PlanPreferences['afternoonEnergy'],
    eveningEnergy: raw.eveningEnergy as PlanPreferences['eveningEnergy'],
    focusBlockMinutes: raw.focusBlockMinutes as number,
    breakMinutes: raw.breakMinutes as number,
  };
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

function parseContextGoal(raw: unknown): PlanContext['goals'][number] | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title, MAX_TITLE);
  if (title === null || (raw.period !== 'week' && raw.period !== 'month' && raw.period !== 'year')) return null;
  return { period: raw.period, title, done: raw.done === true };
}

function parseContextTask(raw: unknown): PlanContextTask | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title, MAX_TITLE);
  const duration = raw.durationMinutes;
  const timesLeft = raw.timesLeft;
  if (title === null) return null;
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 5 || duration > 480) return null;
  if (typeof timesLeft !== 'number' || !Number.isInteger(timesLeft) || timesLeft < 1 || timesLeft > 7) return null;
  const partOfDay = raw.partOfDay;
  if (partOfDay !== 'any' && partOfDay !== 'morning' && partOfDay !== 'afternoon' && partOfDay !== 'evening') return null;
  const energy = raw.energy;
  if (energy !== 'low' && energy !== 'medium' && energy !== 'high') return null;
  const deadline = raw.deadline ?? null;
  if (deadline !== null && (typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline))) return null;
  const needs = typeof raw.needs === 'string' ? raw.needs.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE) : '';
  return { title, durationMinutes: duration, timesLeft, partOfDay, energy, deadline, needs };
}

function parseContextRule(raw: unknown): PlanContext['rules'][number] | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title, MAX_TITLE);
  if (title === null) return null;
  const why = typeof raw.why === 'string' ? raw.why.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE) : '';
  return { title, why };
}

function parseList<T>(raw: unknown, parse: (entry: unknown) => T | null, max: number): T[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, max)
    .map(parse)
    .filter((entry): entry is T => entry !== null);
}

/**
 * Kontekst je samo savjet modelu: nevaljane stavke otpadaju (ne ruše zahtjev), a nema li ga
 * (stari klijent), kontekst je prazan.
 */
export function parsePlanContext(raw: unknown): PlanContext {
  if (!isRecord(raw)) return { goals: [], tasks: [], rules: [] };
  return {
    goals: parseList(raw.goals, parseContextGoal, MAX_CONTEXT_GOALS),
    tasks: parseList(raw.tasks, parseContextTask, MAX_CONTEXT_TASKS),
    rules: parseList(raw.rules, parseContextRule, MAX_CONTEXT_RULES),
  };
}

const PART_TEXT = {
  hr: { any: 'bilo kad', morning: 'ujutro', afternoon: 'popodne', evening: 'navečer' },
  en: { any: 'any time', morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
} as const;
const ENERGY_TEXT = {
  hr: { low: 'malo energije', medium: 'srednje energije', high: 'puno energije' },
  en: { low: 'low energy', medium: 'medium energy', high: 'high energy' },
} as const;
const PERIOD_TEXT = {
  hr: { week: 'tjedan', month: 'mjesec', year: 'godina' },
  en: { week: 'week', month: 'month', year: 'year' },
} as const;

/**
 * Retci konteksta za poruku modelu (korak 26). Prazan kontekst → prazan niz (prompt isti kao
 * prije). Tekst je na jeziku zahtjeva, kao sažetak i pitanja.
 */
export function planContextLines(context: PlanContext, locale: 'hr' | 'en'): string[] {
  const hr = locale === 'hr';
  const lines: string[] = [];
  if (context.goals.length > 0) {
    lines.push(hr ? 'Ciljevi (kontekst — ne moraju se sutra raditi):' : 'Goals (context — not all for tomorrow):');
    for (const goal of context.goals) {
      const done = goal.done ? (hr ? ' (ostvaren)' : ' (done)') : '';
      lines.push(`- [${PERIOD_TEXT[locale][goal.period]}] ${goal.title}${done}`);
    }
  }
  if (context.tasks.length > 0) {
    lines.push(
      hr
        ? 'Tjedni zadaci kojima fale termini (neobavezno: smjesti najviše jedan put po zadatku ako stane, naslov točno kao zadatak):'
        : 'Weekly tasks still missing slots (optional: place at most one session per task if it fits, title exactly as the task):',
    );
    for (const task of context.tasks) {
      const parts = [
        `${task.durationMinutes} min`,
        hr ? `još ${task.timesLeft}×` : `${task.timesLeft}× left`,
        PART_TEXT[locale][task.partOfDay],
        ENERGY_TEXT[locale][task.energy],
      ];
      if (task.deadline) parts.push(hr ? `rok ${task.deadline}` : `due ${task.deadline}`);
      if (task.needs) parts.push(hr ? `treba: ${task.needs}` : `needs: ${task.needs}`);
      lines.push(`- ${task.title} (${parts.join(', ')})`);
    }
  }
  if (context.rules.length > 0) {
    lines.push(hr ? 'Zabrane koje taj dan vrijede (ne planiraj ništa što ih krši):' : 'Rules that apply that day (plan nothing that breaks them):');
    for (const rule of context.rules) lines.push(`- ${rule.title}${rule.why ? ` — ${rule.why}` : ''}`);
  }
  return lines;
}

/**
 * Valjan zahtjev za `plan-day` ili `null` (→ 400). Svaki prioritet i prozor se provjerava:
 * `priorities: [null]`, sat 99:99 ili prozor koji završava prije nego počne ne prolaze.
 */
export function parsePlanDayRequest(body: unknown): PlanDayRequest | null {
  if (!isRecord(body)) return null;
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return null;
  if (!Array.isArray(body.priorities) || body.priorities.length > MAX_PRIORITIES) return null;
  if (!Array.isArray(body.freeWindows) || body.freeWindows.length > MAX_WINDOWS) return null;
  const priorities = body.priorities.map(parsePriority);
  const freeWindows = body.freeWindows.map(parseWindow);
  const preferences = parsePreferences(body.preferences);
  if (priorities.some((entry) => entry === null) || freeWindows.some((entry) => entry === null)) return null;
  if (preferences === undefined) return null;
  return {
    date: body.date,
    locale: body.locale === 'en' ? 'en' : 'hr',
    priorities: priorities as DayPriority[],
    freeWindows: (freeWindows as TimeWindow[]).sort((a, b) => clockToMinutes(a.start) - clockToMinutes(b.start)),
    preferences,
    context: parsePlanContext(body.context),
  };
}

/** Tijelo `parse-input`: `{ text, locale }` ili poruka greške (→ 400). */
export function parseParseInputBody(body: unknown): { text: string; locale: 'hr' | 'en' } | { error: string } {
  if (!isRecord(body)) return { error: 'Neispravan zahtjev: očekuje se objekt { text, locale }' };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const locale = body.locale === 'en' ? 'en' : 'hr';
  if (text.length === 0) return { error: 'Tekst je prazan' };
  if (text.length > 2000) return { error: 'Tekst je predugačak (max 2000 znakova)' };
  return { text, locale };
}

type Interval = { start: number; end: number };

/** Prvi početak u prozoru gdje `duration` stane bez preklapanja (uz razmak `gap`) s `busy`. */
function firstFit(window: Interval, duration: number, busy: readonly Interval[], gap: number): number | null {
  let start = window.start;
  while (start + duration <= window.end) {
    const end = start + duration;
    const conflict = busy.find((slot) => start < slot.end + gap && end + gap > slot.start);
    if (!conflict) return start;
    start = conflict.end + gap;
  }
  return null;
}

/**
 * Lokalni raspored bez modela. Fiksni prioriteti dolaze prvi i **rezerviraju** svoje vrijeme
 * (`kind: 'fixed'`); ostali se redom smještaju u najraniji slobodan dio prozora koji ih prima,
 * uz pauzu iz postavki. Prioritet koji nigdje ne stane ne troši prozore sljedećima — samo ide
 * u pitanje „Nije stalo sve“.
 */
const FALLBACK_TEXT = {
  hr: {
    noWindows: 'Kada si slobodan/na sutra? Navedi slobodne prozore (npr. 9:00–13:00).',
    noPriorities: 'Što imaš sutra? Navedi prioritete.',
    needMore: 'Trebam više informacija da složim plan.',
    unscheduled: (titles: string) => `Nije stalo sve: ${titles}. Imaš li više vremena?`,
    planned: (count: number) => `Plan ima ${count} blok${count === 1 ? '' : 'a'}. Provjeri i odobri.`,
    impossible: 'Nije moguće složiti plan s danim prozorima.',
  },
  en: {
    noWindows: 'When are you free tomorrow? Give your free windows (e.g. 9:00–13:00).',
    noPriorities: "What's on tomorrow? List your priorities.",
    needMore: 'I need a bit more to build the plan.',
    unscheduled: (titles: string) => `Not everything fit: ${titles}. Do you have more time?`,
    planned: (count: number) => `The plan has ${count} block${count === 1 ? '' : 's'}. Check it and approve.`,
    impossible: "The plan doesn't fit into the given windows.",
  },
} as const;

export function buildFallbackPlan(req: PlanDayRequest): PlanDayResponse {
  const text = FALLBACK_TEXT[req.locale];
  if (req.freeWindows.length === 0 || req.priorities.length === 0) {
    return {
      schedule: [],
      questions: [req.freeWindows.length === 0 ? text.noWindows : text.noPriorities],
      summary: text.needMore,
    };
  }

  const gap = req.preferences?.breakMinutes ?? DEFAULT_BREAK;
  const busy: Interval[] = [];
  const placed: { block: PlannedBlock; order: number }[] = [];
  const unscheduled: string[] = [];

  req.priorities.forEach((priority, order) => {
    if (priority.fixedStart === null) return;
    const start = clockToMinutes(priority.fixedStart);
    const end = start + (priority.durationMinutes ?? DEFAULT_DURATION);
    if (end > DAY_MINUTES || busy.some((slot) => start < slot.end && end > slot.start)) {
      unscheduled.push(priority.title);
      return;
    }
    busy.push({ start, end });
    placed.push({ block: { title: priority.title, start: priority.fixedStart, end: minutesToClock(end), kind: 'fixed' }, order });
  });

  const windows = req.freeWindows.map((window) => ({ start: clockToMinutes(window.start), end: clockToMinutes(window.end) }));
  req.priorities.forEach((priority, order) => {
    if (priority.fixedStart !== null) return;
    const duration = priority.durationMinutes ?? DEFAULT_DURATION;
    let start: number | null = null;
    for (const window of windows) {
      start = firstFit(window, duration, busy, gap);
      if (start !== null) break;
    }
    if (start === null) {
      unscheduled.push(priority.title);
      return;
    }
    busy.push({ start, end: start + duration });
    placed.push({
      block: { title: priority.title, start: minutesToClock(start), end: minutesToClock(start + duration), kind: 'suggestion' },
      order,
    });
  });

  const schedule = placed
    .sort((a, b) => clockToMinutes(a.block.start) - clockToMinutes(b.block.start) || a.order - b.order)
    .map((entry) => entry.block);
  return {
    schedule,
    questions: unscheduled.length > 0 ? [text.unscheduled(unscheduled.join(', '))] : [],
    summary: schedule.length > 0 ? text.planned(schedule.length) : text.impossible,
  };
}

function parseBlock(raw: unknown): PlannedBlock | null {
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0 || !isClock(raw.start) || !isClock(raw.end)) return null;
  if (clockToMinutes(raw.start) >= clockToMinutes(raw.end)) return null;
  return { title, start: raw.start, end: raw.end, kind: raw.kind === 'fixed' ? 'fixed' : 'suggestion' };
}

/**
 * Odgovor modela pretvoren u plan, ali samo ako poštuje ograničenja: svaki blok ima valjana
 * vremena, ne preklapa se s drugim, a leži u slobodnom prozoru ili je točno fiksni prioritet;
 * svaki fiksni prioritet je u rasporedu na svom vremenu. Inače `null` (→ lokalni raspored).
 */
export function acceptModelPlan(raw: string, req: PlanDayRequest): PlanDayResponse | null {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.schedule)) return null;
  const blocks = parsed.schedule.map(parseBlock);
  if (blocks.some((block) => block === null)) return null;
  const schedule = (blocks as PlannedBlock[]).sort((a, b) => clockToMinutes(a.start) - clockToMinutes(b.start));

  const fixed = req.priorities.filter((priority) => priority.fixedStart !== null);
  const windows = req.freeWindows.map((window) => ({ start: clockToMinutes(window.start), end: clockToMinutes(window.end) }));
  for (let index = 0; index < schedule.length; index += 1) {
    const block = schedule[index] as PlannedBlock;
    const start = clockToMinutes(block.start);
    const end = clockToMinutes(block.end);
    const previous = schedule[index - 1];
    if (previous && clockToMinutes(previous.end) > start) return null;
    const isFixed = fixed.some((priority) => priority.fixedStart === block.start && priority.title === block.title);
    const inWindow = windows.some((window) => start >= window.start && end <= window.end);
    if (!isFixed && !inWindow) return null;
    if (isFixed) block.kind = 'fixed';
  }
  for (const priority of fixed) {
    if (!schedule.some((block) => block.start === priority.fixedStart && block.title === priority.title)) return null;
  }

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((question): question is string => typeof question === 'string').slice(0, MAX_QUESTIONS)
    : [];
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  return { schedule, questions, summary };
}
