/**
 * Korak 26: kontekst za „Složi mi dan“ (`plan-day`) — ciljevi razdoblja u kojem je dan, tjedni
 * zadaci kojima još fale termini i zabrane koje taj dan vrijede. Čista logika, bez React importa.
 */
import type { Goal, Rule, ScheduleBlock, Task } from '../domain';
import { rulesActiveOn } from '../rules/rules';
import type { PlanContext } from '../schedule/edge-types';
import { goalPeriodStart, sortGoals } from './goals';
import { taskProgress } from './week-tasks';

/** Iste granice kao `plan-logic.ts` na serveru. */
const MAX_GOALS = 15;
const MAX_TASKS = 10;
const MAX_RULES = 15;

const PERIOD_ORDER = { week: 0, month: 1, year: 2 } as const;

export type PlanContextInput = {
  date: string;
  /** Ciljevi (bilo kojeg razdoblja — uzimaju se oni čije razdoblje sadrži `date`). */
  goals: readonly Goal[];
  /** Zadaci tjedna u kojem je `date`. */
  tasks: readonly Task[];
  /** Blokovi tog tjedna (za koliko je puta zadatak već smješten). */
  weekBlocks: readonly Pick<ScheduleBlock, 'date' | 'start' | 'end' | 'kind' | 'status' | 'taskId'>[];
  rules: readonly Rule[];
};

/**
 * Kontekst dana. Zadatak ulazi samo ako mu fale termini, rok nije prošao i taj dan još nema
 * svoj termin (zadatak se ne ponavlja isti dan). Ostvareni ciljevi ostaju (model zna što je
 * gotovo), ali iza neostvarenih.
 */
export function planDayContext({ date, goals, tasks, weekBlocks, rules }: PlanContextInput): PlanContext {
  const contextGoals = sortGoals(goals.filter((goal) => goalPeriodStart(goal.period, date) === goal.periodStart))
    .sort(
      (a, b) =>
        Number(a.doneOn !== null) - Number(b.doneOn !== null) || PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period],
    )
    .slice(0, MAX_GOALS)
    .map((goal) => ({ period: goal.period, title: goal.title, done: goal.doneOn !== null }));

  const contextTasks = tasks
    .filter((task) => task.deadline === null || task.deadline >= date)
    .filter((task) => !weekBlocks.some((block) => block.taskId === task.id && block.date === date && block.status !== 'moved' && block.status !== 'skipped'))
    .map((task) => ({ task, left: task.timesPerWeek - taskProgress(task, weekBlocks).placed }))
    .filter((entry) => entry.left > 0)
    .slice(0, MAX_TASKS)
    .map(({ task, left }) => ({
      title: task.title,
      durationMinutes: task.durationMinutes,
      timesLeft: Math.min(left, 7),
      partOfDay: task.partOfDay,
      energy: task.energy,
      deadline: task.deadline,
      needs: task.needs,
    }));

  const contextRules = rulesActiveOn(rules, date)
    .slice(0, MAX_RULES)
    .map((rule) => ({ title: rule.title, why: rule.why }));

  return { goals: contextGoals, tasks: contextTasks, rules: contextRules };
}

/** Zadaci iz konteksta s id-em — da se blok prijedloga veže na zadatak (`planProposal`). */
export function contextTaskRefs(tasks: readonly Task[], context: PlanContext): { id: string; title: string }[] {
  const titles = new Set(context.tasks.map((task) => task.title));
  return tasks.filter((task) => titles.has(task.title)).map((task) => ({ id: task.id, title: task.title }));
}

/** Je li kontekst prazan (tada ga UI ne spominje). */
export function isPlanContextEmpty(context: PlanContext): boolean {
  return context.goals.length === 0 && context.tasks.length === 0 && context.rules.length === 0;
}
