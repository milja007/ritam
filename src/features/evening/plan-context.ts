import { contextTaskRefs, goalPeriodStart, planDayContext } from '@/core/plans';
import { weekStart } from '@/core/progress';
import { EMPTY_PLAN_CONTEXT, type PlanContext, type ProposalTask } from '@/core/schedule';
import { addDays } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listBlocksBetween, listGoals, listRules, listTasks } from '@/db/repos';

export type LoadedPlanContext = { context: PlanContext; tasks: ProposalTask[] };

/**
 * Korak 26: ciljevi, tjedni zadaci i zabrane za dan koji se slaže — čita se tek na „Složi mi
 * dan“. Greška čitanja ne ruši slaganje: model tada dobije prazan kontekst.
 */
export async function loadPlanContext(date: string): Promise<LoadedPlanContext> {
  try {
    const db = getDb();
    const week = weekStart(date);
    if (week === null) return { context: EMPTY_PLAN_CONTEXT, tasks: [] };
    const goals = (['week', 'month', 'year'] as const).flatMap((period) => {
      const start = goalPeriodStart(period, date);
      return start === null ? [] : listGoals(db, LOCAL_USER_ID, period, start);
    });
    const tasks = listTasks(db, LOCAL_USER_ID, week);
    const [weekBlocks, rules] = await Promise.all([
      listBlocksBetween(db, LOCAL_USER_ID, week, addDays(week, 6) ?? week),
      listRules(db, LOCAL_USER_ID),
    ]);
    const context = planDayContext({ date, goals, tasks, weekBlocks, rules });
    return { context, tasks: contextTaskRefs(tasks, context) };
  } catch (error: unknown) {
    console.warn('Loading plan context failed', error);
    return { context: EMPTY_PLAN_CONTEXT, tasks: [] };
  }
}
