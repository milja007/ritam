import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { nextWidgetChange, widgetProps, widgetTimeline } from '@/core/widget';
import { useBlocksVersion } from '@/features/notifications';
import { useProgressVersion } from '@/features/progress';
import i18n from '@/i18n';
import { useColorTheme } from '@/ui/theme';

import { loadWidgetInput } from './widget-content';
import { loadRitamDayWidget } from './widget-native';

/** Najdulje čekanje do sljedećeg osvježavanja (setTimeout ne voli jako duge odgode). */
const MAX_WAIT_MS = 6 * 60 * 60 * 1000;

/**
 * Korak 41: drži widget „Ritam — Dan“ svježim — pri pokretanju, promjeni blokova ili rezultata,
 * povratku u app i promjeni jezika ili teme. iOS dobiva vremensku crtu dana (`updateTimeline`);
 * Android je nema, pa dobiva snimku (`updateSnapshot`) i, dok app radi, novu na svakoj sljedećoj
 * promjeni „Sada“ / „Sljedeće“. Bez widgeta u buildu ne radi ništa.
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
      const now = new Date();
      try {
        const input = await loadWidgetInput(now, i18n.getFixedT(language), theme);
        if (!alive) return;
        if (Platform.OS === 'ios' && widget.updateTimeline) {
          // iOS sam mijenja zapise u zadano vrijeme; u ponoć zapis traži otvaranje appa.
          widget.updateTimeline(widgetTimeline(input, now));
          return;
        }
        const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        widget.updateSnapshot(widgetProps(input, seconds));
        const wait = Math.min(MAX_WAIT_MS, Math.max(1000, nextWidgetChange(input.blocks, now).getTime() - now.getTime()));
        timer = setTimeout(() => setTick((value) => value + 1), wait);
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
