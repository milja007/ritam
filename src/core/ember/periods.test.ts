import { describe, expect, it } from '@jest/globals';

import {
  averageScore,
  dayEmber,
  daysInMonth,
  finalScores,
  isoWeek,
  monthGrid,
  nowLine,
  previousMonth,
  segmentLook,
  strongestDay,
  longestStreakInYear,
  strongestMonth,
  weekDates,
  weekSegments,
  yearMonths,
} from './periods';

const TODAY = '2026-11-12'; // četvrtak

function block(over: Partial<Parameters<typeof segmentLook>[0]> = {}) {
  return { id: 'b', date: TODAY, start: '09:00', end: '10:00', kind: 'task', status: 'planned', ...over } as const;
}

describe('dayEmber', () => {
  const scores = finalScores([
    { date: '2026-11-10', score: 74, final: true },
    { date: TODAY, score: 40, final: false },
  ]);

  it('rezultat u tijeku ne pali žar', () => {
    expect(scores.has(TODAY)).toBe(false);
    expect(dayEmber(TODAY, TODAY, scores)).toEqual({ kind: 'today', score: null });
  });

  it('prošli dan svijetli po rezultatu, bez rezultata je ugašen', () => {
    expect(dayEmber('2026-11-10', TODAY, scores)).toEqual({ kind: 'past', level: 'warm', score: 74 });
    expect(dayEmber('2026-11-11', TODAY, scores)).toEqual({ kind: 'past', level: 'unlit', score: null });
  });

  it('budući dan je tek ocrtan', () => {
    expect(dayEmber('2026-11-13', TODAY, scores)).toEqual({ kind: 'future' });
  });
});

describe('tjedan', () => {
  it('weekDates: ponedjeljak do nedjelje', () => {
    expect(weekDates(TODAY)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
    expect(weekDates('nije-datum')).toEqual([]);
  });

  it('isoWeek, uključujući prijelaz godine', () => {
    expect(isoWeek(TODAY)).toBe(46);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53); // petak, pripada zadnjem tjednu 2026.
    expect(isoWeek('2024-12-30')).toBe(1); // ponedjeljak, već tjedan 1 u 2025.
  });

  it('segmentLook: odrađeno, pola, ugašeno, plan i fiksno', () => {
    expect(segmentLook(block({ status: 'done' }), TODAY, 600)).toBe('done');
    expect(segmentLook(block({ status: 'done', kind: 'calendar' }), TODAY, 600)).toBe('fixed');
    expect(segmentLook(block({ status: 'partial' }), TODAY, 600)).toBe('half');
    expect(segmentLook(block({ status: 'skipped' }), TODAY, 0)).toBe('missed');
    expect(segmentLook(block({ status: 'moved' }), TODAY, 0)).toBe('missed');
    expect(segmentLook(block(), TODAY, 8 * 60)).toBe('plan');
    expect(segmentLook(block({ kind: 'fixed' }), TODAY, 8 * 60)).toBe('fixedPlan');
  });

  it('segmentLook: prošlo bez prijave je ugašeno, a blok koji traje još je plan', () => {
    expect(segmentLook(block(), TODAY, 10 * 60)).toBe('missed');
    expect(segmentLook(block(), TODAY, 9 * 60 + 30)).toBe('plan');
    expect(segmentLook(block({ date: '2026-11-11' }), TODAY, 0)).toBe('missed');
    expect(segmentLook(block({ date: '2026-11-13' }), TODAY, 23 * 60)).toBe('plan');
  });

  it('weekSegments: položaj u rasponu 06–24, bez sna i tuđih dana', () => {
    const segments = weekSegments(
      [
        block({ id: 'a', start: '06:00', end: '15:00' }),
        block({ id: 'early', start: '04:00', end: '07:00' }),
        block({ id: 'night', start: '02:00', end: '05:00' }),
        block({ id: 'sleep', kind: 'sleep', start: '23:00', end: '07:00' }),
        block({ id: 'other', date: '2026-11-13' }),
        block({ id: 'bad', start: 'x', end: 'y' }),
      ],
      TODAY,
      TODAY,
      0,
    );
    expect(segments.map((segment) => segment.id)).toEqual(['a', 'early']);
    expect(segments[0]).toMatchObject({ top: 0, height: 0.5 });
    expect(segments[1]?.top).toBe(0);
    expect(segments[1]?.height).toBeCloseTo(1 / 18);
  });

  it('nowLine', () => {
    expect(nowLine(5 * 60)).toBeNull();
    expect(nowLine(6 * 60)).toBe(0);
    expect(nowLine(15 * 60)).toBe(0.5);
  });
});

