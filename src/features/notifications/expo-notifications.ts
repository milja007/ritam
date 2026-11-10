/**
 * Jedino mjesto koje izravno zove expo-notifications: handler u prvom planu, Android kanal,
 * kategorija akcija bloka, dopuštenje i adapter za zakazivanje.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';

import {
  BLOCK_ACTIONS,
  BLOCK_CATEGORY_ID,
  blockActionOpensApp,
  decidePermission,
  type NotificationKind,
  type PermissionDecision,
} from '@/core/notifications';

import {
  BLOCKS_CHANNEL_ID,
  DAILY_CHANNEL_ID,
  type BlockReminderTexts,
  type DailyNotificationTexts,
  type NotificationScheduler,
} from './sync';

/** Obavijesti rade samo na iOS-u i Androidu (web nema lokalne obavijesti ni bazu). */
export const notificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Dok je app otvoren, obavijest se i dalje prikaže (inače bi ju sustav progutao). */
export function installForegroundHandler(): void {
  if (!notificationsSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Android kanal i kategorija akcija (Gotovo / Odgodi / Iskrslo) s prevedenim gumbima.
 * Kanal mora postojati prije traženja dopuštenja na Androidu 13+.
 */
export async function registerChannelsAndCategories(t: TFunction): Promise<void> {
  if (!notificationsSupported) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
      name: t('notifications.channel.daily'),
      importance: AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(BLOCKS_CHANNEL_ID, {
      name: t('notifications.channel.blocks'),
      importance: AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(
    BLOCK_CATEGORY_ID,
    BLOCK_ACTIONS.map((action) => ({
      identifier: action,
      buttonTitle: t(`notifications.actions.${action}`),
      // Gotovo i Odgodi rade bez otvaranja appa (odluka P27); Iskrslo otvara app.
      options: { opensAppToForeground: blockActionOpensApp(action) },
    })),
  );
}

/** Provjeri dopuštenje; pitaj samo ako korisnik još nije odlučio. */
export async function ensurePermission(): Promise<PermissionDecision> {
  if (!notificationsSupported) return 'denied';
  const read = async () => {
    const current = await Notifications.getPermissionsAsync();
    return decidePermission({
      status: current.status,
      granted: current.granted,
      canAskAgain: current.canAskAgain,
      iosProvisional: current.ios?.status === IosAuthorizationStatus.PROVISIONAL,
    });
  };
  const decision = await read();
  if (decision !== 'ask') return decision;
  const answer = await Notifications.requestPermissionsAsync();
  return decidePermission({
    status: answer.status,
    granted: answer.granted,
    // Upravo smo pitali — ne pitaj ponovo u istoj sesiji.
    canAskAgain: false,
    iosProvisional: answer.ios?.status === IosAuthorizationStatus.PROVISIONAL,
  });
}

/** Tekstovi dnevnih obavijesti na zadanom jeziku. */
export function dailyTexts(t: TFunction): DailyNotificationTexts {
  const text = (kind: NotificationKind) => ({
    title: t(`notifications.${kind}.title`),
    body: t(`notifications.${kind}.body`),
  });
  return { morning: text('morning'), evening: text('evening'), windDown: text('windDown') };
}

/** Tekstovi podsjetnika blokova na zadanom jeziku. */
export function blockTexts(t: TFunction): BlockReminderTexts {
  return {
    body: ({ start, end }) => t('notifications.block.body', { start, end }),
    snoozedBody: ({ start, end }) => t('notifications.block.snoozedBody', { start, end }),
  };
}

/** Makni prikazanu obavijest iz centra obavijesti (nakon akcije na njoj). */
export async function dismissNotification(identifier: string): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.dismissNotificationAsync(identifier);
}

export const expoScheduler: NotificationScheduler = {
  async scheduledIds() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.map((request) => request.identifier);
  },
  async cancel(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
  async schedule(request) {
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: {
        title: request.title,
        body: request.body,
        data: request.data,
        ...(request.categoryId === undefined ? {} : { categoryIdentifier: request.categoryId }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.fireAt,
        channelId: request.channelId,
      },
    });
  },
};
