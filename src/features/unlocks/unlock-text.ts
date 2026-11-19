import type { TFunction } from 'i18next';

import type { Unlock } from '@/core/gamification';

/** Ime otključanog (bez vrste): „Zora“, „Rani ptić“, „Žeravice“, „Iskre“. */
export function unlockName(t: TFunction, unlock: Unlock): string {
  switch (unlock.kind) {
    case 'theme':
      return t(`unlocks.themes.${unlock.theme}`);
    case 'title':
      return t(`unlocks.titles.${unlock.title}`);
    case 'frame':
      return t(`unlocks.frames.${unlock.frame}`);
    case 'doneEffect':
      return t(`unlocks.doneEffects.${unlock.effect}`);
  }
}

/** Naziv otključanog unutar rečenice: „tema „Zora““, „okvir „Žeravice““. */
export function unlockInline(t: TFunction, unlock: Unlock): string {
  return t(`unlocks.inline.${unlock.kind}`, { name: unlockName(t, unlock) });
}

/** Redak na popisu otključanog: „Tema „Zora““, „Animacija „Gotovo“: Iskre“. */
export function unlockRow(t: TFunction, unlock: Unlock): string {
  return t(`unlocks.levelUp.rows.${unlock.kind}`, { name: unlockName(t, unlock) });
}

/** „Razina 3 otključava: tema „Zora““ ili poruka da je sve otključano. */
export function nextUnlockText(t: TFunction, next: { level: number; unlocks: readonly Unlock[] } | null): string {
  if (next === null) return t('unlocks.allUnlocked');
  const what = next.unlocks.map((unlock) => unlockInline(t, unlock)).join(t('unlocks.listJoin'));
  return t('unlocks.next', { level: next.level, what });
}
