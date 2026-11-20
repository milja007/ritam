import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useBlocksVersion } from '@/features/notifications';
import { useProgressVersion } from '@/features/progress';
import i18n from '@/i18n';
import { useColorTheme } from '@/ui/theme';

import { loadWidgetInput } from './widget-content';
import { loadRitamDayWidget } from './widget-native';
import { pushWidgetUpdate } from './widget-refresh';
import { registerWidgetRefresh } from './widget-task';

/**
 * Korak 41: drži widget „Ritam — Dan“ svježim — pri pokretanju, promjeni blokova ili rezultata,
 * povratku u app i promjeni jezika ili teme. iOS dobiva vremensku crtu dana (`updateTimeline`);
 * Android je nema, pa dobiva snimku (`updateSnapshot`) i, dok app radi, novu na svakoj sljedećoj
 * promjeni „Sada“ / „Sljedeće“; dok app ne radi, snimku obnavlja pozadinski zadatak
 * (`widget-task.ts`, registrira se ovdje). Bez widgeta u buildu ne radi ništa.
 */
export function WidgetSync() {
  const blocksVersion = useBlocksVersion();
  const progressVersion = useProgressVersion();
  const theme = useColorTheme();
  const [tick, setTick] = useState(0);
  const [language, setLanguage] = useState(i18n.language);

  useEffect(() => {
    const onLanguage = (next: string) => setLanguage(next);
    i18n.on('languageChanged', onLanguage);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((value) => value + 1);
    });
    return () => {
      i18n.off('languageChanged', onLanguage);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const widget = await loadRitamDayWidget();
      if (!widget || !alive) return;
      void registerWidgetRefresh();
      const now = new Date();
      try {
        const input = await loadWidgetInput(now, i18n.getFixedT(language), theme);
        if (!alive) return;
        const wait = pushWidgetUpdate(widget, input, now, Platform.OS);
        if (wait !== null) timer = setTimeout(() => setTick((value) => value + 1), wait);
      } catch (error: unknown) {
        console.error('Updating the widget failed', error);
      }
    })();
    return () => {
      alive = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [blocksVersion, progressVersion, theme, language, tick]);

  return null;
}
