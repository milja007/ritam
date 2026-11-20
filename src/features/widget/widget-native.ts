import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { WidgetProps } from '@/core/widget';

export type RitamDayWidget = { updateSnapshot: (props: WidgetProps) => void };

let loading: Promise<RitamDayWidget | null> | null = null;

/**
 * Widget se učitava **opcionalno**: samo na Androidu (iOS cilj čeka App Group, odluka 94a) i
 * samo kad build ima native modul `ExpoWidgets` — stari development build bez njega i web ne
 * rade ništa, bez rušenja (`expo-widgets` baca pri uvozu kad modula nema).
 */
export function loadRitamDayWidget(
  importWidget: () => Promise<{ default: RitamDayWidget }> = () => import('@/widgets/ritam-day'),
): Promise<RitamDayWidget | null> {
  loading ??= (async () => {
    if (Platform.OS !== 'android') return null;
    if (requireOptionalNativeModule('ExpoWidgets') === null) return null;
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
