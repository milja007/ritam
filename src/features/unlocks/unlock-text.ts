import type { TFunction } from 'i18next';

import type { Unlock } from '@/core/gamification';

/** Naziv otključanog unutar rečenice: „tema „Zora““, „naslov „Rani ptić““. */
export function unlockInline(t: TFunction, unlock: Unlock): string {
  return unlock.kind === 'theme'
    ? t('unlocks.theme', { name: t(`unlocks.themes.${unlock.theme}`) })
    : t('unlocks.title', { name: t(`unlocks.titles.${unlock.title}`) });
}

/** Redak na popisu otključanog: „Tema „Zora““, „Naslov „Rani ptić““. */
export function unlockRow(t: TFunction, unlock: Unlock): string {
  return unlock.kind === 'theme'
    ? t('unlocks.levelUp.themeRow', { name: t(`unlocks.themes.${unlock.theme}`) })
    : t('unlocks.levelUp.titleRow', { name: t(`unlocks.titles.${unlock.title}`) });
}

/** „Razina 3 otključava: tema „Zora““ ili poruka da je sve otključano. */
export function nextUnlockText(t: TFunction, next: { level: number; unlocks: readonly Unlock[] } | null): string {
  if (next === null) return t('unlocks.allUnlocked');
  const what = next.unlocks.map((unlock) => unlockInline(t, unlock)).join(t('unlocks.listJoin'));
  return t('unlocks.next', { level: next.level, what });
}
