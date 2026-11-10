/**
 * Akcije obavijesti i tumačenje odgovora korisnika. Čista logika: bez Reacta i bez expo-notifications —
 * integracija samo prosljeđuje `actionIdentifier` i `data` iz odgovora.
 */
import { NOTIFICATION_KINDS, type NotificationKind } from './triggers';

/**
 * Kategorija za podsjetnike blokova (Gotovo / Odgodi / Iskrslo).
 * Paket zabranjuje `:` i `-` u id-ju kategorije.
 */
export const BLOCK_CATEGORY_ID = 'block';

/** Akcije na obavijesti bloka, redom kako se prikazuju. */
export const BLOCK_ACTIONS = ['done', 'snooze', 'cameUp'] as const;
export type BlockAction = (typeof BLOCK_ACTIONS)[number];

/** Otvara li gumb app (odluka P27): samo Iskrslo — Gotovo i Odgodi se obrade u pozadini. */
export function blockActionOpensApp(action: BlockAction): boolean {
  return action === 'cameUp';
}

/**
 * Treba li registrirati pozadinski zadatak expo-notifications za gumbe podsjetnika. Samo Android:
 * na iOS-u taj zadatak služi isključivo za push obavijesti s poslužitelja (traži `remote-notification`
 * i APNs, dakle plaćeni Apple račun) i nikad se ne pokreće za lokalne podsjetnike — tamo odgovor
 * stiže u listener / `getLastNotificationResponseAsync`. Registracija na iOS-u je samo bacala grešku
 * (prijavljeno s iPhonea, 2026-11-10).
 */
export function usesBackgroundNotificationTask(platform: string): boolean {
  return platform === 'android';
}

/** Oznaka izvora u `data` da razlikujemo naše obavijesti od tuđih. */
export const NOTIFICATION_SOURCE = 'ritam';

export type DailyNotificationData = {
  source: typeof NOTIFICATION_SOURCE;
  type: 'daily';
  kind: NotificationKind;
  triggerId: string;
};

export type BlockNotificationData = {
  source: typeof NOTIFICATION_SOURCE;
  type: 'block';
  blockId: string;
};

export type NotificationData = DailyNotificationData | BlockNotificationData;

export function dailyNotificationData(kind: NotificationKind, triggerId: string): DailyNotificationData {
  return { source: NOTIFICATION_SOURCE, type: 'daily', kind, triggerId };
}

export function blockNotificationData(blockId: string): BlockNotificationData {
  return { source: NOTIFICATION_SOURCE, type: 'block', blockId };
}

/** Što app treba napraviti nakon što korisnik dotakne obavijest ili gumb na njoj. */
export type NotificationIntent =
  | { type: 'open'; kind: NotificationKind }
  | { type: 'openBlock'; blockId: string }
  | { type: 'blockAction'; action: BlockAction; blockId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

function isBlockAction(value: string): value is BlockAction {
  return (BLOCK_ACTIONS as readonly string[]).includes(value);
}

/** Provjerava i sužava `data` obavijesti; tuđe ili neispravne → `null`. */
export function parseNotificationData(data: unknown): NotificationData | null {
  if (!isRecord(data) || data.source !== NOTIFICATION_SOURCE) return null;
  if (data.type === 'daily' && isKind(data.kind) && typeof data.triggerId === 'string') {
    return dailyNotificationData(data.kind, data.triggerId);
  }
  if (data.type === 'block' && typeof data.blockId === 'string' && data.blockId.length > 0) {
    return blockNotificationData(data.blockId);
  }
  return null;
}

/**
 * Pretvara odgovor na obavijest u namjeru. `defaultActionId` je id običnog dodira
 * (u expo-notifications `DEFAULT_ACTION_IDENTIFIER`). Nepoznato → `null`.
 */
export function parseNotificationResponse(
  actionId: string,
  data: unknown,
  defaultActionId: string,
): NotificationIntent | null {
  const parsed = parseNotificationData(data);
  if (parsed === null) return null;
  if (parsed.type === 'daily') {
    return actionId === defaultActionId ? { type: 'open', kind: parsed.kind } : null;
  }
  if (actionId === defaultActionId) return { type: 'openBlock', blockId: parsed.blockId };
  return isBlockAction(actionId) ? { type: 'blockAction', action: actionId, blockId: parsed.blockId } : null;
}
