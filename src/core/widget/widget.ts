/**
 * Home-screen widget (korak 41) — čista logika, bez React importa.
 *
 * Widget se crta u izoliranom runtimeu (`expo-widgets`, direktiva `'widget'`): nema i18n-a, tema
 * ni pristupa bazi, pa mu app šalje sve gotovo — tekstove, boje i vremensku crtu (timeline).
 * iOS sam mijenja zapise u zadano vrijeme, pa widget pokazuje trenutnu i sljedeću aktivnost i
 * kad app nije otvoren. Kad dan prođe (ponoć), zadnji zapis traži otvaranje appa.
 */
import type { ScheduleBlock } from '../domain';
import { emberColor, emberLevel, type EmberLevel } from '../ember';
import { daySchedule, isCancelled } from '../schedule/now-view';
import { blockRange } from '../schedule/timeline';
import { DEFAULT_COLOR_THEME, flamePalettes, palette, type FlamePalette } from '../theme';

export type WidgetBlock = Pick<ScheduleBlock, 'id' | 'title' | 'start' | 'end' | 'kind' | 'status'>;

/** Tekstovi za widget, već prevedeni (HR/EN) u appu. */
export type WidgetLabels = {
  now: string;
  next: string;
  /** Ništa ne traje sada. */
  free: string;
  /** Nema više aktivnosti danas. */
  dayDone: string;
  /** Nema plana za danas. */
  noPlan: string;
  /** Novi dan, widget ne zna plan — otvori app. */
  openApp: string;
  /** Kratica za niz, npr. „dana“ / „days“. */
  streakUnit: string;
};

/** Boje za jednu shemu; widget bira po `environment.colorScheme`. */
export type WidgetColors = {
  background: string;
  text: string;
  muted: string;
  accent: string;
  /** Ispuna žara dana; `null` = ugašen žar (samo obrub `emberOn`). */
  ember: string | null;
  emberOn: string;
};

export type WidgetProps = {
  /** Lokalni datum dana na koji se zapis odnosi ("YYYY-MM-DD"). */
  date: string;
  /** Zapis iza ponoći: dan je prošao, plan novog dana widget ne zna. */
  stale: boolean;
  score: number | null;
  ember: EmberLevel;
  streak: number;
  /** Odrađene aktivnosti / sve aktivnosti dana (bez sna i otkazanih). */
  done: number;
  total: number;
  current: { title: string; start: string; end: string } | null;
  next: { title: string; start: string } | null;
  labels: WidgetLabels;
  light: WidgetColors;
  dark: WidgetColors;
};

export type WidgetEntry = { date: Date; props: WidgetProps };

export type WidgetDayInput = {
  /** Lokalni datum dana ("YYYY-MM-DD"). */
  date: string;
  blocks: readonly WidgetBlock[];
  /** Rezultat dana 0–100 (živi ili konačni), `null` kad ga još nema. */
  score: number | null;
  streak: number;
  labels: WidgetLabels;
  flame?: FlamePalette;
};

/** iOS ne voli dugačke vremenske crte; dan rijetko ima više promjena od ovoga. */
export const MAX_WIDGET_ENTRIES = 48;

function colors(level: EmberLevel, scheme: 'light' | 'dark', flame: FlamePalette): WidgetColors {
  const ember = emberColor(level, scheme, flame);
  return scheme === 'dark'
    ? {
        background: palette.ink950,
        text: palette.ink50,
        muted: palette.ink400,
        accent: flame.ember400,
        ember: ember.fill,
        emberOn: ember.on,
      }
    : {
        background: palette.white,
        text: palette.ink950,
        muted: palette.ink500,
        accent: flame.flame600,
        ember: ember.fill,
        emberOn: ember.on,
      };
}

function countable(block: WidgetBlock): boolean {
  return block.kind !== 'sleep' && !isCancelled(block);
}

/** Zapis widgeta za trenutak `nowSeconds` (sekunde od ponoći) dana `input.date`. */
export function widgetProps(input: WidgetDayInput, nowSeconds: number, stale = false): WidgetProps {
  const flame = input.flame ?? flamePalettes[DEFAULT_COLOR_THEME];
  const ember = emberLevel(input.score);
  const blocks = input.blocks.filter((block) => blockRange(block) !== null);
  const counted = blocks.filter(countable);
  const view = stale ? null : daySchedule(blocks, nowSeconds);
  return {
    date: input.date,
    stale,
    score: input.score === null ? null : Math.round(input.score),
    ember,
    streak: Math.max(0, Math.floor(input.streak)),
    done: counted.filter((block) => block.status === 'done').length,
    total: counted.length,
    current: view?.current
      ? { title: view.current.title, start: view.current.start, end: view.current.end }
      : null,
    next: view?.next ? { title: view.next.title, start: view.next.start } : null,
    labels: input.labels,
    light: colors(ember, 'light', flame),
    dark: colors(ember, 'dark', flame),
  };
}

function atMinute(day: Date, minutes: number): Date {
  const date = new Date(day);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date;
}

/**
 * Vremenska crta widgeta od `now` do kraja dana: zapis sada, zatim na svakom početku i kraju
 * aktivnosti (tada se mijenja „Sada“ / „Sljedeće“), i zapis u ponoć koji traži otvaranje appa.
 * `now` mora biti na dan `input.date` (lokalno vrijeme).
 */
export function widgetTimeline(input: WidgetDayInput, now: Date): WidgetEntry[] {
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const nowMinutes = Math.floor(nowSeconds / 60);

  const changes = new Set<number>();
  for (const block of input.blocks) {
    if (!countable(block)) continue;
    const range = blockRange(block);
    if (!range) continue;
    if (range.start > nowMinutes) changes.add(range.start);
    if (range.end > nowMinutes && range.end < 24 * 60) changes.add(range.end);
  }
  const minutes = [...changes].sort((a, b) => a - b).slice(0, MAX_WIDGET_ENTRIES - 2);

  const entries: WidgetEntry[] = [{ date: new Date(now), props: widgetProps(input, nowSeconds) }];
  for (const minute of minutes) {
    entries.push({ date: atMinute(now, minute), props: widgetProps(input, minute * 60) });
  }
  entries.push({ date: atMinute(now, 24 * 60), props: widgetProps(input, 0, true) });
  return entries;
}
