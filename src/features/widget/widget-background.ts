import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getSettings } from '@/db/repos';
import i18n, { languageFor } from '@/i18n';
import { getColorTheme } from '@/ui/theme';

import { loadWidgetInput } from './widget-content';
import { loadRitamDayWidget } from './widget-native';
import { pushWidgetUpdate } from './widget-refresh';

/**
 * Jedno pozadinsko osvježavanje widgeta (Android, `widget-task.ts`). App možda nije pokrenut,
 * pa jezik dolazi iz spremljenih postavki (ne iz trenutnog stanja i18n-a), a tema s uređaja.
 * Vraća `false` kad widgeta nema u buildu.
 */
export async function refreshWidgetInBackground(os: string, now: Date = new Date()): Promise<boolean> {
  const widget = await loadRitamDayWidget();
  if (!widget) return false;
  const settings = await getSettings(getDb(), LOCAL_USER_ID);
  const language = settings ? languageFor(settings.language) : i18n.language;
  const input = await loadWidgetInput(now, i18n.getFixedT(language), getColorTheme());
  pushWidgetUpdate(widget, input, now, os);
  return true;
}
