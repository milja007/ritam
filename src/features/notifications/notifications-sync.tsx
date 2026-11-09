import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { parseNotificationResponse, type NotificationIntent } from '@/core/notifications';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getSettings } from '@/db/repos';
import i18n from '@/i18n';

import {
  dailyTexts,
  ensurePermission,
  expoScheduler,
  installForegroundHandler,
  notificationsSupported,
  registerChannelsAndCategories,
} from './expo-notifications';
import { requestEveningCheckin } from './open-requests';
import { cancelDailyNotifications, syncDailyNotifications } from './sync';

installForegroundHandler();

let running: Promise<void> | null = null;

/**
 * Učita postavke, osigura dopuštenje i uskladi zakazane dnevne obavijesti.
 * Istodobni pozivi dijele isti rad. Pozovi i nakon promjene postavki.
 */
export function syncNotificationsNow(): Promise<void> {
  if (!notificationsSupported) return Promise.resolve();
  running ??= (async () => {
    try {
      const settings = await getSettings(getDb(), LOCAL_USER_ID);
      if (settings === null) return;
      const t = i18n.getFixedT(settings.language);
      await registerChannelsAndCategories(t);
      const permission = await ensurePermission();
      if (permission !== 'allowed') {
        await cancelDailyNotifications(expoScheduler);
        return;
      }
      await syncDailyNotifications(expoScheduler, settings, new Date(), dailyTexts(t));
    } catch (error: unknown) {
      console.error('Scheduling notifications failed', error);
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Što napraviti kad korisnik dotakne obavijest. Večernja obavijest otvara večernji upit (tab Danas
 * preuzima zahtjev). Jutarnji brief (korak 14) i učinci akcija bloka (korak 27) još ne postoje —
 * tada se app samo otvori.
 */
function handleIntent(intent: NotificationIntent | null): void {
  if (intent === null) return;
  if (__DEV__) console.info('Notification intent', intent);
  if (intent.type === 'open' && intent.kind === 'evening') requestEveningCheckin();
}

function handleResponse(response: Notifications.NotificationResponse): void {
  handleIntent(
    parseNotificationResponse(
      response.actionIdentifier,
      response.notification.request.content.data,
      Notifications.DEFAULT_ACTION_IDENTIFIER,
    ),
  );
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
