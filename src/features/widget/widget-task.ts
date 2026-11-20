/**
 * Korak 41 (Android): pozadinsko osvježavanje widgeta „Ritam — Dan“. Widget na Androidu nema
 * vremensku crtu, pa bi dok app ne radi pokazivao staro „Sada“. WorkManager (`expo-background-task`)
 * otprilike svakih 15 minuta pokrene ovaj zadatak, koji zapiše novu snimku.
 *
 * Zadatak mora biti definiran u opsegu modula koji se učita rano — zato ga uvozi `index.ts`.
 * `expo-background-task` se uvozi tek kad build ima njegov native modul (stari development build,
 * iOS i web ne rade ništa i ne ruše se).
 */
import { requireOptionalNativeModule } from 'expo';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  usesWidgetBackgroundRefresh,
  WIDGET_BACKGROUND_INTERVAL_MINUTES,
  WIDGET_REFRESH_TASK,
} from '@/core/widget/background';

const supported = usesWidgetBackgroundRefresh(Platform.OS);

/** Vrijednosti `BackgroundTaskResult` (Success = 1, Failed = 2) — bez uvoza paketa pri pokretanju. */
const TASK_SUCCESS = 1;
const TASK_FAILED = 2;

/** Tijelo zadatka (izdvojeno za testove). */
export async function runWidgetRefreshTask(
  // Lijeni import: ulaz appa ne vuče bazu i widget prije Expo Routera.
  importRefresh: () => Promise<typeof import('./widget-background')> = () => import('./widget-background'),
): Promise<number> {
  try {
    const { refreshWidgetInBackground } = await importRefresh();
    await refreshWidgetInBackground(Platform.OS);
    return TASK_SUCCESS;
  } catch (cause: unknown) {
    console.error('Background widget refresh failed', cause);
    return TASK_FAILED;
  }
}

if (supported && !TaskManager.isTaskDefined(WIDGET_REFRESH_TASK)) {
  TaskManager.defineTask(WIDGET_REFRESH_TASK, () => runWidgetRefreshTask());
}

let registering: Promise<boolean> | null = null;

/**
 * Registriraj periodično osvježavanje (jednom po pokretanju; već registriran zadatak se ne
 * dira, da WorkManager ne krene ispočetka). Zove ga `WidgetSync` tek kad widget postoji u buildu.
 */
export function registerWidgetRefresh(
  importBackgroundTask: () => Promise<typeof import('expo-background-task')> = () => import('expo-background-task'),
): Promise<boolean> {
  if (!supported) return Promise.resolve(false);
  if (requireOptionalNativeModule('ExpoBackgroundTask') === null) return Promise.resolve(false);
  registering ??= (async () => {
    const BackgroundTask = await importBackgroundTask();
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (await TaskManager.isTaskRegisteredAsync(WIDGET_REFRESH_TASK)) return true;
    await BackgroundTask.registerTaskAsync(WIDGET_REFRESH_TASK, {
      minimumInterval: WIDGET_BACKGROUND_INTERVAL_MINUTES,
    });
    return true;
  })().catch((cause: unknown) => {
    registering = null;
    console.error('Registering the widget refresh task failed', cause);
    return false;
  });
  return registering;
}

/** Samo za testove. */
export function resetWidgetTaskForTests(): void {
  registering = null;
}
