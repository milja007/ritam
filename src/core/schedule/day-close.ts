/**
 * Zatvaranje dana (korak 17d): "Odustajem od svega", kad je dan riješen (dijagnoza se otključa)
 * i što fali za ležeran večernji podsjetnik. Čista logika: bez React importa i bez baze.
 */
import type { ScheduleBlock } from '../domain';

type StatusBlock = Pick<ScheduleBlock, 'kind' | 'status'>;

/** Blok koji se prijavljuje (san se ne prijavljuje). */
const isReportable = (block: StatusBlock) => block.kind !== 'sleep';

/** Još bez ishoda: planiran, nije ni odrađen ni prijavljen ni otkazan (otkazan = `skipped`). */
export function isUnresolved(block: StatusBlock): boolean {
  return isReportable(block) && block.status === 'planned';
}

/**
 * Blokovi koje "Odustajem od svega" zatvara kao neodrađene (bez XP-a): svi neriješeni osim sna —
 * prošli neprijavljeni, trenutni i budući. Odrađeni, djelomični i otkazani ostaju kakvi jesu.
 */
export function giveUpBlocks<T extends StatusBlock>(blocks: readonly T[]): T[] {
  return blocks.filter(isUnresolved);
}

/** Ima li smisla nuditi "Odustajem od svega" (ostalo je nešto neriješeno). */
export function canGiveUp(blocks: readonly StatusBlock[]): boolean {
  return blocks.some(isUnresolved);
}

/**
 * Je li dan riješen: postoji barem jedan blok osim sna i svaki ima ishod (odrađen, djelomično,
 * nije, premješten, otkazan ili zatvoren s Odustajem). Tada se dijagnoza dana otključa.
 */
export function isDayResolved(blocks: readonly StatusBlock[]): boolean {
  const reportable = blocks.filter(isReportable);
  return reportable.length > 0 && !reportable.some(isUnresolved);
}

/** Što fali na kraju dana — razlozi za ležeran večernji podsjetnik, redom važnosti. */
export const EVENING_NEEDS = ['report', 'tomorrow', 'diagnosis'] as const;
export type EveningNeed = (typeof EVENING_NEEDS)[number];

export type EveningNeedsInput = {
  /** Blokovi dana podsjetnika. */
  blocks: readonly StatusBlock[];
  /** Ima li sutrašnji dan plan (barem jedan blok osim sna). */
  tomorrowHasPlan: boolean;
  /** Je li dijagnoza dana već pokupljena (otvorena na Dan). */
  diagnosisSeen: boolean;
};

/**
 * Razlozi za večernji podsjetnik (koncept: "ležeran podsjetnik samo ako si zaboravio na app"):
 * neprijavljeni blokovi; sutra nema plana; dan je riješen, a dijagnoza nije pokupljena.
 * Prazan popis = ne treba podsjetnik.
 */
export function eveningReminderNeeds({ blocks, tomorrowHasPlan, diagnosisSeen }: EveningNeedsInput): EveningNeed[] {
  const needs: EveningNeed[] = [];
  if (blocks.some(isUnresolved)) needs.push('report');
  if (!tomorrowHasPlan) needs.push('tomorrow');
  if (isDayResolved(blocks) && !diagnosisSeen) needs.push('diagnosis');
  return needs;
}

/** Treba li Dan ponuditi pokupljanje dijagnoze (dan riješen, dijagnoza još nije viđena). */
export function shouldOfferDiagnosis(blocks: readonly StatusBlock[], diagnosisSeen: boolean): boolean {
  return isDayResolved(blocks) && !diagnosisSeen;
}
