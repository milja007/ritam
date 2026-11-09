import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  blockActionEffect,
  blockReminderBudget,
  DEFAULT_SCHEDULE_DAYS,
  parseNotificationResponse,
  upcomingTriggers,
  type BlockAction,
} from '@/core/notifications';
import { addDays, localDateOf } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getBlock, getSettings, listBlocksBetween, setBlockStatus } from '@/db/repos';
import i18n, { languageFor } from '@/i18n';

import {
  blockTexts,
  dailyTexts,
  dismissNotification,
  ensurePermission,
  expoScheduler,
  installForegroundHandler,
  notificationsSupported,
  registerChannelsAndCategories,
} from './expo-notifications';
import { notifyBlocksChanged, requestEveningCheckin, requestOpenBlock } from './open-requests';
import {
  cancelBlockReminders,
  cancelDailyNotifications,
  scheduleSnooze,
  syncBlockReminders,
  syncDailyNotifications,
} from './sync';

installForegroundHandler();

let running: Promise<void> | null = null;
let again = false;

async function syncOnce(): Promise<void> {
  const db = getDb();
  const settings = await getSettings(db, LOCAL_USER_ID);
  if (settings === null) return;
  const t = i18n.getFixedT(languageFor(settings.language));
  await registerChannelsAndCategories(t);
  const permission = await ensurePermission();
  if (permission !== 'allowed') {
    await cancelDailyNotifications(expoScheduler);
    await cancelBlockReminders(expoScheduler);
    return;
  }
  const now = new Date();
  await syncDailyNotifications(expoScheduler, settings, now, dailyTexts(t));

  // Podsjetnici blokova u istom horizontu kao dnevne obavijesti, u ostatku limita iOS-a.
  const today = localDateOf(now);
  const last = addDays(today, DEFAULT_SCHEDULE_DAYS - 1) ?? today;
  const blocks = await listBlocksBetween(db, LOCAL_USER_ID, today, last);
  const dailyCount = upcomingTriggers(settings, now)?.length ?? 0;
  await syncBlockReminders(expoScheduler, blocks, now, blockReminderBudget(dailyCount), blockTexts(t));
}

/**
 * Učita postavke i blokove, osigura dopuštenje i uskladi zakazane dnevne obavijesti i podsjetnike
 * blokova. Poziv tijekom rada zakaže još jedan prolaz (da se promjena blokova ne izgubi).
 * Pozovi nakon promjene postavki ili blokova.
 */
export function syncNotificationsNow(): Promise<void> {
  if (!notificationsSupported) return Promise.resolve();
  if (running !== null) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } catch (error: unknown) {
      console.error('Scheduling notifications failed', error);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Gotovo / Odgodi / Iskrslo na podsjetniku bloka. */
async function handleBlockAction(action: BlockAction, blockId: string, notificationId: string): Promise<void> {
  const db = getDb();
  const block = await getBlock(db, LOCAL_USER_ID, blockId);
  const now = new Date();
  const effect = blockActionEffect(block, action, now);
  await dismissNotification(notificationId);
  if (block === null) return;
  switch (effect.type) {
    case 'markDone':
      // Isti put kao kvačica na timelineu: status + XP zadatka u jednoj transakciji, bez dupliciranja.
      setBlockStatus(db, LOCAL_USER_ID, blockId, 'done');
      notifyBlocksChanged();
      await syncNotificationsNow();
      return;
    case 'snooze': {
      const settings = await getSettings(db, LOCAL_USER_ID);
      const t = i18n.getFixedT(settings ? languageFor(settings.language) : i18n.language);
      await scheduleSnooze(expoScheduler, block, effect.fireAt, blockTexts(t));
      return;
    }
    case 'openBlock':
      requestOpenBlock(blockId);
      return;
    case 'none':
      return;
  }
}

/**
 * Što napraviti kad korisnik dotakne obavijest ili gumb na njoj. Večernja obavijest otvara večernji
 * upit (tab Danas preuzima zahtjev); dodir podsjetnika samo otvara app na Danas; akcije bloka
 * vidi `handleBlockAction`. Jutarnji brief (korak 14) još ne postoji — tada se app samo otvori.
 */
function handleResponse(response: Notifications.NotificationResponse): void {
  const intent = parseNotificationResponse(
    response.actionIdentifier,
    response.notification.request.content.data,
    Notifications.DEFAULT_ACTION_IDENTIFIER,
  );
  if (intent === null) return;
  if (__DEV__) console.info('Notification intent', intent);
  if (intent.type === 'open' && intent.kind === 'evening') requestEveningCheckin();
  if (intent.type === 'blockAction') {
    handleBlockAction(intent.action, intent.blockId, response.notification.request.identifier).catch(
      (error: unknown) => console.error('Block notification action failed', error),
    );
  }
}

/**
 * Nevidljiva komponenta nakon onboardinga: zakazuje obavijesti pri otvaranju appa i pri svakom
 * povratku u prvi plan te sluša odgovore na obavijesti.
 */
export function NotificationsSync() {
  useEffect(() => {
    if (!notificationsSupported) return;
    void syncNotificationsNow();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNotificationsNow();
    });

    // Hladni start iz obavijesti: odgovor je stigao prije nego što je slušatelj postojao.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response === null) return;
      handleResponse(response);
      void Notifications.clearLastNotificationResponseAsync();
    });
    const responses = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      appState.remove();
      responses.remove();
    };
  }, []);

  return null;
}
