import { describe, expect, it } from '@jest/globals';

import { flamePalettes } from '../theme';
import { MAX_WIDGET_ENTRIES, widgetProps, widgetTimeline, type WidgetBlock, type WidgetDayInput } from './widget';

const labels = {
  now: 'Sada',
  next: 'Sljedeće',
  free: 'Slobodno',
  dayDone: 'Dan je odrađen',
  noPlan: 'Nema plana',
  openApp: 'Otvori Ritam',
  streakUnit: 'dana',
};

function block(id: string, start: string, end: string, extra: Partial<WidgetBlock> = {}): WidgetBlock {
  return { id, title: id, start, end, kind: 'task', status: 'planned', ...extra };
}

function input(blocks: WidgetBlock[], extra: Partial<WidgetDayInput> = {}): WidgetDayInput {
  return { date: '2026-11-19', blocks, score: null, streak: 4, labels, ...extra };
}

const at = (h: number, m = 0) => new Date(2026, 10, 19, h, m, 0);

describe('widgetProps', () => {
  it('shows the current and next activity and counts done ones without sleep or cancelled', () => {
    const props = widgetProps(
      input([
        block('San', '23:00', '07:00', { kind: 'sleep' }),
        block('Trening', '07:30', '08:30', { status: 'done' }),
        block('Posao', '09:00', '17:00'),
        block('Kava', '10:00', '10:30', { status: 'skipped' }),
        block('Učenje', '18:00', '19:00'),
      ]),
      9 * 3600 + 15 * 60,
    );
    expect(props.current).toEqual({ title: 'Posao', start: '09:00', end: '17:00' });
    expect(props.next).toEqual({ title: 'Učenje', start: '18:00' });
    expect(props.done).toBe(1);
    expect(props.total).toBe(3);
    expect(props.stale).toBe(false);
  });

  it('maps the score to an ember and rounds it; no score is an unlit ember', () => {
    expect(widgetProps(input([], { score: 86.4 }), 0)).toMatchObject({ score: 86, ember: 'bright' });
    const unlit = widgetProps(input([]), 0);
    expect(unlit).toMatchObject({ score: null, ember: 'unlit' });
    expect(unlit.dark.ember).toBeNull();
    expect(unlit.light.ember).toBeNull();
  });

  it('carries colours for both schemes and follows the flame theme', () => {
    const azure = flamePalettes.azure;
    const props = widgetProps(input([], { score: 90, flame: azure }), 0);
    expect(props.dark.accent).toBe(azure.ember400);
    expect(props.light.accent).toBe(azure.flame600);
    expect(props.dark.ember).toBe(azure.ember200);
    expect(props.dark.background).not.toBe(props.light.background);
  });

  it('a stale entry knows nothing about the plan of the new day', () => {
    const props = widgetProps(input([block('Posao', '00:00', '17:00')]), 0, true);
    expect(props.current).toBeNull();
    expect(props.next).toBeNull();
    expect(props.stale).toBe(true);
  });

  it('never shows a negative streak', () => {
    expect(widgetProps(input([], { streak: -2 }), 0).streak).toBe(0);
  });
});

describe('widgetTimeline', () => {
  it('has an entry now, at every future start and end, and a stale one at midnight', () => {
    const entries = widgetTimeline(
      input([block('Trening', '07:30', '08:30'), block('Posao', '09:00', '17:00'), block('Učenje', '16:30', '18:00')]),
      at(8, 0),
    );
    expect(entries.map((entry) => [entry.date.getHours(), entry.date.getMinutes()])).toEqual([
      [8, 0],
      [8, 30],
      [9, 0],
      [16, 30],
      [17, 0],
      [18, 0],
      [0, 0],
    ]);
    expect(entries[0]?.props.current?.title).toBe('Trening');
    expect(entries[1]?.props).toMatchObject({ current: null, next: { title: 'Posao' } });
    expect(entries[3]?.props.current?.title).toBe('Učenje'); // kasniji početak pobjeđuje
    expect(entries[4]?.props.current?.title).toBe('Učenje');
    expect(entries[5]?.props).toMatchObject({ current: null, next: null, stale: false });
    const midnight = entries[entries.length - 1];
    expect(midnight?.props.stale).toBe(true);
    expect(midnight?.date.getDate()).toBe(20);
  });

  it('ignores sleep, cancelled blocks and changes in the past', () => {
    const entries = widgetTimeline(
      input([
        block('San', '22:30', '06:30', { kind: 'sleep' }),
        block('Jutro', '06:00', '07:00'),
        block('Otkazano', '12:00', '13:00', { status: 'skipped' }),
        block('Večer', '20:00', '21:00'),
      ]),
      at(10, 0),
    );
    expect(entries.map((entry) => entry.date.getHours())).toEqual([10, 20, 21, 0]);
  });

  it('caps the number of entries', () => {
    const many = Array.from({ length: 60 }, (_, index) => {
      const minute = 6 * 60 + index * 15;
      const clock = (value: number) =>
        `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
      return block(`b${index}`, clock(minute), clock(minute + 10));
    });
    const entries = widgetTimeline(input(many), at(5, 0));
    expect(entries).toHaveLength(MAX_WIDGET_ENTRIES);
    const last = entries[entries.length - 1];
    expect(last?.props.stale).toBe(true);
    // Zadnji zadržani zapis je 11:40; widget postaje zastario na prvoj izostavljenoj
    // promjeni (11:45), a ne tek u ponoć s krivim „Sada“ / „Sljedeće“.
    expect(entries[entries.length - 2]?.date.getHours()).toBe(11);
    expect(entries[entries.length - 2]?.date.getMinutes()).toBe(40);
    expect(last?.date.getHours()).toBe(11);
    expect(last?.date.getMinutes()).toBe(45);
  });

  it('an empty day still has now and midnight', () => {
    const entries = widgetTimeline(input([]), at(12, 0));
    expect(entries).toHaveLength(2);
    expect(entries[0]?.props).toMatchObject({ total: 0, current: null, next: null });
  });
});
