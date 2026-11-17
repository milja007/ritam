/**
 * Epski questovi (korak 34): XP i napredak. Čista logika, bez React importa.
 * XP je izveden iz stanja questa (etape i ostvarenje), pa se može uvijek uskladiti bez dupliranja.
 */
import type { Quest } from '../domain/quest';
import { daysBetween } from '../time/local-date';

/** XP za ostvarenu etapu. */
export const QUEST_MILESTONE_XP = 15;
/** XP za ostvaren quest. */
export const QUEST_DONE_XP = 100;
/** Najviše questova u tijeku odjednom — malo po malo, fokus na nekoliko velikih ciljeva. */
export const MAX_ACTIVE_QUESTS = 3;

/** Jedna dodjela XP-a questa: `sourceId` je id etape ili samog questa (ostvarenje). */
export type QuestXpAward = { sourceId: string; date: string; amount: number };

/** Sve dodjele XP-a koje quest u ovom stanju nosi (etape s danom + ostvarenje). */
export function questXpAwards(quest: Pick<Quest, 'id' | 'milestones' | 'doneOn'>): QuestXpAward[] {
  const awards: QuestXpAward[] = quest.milestones
    .filter((milestone) => milestone.doneOn !== null)
    .map((milestone) => ({ sourceId: milestone.id, date: milestone.doneOn as string, amount: QUEST_MILESTONE_XP }));
  if (quest.doneOn !== null) awards.push({ sourceId: quest.id, date: quest.doneOn, amount: QUEST_DONE_XP });
  return awards;
}

export type QuestProgress = {
  done: number;
  total: number;
  /** 0–1; quest bez etapa je 0 dok nije ostvaren, a ostvaren je uvijek 1. */
  fraction: number;
};

export function questProgress(quest: Pick<Quest, 'milestones' | 'status'>): QuestProgress {
  const total = quest.milestones.length;
  const done = quest.milestones.filter((milestone) => milestone.doneOn !== null).length;
  if (quest.status === 'done') return { done, total, fraction: 1 };
  return { done, total, fraction: total === 0 ? 0 : done / total };
}

/** Dana do roka (0 = danas, negativno = rok je prošao); `null` bez roka ili s neispravnim datumom. */
export function questDaysLeft(quest: Pick<Quest, 'targetDate'>, today: string): number | null {
  if (quest.targetDate === null) return null;
  return daysBetween(today, quest.targetDate);
}

/** Smije li se započeti još jedan quest (najviše `MAX_ACTIVE_QUESTS` u tijeku). */
export function canStartQuest(quests: readonly Pick<Quest, 'status'>[]): boolean {
  return quests.filter((quest) => quest.status === 'active').length < MAX_ACTIVE_QUESTS;
}

/** Redoslijed na Profilu: u tijeku (najbliži rok prvi, bez roka zadnji), pa ostvareni (noviji prvi). */
export function sortQuests<T extends Pick<Quest, 'status' | 'targetDate' | 'doneOn' | 'createdAt'>>(
  quests: readonly T[],
): T[] {
  const rank = { active: 0, done: 1, archived: 2 } as const;
  return [...quests].sort((a, b) => {
    if (a.status !== b.status) return rank[a.status] - rank[b.status];
    if (a.status === 'active') {
      if (a.targetDate !== b.targetDate) {
        if (a.targetDate === null) return 1;
        if (b.targetDate === null) return -1;
        return a.targetDate < b.targetDate ? -1 : 1;
      }
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    }
    const aDone = a.doneOn ?? a.createdAt;
    const bDone = b.doneOn ?? b.createdAt;
    return aDone > bDone ? -1 : aDone < bDone ? 1 : 0;
  });
}

/** Brzi izbor okvirnog roka u uređivaču (bez kalendara): mjeseci od danas, `none` = bez roka. */
export const QUEST_DEADLINES = ['none', '1m', '3m', '6m', '1y'] as const;
export type QuestDeadline = (typeof QUEST_DEADLINES)[number];

const DEADLINE_MONTHS: Record<Exclude<QuestDeadline, 'none'>, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };

/** Datum roka za izbor (`today` + mjeseci; 31. 1. + 1 mj = zadnji dan veljače). */
export function questDeadlineDate(deadline: QuestDeadline, today: string): string | null {
  if (deadline === 'none') return null;
  const [y, m, d] = today.split('-').map(Number);
  if (!y || !m || !d) return null;
  const total = m - 1 + DEADLINE_MONTHS[deadline];
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}