describe('mjesec i godina', () => {
  it('daysInMonth, uključujući prijestupnu godinu', () => {
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-13')).toBe(0);
    expect(daysInMonth('x')).toBe(0);
  });

  it('monthGrid počinje ponedjeljkom', () => {
    const grid = monthGrid('2026-11'); // 1. 11. 2026. je nedjelja
    expect(grid.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid).toHaveLength(36);
    expect(monthGrid('2026-06')[0]).toBe('2026-06-01'); // ponedjeljak
  });

  it('previousMonth preko godine', () => {
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('x')).toBeNull();
  });

  it('yearMonths: 365 ili 366 dana', () => {
    const count = (year: string) => yearMonths(year).reduce((sum, month) => sum + month.dates.length, 0);
    expect(count('2026')).toBe(365);
    expect(count('2028')).toBe(366);
  });

  it('prosjek, najjači dan i najjači mjesec', () => {
    const scores = new Map([
      ['2026-10-01', 60],
      ['2026-10-02', 71],
      ['2026-11-10', 88],
      ['2026-11-11', 88],
      ['2026-11-12', 61],
    ]);
    expect(averageScore(['2026-10-01', '2026-10-02', '2026-10-03'], scores)).toBe(66);
    expect(averageScore(['2026-09-01'], scores)).toBeNull();
    expect(strongestDay(['2026-11-10', '2026-11-11', '2026-11-12'], scores)).toEqual({ date: '2026-11-10', score: 88 });
    expect(strongestDay([], scores)).toBeNull();
    expect(strongestMonth('2026', scores)).toEqual({ month: '2026-11', average: 79 });
    expect(strongestMonth('2025', scores)).toBeNull();
  });
});

describe('rekordi godine (naknadni pregled PR-a #7)', () => {
  it('najjači mjesec uspoređuje stvarne prosjeke, a prikazuje zaokruženi', () => {
    const scores = new Map([
      ['2026-01-05', 70],
      ['2026-01-06', 70],
      ['2026-02-02', 70],
      ['2026-02-03', 70],
      ['2026-02-04', 71],
    ]);
    expect(strongestMonth('2026', scores)).toEqual({
      month: '2026-02',
      average: 70,
    });
  });

  it('kod stvarno jednakih prosjeka ostaje raniji mjesec', () => {
    const scores = new Map([
      ['2026-01-05', 70],
      ['2026-02-02', 70],
    ]);
    expect(strongestMonth('2026', scores)).toEqual({
      month: '2026-01',
      average: 70,
    });
  });

  it('niz od sedam dana iz prošle godine ne ulazi u rekord ove godine', () => {
    const dates = [
      '2025-03-01',
      '2025-03-02',
      '2025-03-03',
      '2025-03-04',
      '2025-03-05',
      '2025-03-06',
      '2025-03-07',
      '2026-02-10',
    ];
    expect(longestStreakInYear(dates, '2026', '2026-11-12')).toBe(1);
    expect(longestStreakInYear(dates, '2025', '2026-11-12')).toBe(7);
  });

  it('niz preko Nove godine broji se od 1. siječnja', () => {
    const dates = ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'];
    expect(longestStreakInYear(dates, '2026', '2026-01-02')).toBe(2);
    expect(longestStreakInYear(dates, '2025', '2026-01-02')).toBe(3);
  });

  it('dani nakon `through` i godina bez dana daju 0 odnosno ne ulaze', () => {
    expect(longestStreakInYear(['2026-01-01', '2026-01-02', '2026-01-03'], '2026', '2026-01-02')).toBe(2);
    expect(longestStreakInYear([], '2026', '2026-11-12')).toBe(0);
    expect(longestStreakInYear(['2025-05-05'], '2026', '2026-11-12')).toBe(0);
  });
});
