/**
 * Korak 25: lokalno smještanje tjednih zadataka u dane tjedna. Odgovori na pitanja kod unosa su
 * tvrda pravila (koncept: „LLM ih smješta, pravila su tvrda ograničenja“ — LLM dolazi u koraku 26,
 * ovo je deterministička osnova i rezerva). Rezultat je samo prijedlog: korisnik ga odobrava.
 * Čista logika: bez React importa.
 */
import type { BlockStatus, ScheduleBlock, Settings, Task, TaskPartOfDay } from '../domain';
import { bedtimeFor } from '../onboarding/onboarding';
import { LAST_END } from '../schedule/block-draft';
import { planStartMinutes } from '../schedule/tomorrow';
import { wakeTimeFor } from '../schedule/wake';
import { formatClock, parseClock } from '../time/clock';
import { addDays, daysBetween } from '../time/local-date';

/** Razmak između smještenog zadatka i susjednih blokova (da dan ne bude zalijepljen). */
export const TASK_BUFFER_MINUTES = 10;
/** Početci se slažu na 5 minuta. */
const STEP = 5;

/** Granice doba dana u minutama od ponoći: jutro do 12, popodne 12–17, večer od 17. */
export const PART_OF_DAY_RANGE: Readonly<Record<TaskPartOfDay, { from: number; to: number }>> = {
  any: { from: 0, to: LAST_END },
  morning: { from: 0, to: 12 * 60 },
  afternoon: { from: 12 * 60, to: 17 * 60 },
  evening: { from: 17 * 60, to: LAST_END },
};

type BlockLike = Pick<ScheduleBlock, 'date' | 'start' | 'end' | 'kind' | 'status' | 'taskId'>;

/** Blok koji „drži“ termin zadatka (premješteni i preskočeni ne broje). */
const COUNTED: readonly BlockStatus[] = ['planned', 'done', 'partial'];

export type TaskProgress = { placed: number; done: number; target: number };

/** Koliko je puta zadatak smješten i odrađen (odrađeno i djelomično) od `timesPerWeek`. */
export function taskProgress(task: Pick<Task, 'id' | 'timesPerWeek'>, blocks: readonly BlockLike[]): TaskProgress {
  const own = blocks.filter((block) => block.taskId === task.id && COUNTED.includes(block.status));
  return {
    placed: own.length,
    done: own.filter((block) => block.status !== 'planned').length,
    target: task.timesPerWeek,
  };
}

/** Jedan dan u koji se smije smjestiti (pozivatelj daje samo dane od danas nadalje). */
export type PlacementDay = {
  date: string;
  wakeTime: string;
  /** Odlazak u krevet ("HH:MM"); poslije ponoći ili nepoznat → kraj dana. */
  bedtime: string | null;
  /** Najranije vrijeme u minutama (danas: sada); `null` = od buđenja. */
  notBefore: number | null;
  blocks: readonly BlockLike[];
};

export type TaskPlacement = { taskId: string; title: string; date: string; start: string; end: string };

export type UnplacedReason = 'no-days' | 'no-time';
export type UnplacedTask = { taskId: string; title: string; missing: number; reason: UnplacedReason };

export type WeekTaskPlan = { placements: TaskPlacement[]; unplaced: UnplacedTask[] };

type Interval = { start: number; end: number };

const clock = (minutes: number): string => formatClock(minutes) ?? '00:00';
const roundUp = (minutes: number): number => Math.ceil(minutes / STEP) * STEP;
const roundDown = (minutes: number): number => Math.floor(minutes / STEP) * STEP;

