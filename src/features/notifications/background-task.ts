/**
 * Pozadinska obrada gumba Gotovo / Odgodi na podsjetniku bloka (odluka P27: bez otvaranja appa).
 * Na Androidu expo-notifications pokreće ovaj zadatak kad je app u pozadini ili ugašen; na iOS-u
 * odgovor stiže u `addNotificationResponseReceivedListener` dok app radi u pozadini.
 * Zadatak mora biti definiran u opsegu modula koji se učita rano — zato ga uvozi `index.ts` (ulaz appa).
 */
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const BACKGROUND_NOTIFICATION_TASK = 'ritam-notification-actions';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function isResponse(data: Notifications.NotificationTaskPayload): data is Notifications.NotificationResponse {
  return typeof data === 'object' && data !== null && 'actionIdentifier' in data;
}

if (supported && !TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ data, error }) => {
      if (error || !isResponse(data)) return Notifications.BackgroundNotificationTaskResult.NoData;
      try {
        // Lijeni import: ulaz appa ne vuče cijeli sloj obavijesti prije Expo Routera.
        const { handleResponse } = await import('./notifications-sync');
        await handleResponse(data);
        return Notifications.BackgroundNotificationTaskResult.NewData;
      } catch (cause: unknown) {
        console.error('Background notification action failed', cause);
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }
    },
  );
}

let registered: Promise<void> | null = null;

/** Registriraj zadatak kod expo-notifications (jednom po pokretanju; ponovni poziv ne smeta). */
export function registerBackgroundActions(): Promise<void> {
  if (!supported) return Promise.resolve();
  registered ??= Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    .then(() => undefined)
    .catch((cause: unknown) => {
      registered = null;
      console.error('Registering background notification task failed', cause);
    });
  return registered;
}
