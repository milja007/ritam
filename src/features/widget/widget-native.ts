import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { WidgetEntry, WidgetProps } from '@/core/widget';

export type RitamDayWidget = {
  updateSnapshot: (props: WidgetProps) => void;
  /** Samo iOS: vremenska crta (Android je nema). */
  updateTimeline?: (entries: WidgetEntry[]) => void;
};

type WidgetsNativeModule = { widgetsDirectory?: string | null };

/**
 * iOS: widget postoji tek kad build ima cilj widgeta i App Group (`RITAM_IOS_WIDGET=1`, plaćeni
 * Apple račun). Bez App Groupa `widgetsDirectory` je prazan — tada ništa.
 */
function widgetsAvailable(module: WidgetsNativeModule | null): boolean {
  if (module === null) return false;
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') return typeof module.widgetsDirectory === 'string' && module.widgetsDirectory !== '';
  return false;
}

let loading: Promise<RitamDayWidget | null> | null = null;

/**
 * Widget se učitava **opcionalno**: na Androidu kad build ima native modul `ExpoWidgets`, na
 * iOS-u još i App Group (odluka 94a) — stari development build bez njega i web ne
 * rade ništa, bez rušenja (`expo-widgets` baca pri uvozu kad modula nema).
 */
export function loadRitamDayWidget(
  importWidget: () => Promise<{ default: RitamDayWidget }> = () => import('@/widgets/ritam-day'),
): Promise<RitamDayWidget | null> {
  loading ??= (async () => {
    if (!widgetsAvailable(requireOptionalNativeModule<WidgetsNativeModule>('ExpoWidgets'))) return null;
    try {
      const module = await importWidget();
      return module.default;
    } catch (error: unknown) {
      console.error('Loading the widget failed', error);
      return null;
    }
  })();
  return loading;
}

/** Samo za testove. */
export function resetWidgetLoaderForTests(): void {
  loading = null;
}