function intervalOf(block: { start: string; end: string }): Interval | null {
  const start = parseClock(block.start);
  const end = parseClock(block.end);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

/** Zauzeto: svi blokovi dana osim sna, premještenih i preskočenih. */
function busyOf(blocks: readonly BlockLike[]): Interval[] {
  return blocks
    .filter((block) => block.kind !== 'sleep' && block.status !== 'moved' && block.status !== 'skipped')
    .map(intervalOf)
    .filter((interval): interval is Interval => interval !== null);
}

function dayBounds(day: PlacementDay): Interval {
  const from = Math.max(planStartMinutes(day.wakeTime), roundUp(day.notBefore ?? 0));
  const bed = day.bedtime === null ? null : parseClock(day.bedtime);
  const to = bed !== null && bed > from ? bed : LAST_END;
  return { start: from, end: to };
}

/**
 * Prvi (visoka/srednja energija) ili zadnji (niska energija) termin trajanja `duration` unutar
 * granica dana i doba dana, s razmakom od zauzetog. `null` ako ne stane.
 */
export function findSlot(
  bounds: Interval,
  busy: readonly Interval[],
  part: TaskPartOfDay,
  duration: number,
  latest: boolean,
): Interval | null {
  const range = PART_OF_DAY_RANGE[part];
  const from = roundUp(Math.max(bounds.start, range.from));
  const to = Math.min(bounds.end, range.to);
  if (to - from < duration) return null;
  const padded = busy
    .map((slot) => ({ start: slot.start - TASK_BUFFER_MINUTES, end: slot.end + TASK_BUFFER_MINUTES }))
    .sort((a, b) => a.start - b.start);
  // Slobodni prozori unutar [from, to].
  const free: Interval[] = [];
  let cursor = from;
  for (const slot of [...padded, { start: to, end: to }]) {
    const end = Math.min(slot.start, to);
    if (end - cursor >= duration) free.push({ start: cursor, end });
    cursor = Math.max(cursor, roundUp(slot.end));
    if (cursor >= to) break;
  }
  if (free.length === 0) return null;
  if (latest) {
    const window = free[free.length - 1]!;
    const start = roundDown(window.end - duration);
    return start >= window.start ? { start, end: start + duration } : null;
  }
  const window = free[0]!;
  return { start: window.start, end: window.start + duration };
}

/** Redoslijed: raniji rok, pa više puta tjedno, pa dulje trajanje, pa redom unosa. */
function byUrgency(a: Task, b: Task): number {
  const deadlineA = a.deadline ?? '9999-12-31';
  const deadlineB = b.deadline ?? '9999-12-31';
  return (
    deadlineA.localeCompare(deadlineB) ||
    b.timesPerWeek - a.timesPerWeek ||
    b.durationMinutes - a.durationMinutes ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

/** Najmanji razmak u danima od već korištenih dana (bez korištenih = beskonačno). */
function spacing(date: string, used: readonly string[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const other of used) {
    const distance = Math.abs(daysBetween(other, date) ?? 0);
    if (distance < min) min = distance;
  }
  return min;
}

/**
 * Smjesti zadatke koji još nisu smješteni `timesPerWeek` puta. Pravila (tvrda): svaki put drugi
 * dan (i različit od dana gdje je već smješten), dan najkasnije na rok, termin unutar doba dana,
 * buđenja + 30 min i kreveta, bez preklapanja (uz razmak 10 min). Dani se biraju što ravnomjernije
 * (najveći razmak od već korištenih dana, pa raniji). Visoka i srednja energija → najranije u
 * prozoru, niska → najkasnije. Što ne stane, vraća se s razlogom.
 */
export function placeWeekTasks(tasks: readonly Task[], days: readonly PlacementDay[]): WeekTaskPlan {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const busy = new Map<string, Interval[]>(ordered.map((day) => [day.date, busyOf(day.blocks)]));
  const bounds = new Map<string, Interval>(ordered.map((day) => [day.date, dayBounds(day)]));
  const allBlocks = ordered.flatMap((day) => day.blocks);
  const placements: TaskPlacement[] = [];
  const unplaced: UnplacedTask[] = [];

  for (const task of [...tasks].sort(byUrgency)) {
    const progress = taskProgress(task, allBlocks);
    let missing = Math.max(0, task.timesPerWeek - progress.placed);
    if (missing === 0) continue;
    const used = allBlocks
      .filter((block) => block.taskId === task.id && COUNTED.includes(block.status))
      .map((block) => block.date);
    const candidates = ordered.filter(
      (day) => (task.deadline === null || day.date <= task.deadline) && !used.includes(day.date),
    );
    if (candidates.length === 0) {
      unplaced.push({ taskId: task.id, title: task.title, missing, reason: 'no-days' });
      continue;
    }
    const latest = task.energy === 'low';
    while (missing > 0) {
      let best: { date: string; slot: Interval; score: number } | null = null;
      for (const day of candidates) {
        if (used.includes(day.date)) continue;
        const slot = findSlot(bounds.get(day.date)!, busy.get(day.date)!, task.partOfDay, task.durationMinutes, latest);
        if (slot === null) continue;
        const score = spacing(day.date, used);
        if (best === null || score > best.score) best = { date: day.date, slot, score };
      }
      if (best === null) break;
      used.push(best.date);
      busy.get(best.date)!.push(best.slot);
      placements.push({
        taskId: task.id,
        title: task.title,
        date: best.date,
        start: clock(best.slot.start),
        end: clock(best.slot.end),
      });
      missing -= 1;
    }
    if (missing > 0) {
      const daysLeft = candidates.some((day) => !used.includes(day.date));
      unplaced.push({ taskId: task.id, title: task.title, missing, reason: daysLeft ? 'no-time' : 'no-days' });
    }
  }

  placements.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return { placements, unplaced };
}

/**
 * Dani u koje se smije smjestiti: od danas (danas ne prije `nowMinutes`) do kraja tjedna. Buđenje
 * po danu (radni dan / vikend), krevet prema buđenju sljedećeg dana i satima sna.
 */
export function placementDays(
  dates: readonly string[],
  today: string,
  nowMinutes: number,
  settings: Pick<Settings, 'wakeTime' | 'weekendWakeTime' | 'sleepHours'>,
  blocks: readonly BlockLike[],
): PlacementDay[] {
  return dates
    .filter((date) => date >= today)
    .map((date) => {
      const next = addDays(date, 1);
      return {
        date,
        wakeTime: wakeTimeFor(settings, date),
        bedtime: next === null ? null : bedtimeFor(wakeTimeFor(settings, next), settings.sleepHours),
        notBefore: date === today ? nowMinutes : null,
        blocks: blocks.filter((block) => block.date === date),
      };
    });
}
