import { nextWidgetChange, widgetProps, widgetTimeline, type WidgetDayInput } from '@/core/widget';

import type { RitamDayWidget } from './widget-native';

/** Najdulje čekanje do sljedećeg osvježavanja (setTimeout ne voli jako duge odgode). */
export const MAX_WAIT_MS = 6 * 60 * 60 * 1000;

/**
 * Zapiši stanje dana u widget. iOS dobiva vremensku crtu (`updateTimeline`) i vraća `null` — sam
 * mijenja zapise. Android dobiva snimku i vraća za koliko ms se „Sada“ / „Sljedeće“ mijenja
 * (app tada, dok radi, zapiše novu; inače to radi pozadinski zadatak).
 */
export function pushWidgetUpdate(
  widget: RitamDayWidget,
  input: WidgetDayInput,
  now: Date,
  os: string,
): number | null {
  if (os === 'ios' && widget.updateTimeline) {
    // iOS sam mijenja zapise u zadano vrijeme; u ponoć zapis traži otvaranje appa.
    widget.updateTimeline(widgetTimeline(input, now));
    return null;
  }
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  widget.updateSnapshot(widgetProps(input, seconds));
  return Math.min(MAX_WAIT_MS, Math.max(1000, nextWidgetChange(input.blocks, now).getTime() - now.getTime()));
}
