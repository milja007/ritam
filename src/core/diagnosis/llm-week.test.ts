import { describe, expect, it } from '@jest/globals';

import {
  buildWeekDiagnosis,
  isWeekFreshForWriting,
  parseWeekDiagnosis,
  periodStats,
  readWriteWeekReportResponse,
  writeWeekReportRequest,
  type DayStats,
} from './index';

const text = {
  version: 'llm-week-v1',
  summary: 'Tjedan je bio stabilan.',
  praise: ['Zabrane su držale.'],
  noticed: [],
  problems: [],
  ideaWhy: null,
};

function stats(date: string): DayStats {
  return {
    date,
    plan: { total: 2, done: 1, partial: 0, missed: 1, moved: 0, open: 0, rate: 0.5 },
    rules: { active: 0, kept: 0, broken: 0, brokenRules: [], activeWeight: 0, keptWeight: 0 },
    sleep: null,
    xp: 10.4,
    rating: 3.6,
    note: null,
    streak: 1,
    comments: [{ title: 'Trening', outcome: 'not', comment: 'umoran' }],
    gaveUp: false,
    gaveUpNote: null,
    misses: [{ title: 'Trening', start: '18:00' }],
  };
}

describe('llm-week (korak 31c)', () => {
  it('svjež je tjedan samo na svoju nedjelju i ponedjeljak poslije', () => {
    expect(isWeekFreshForWriting('2026-11-09', '2026-11-14')).toBe(false);
    expect(isWeekFreshForWriting('2026-11-09', '2026-11-15')).toBe(true);
    expect(isWeekFreshForWriting('2026-11-09', '2026-11-16')).toBe(true);
    expect(isWeekFreshForWriting('2026-11-09', '2026-11-17')).toBe(false);
    expect(isWeekFreshForWriting('x', '2026-11-16')).toBe(false);
  });

  it('odgovor funkcije: valjan tekst ili null', () => {
    expect(readWriteWeekReportResponse({ report: text })).toEqual(text);
    expect(readWriteWeekReportResponse({ report: null })).toBeNull();
    expect(readWriteWeekReportResponse({ report: { ...text, version: 'llm-day-v1' } })).toBeNull();
    expect(readWriteWeekReportResponse('x')).toBeNull();
  });

  it('pokvaren tekst modela u spremljenoj dijagnozi ne ruši lokalnu', () => {
    const days = ['2026-11-09', '2026-11-10'].map((date) => ({ stats: stats(date), score: 50 }));
    const diagnosis = buildWeekDiagnosis(periodStats('2026-11-09', '2026-11-15', 7, days), null);
    const stored = JSON.parse(JSON.stringify({ ...diagnosis, llm: { summary: 5 } })) as unknown;
    const parsed = parseWeekDiagnosis(stored);
    expect(parsed).not.toBeNull();
    expect(parsed?.llm).toBeUndefined();
    expect(parseWeekDiagnosis(JSON.parse(JSON.stringify({ ...diagnosis, llm: text })))?.llm).toEqual(text);
  });

  it('zahtjev: dani tjedna redom, ranije dijagnoze najnovije prvo (do 4), promjena tjedna kao tekst', () => {
    const days = ['2026-11-10', '2026-11-09', '2026-11-16'].map((date) => ({ stats: stats(date), score: 50.4 }));
    const current = periodStats('2026-11-09', '2026-11-15', 7, days);
    const diagnosis = buildWeekDiagnosis(current, null);
    const earlier = (start: string) => ({ start, diagnosis, helpful: false, comment: 'ne', suggestionAccepted: true });
    const request = writeWeekReportRequest({
      locale: 'en',
      diagnosis,
      current,
      previous: null,
      days,
      previousReports: ['2026-10-05', '2026-10-26', '2026-10-12', '2026-10-19', '2026-11-02', '2026-11-09'].map(earlier),
      renderLine: (line) => `T:${line.key}`,
    });
    expect(request.days.map((d) => d.date)).toEqual(['2026-11-09', '2026-11-10']);
    expect(request.days[0]).toMatchObject({ score: 50, rating: 4 });
    expect(request.previous.map((p) => p.date)).toEqual(['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12']);
    expect(request.week.xp).toBe(21);
    expect(request.locale).toBe('en');
    if (diagnosis.suggestion === null) expect(request.idea).toBeNull();
    else expect(request.idea?.text).toBe(`T:${diagnosis.ideas[0]?.key}`);
  });
});
