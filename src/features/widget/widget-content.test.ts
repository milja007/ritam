import { describe, expect, it, jest } from '@jest/globals';
import type { TFunction } from 'i18next';

import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { widgetDayScore, widgetLabels } from './widget-content';

jest.mock('@/db/open', () => ({ getDb: () => null }));

type Headline = Parameters<typeof widgetDayScore>[0];
const day = (date: string, score: number, final: boolean) => ({ date, score, final });

describe('widgetDayScore', () => {
  it('is today in progress while yesterday is featured before the evening check-in', () => {
    const headline = {
      featured: { today: day('2026-11-19', 80, true) },
      featuresYesterday: true,
      todayInProgress: day('2026-11-20', 41, false),
    } as unknown as Headline;
    expect(widgetDayScore(headline)).toBe(41);
  });

  it('is today final after the check-in, and null without a score', () => {
    const final = { featured: { today: day('2026-11-20', 77, true) }, featuresYesterday: false, todayInProgress: null };
    expect(widgetDayScore(final as unknown as Headline)).toBe(77);
    const none = { featured: { today: null }, featuresYesterday: true, todayInProgress: null };
    expect(widgetDayScore(none as unknown as Headline)).toBeNull();
  });
});

describe('widgetLabels', () => {
  it('takes every text from the widget namespace (HR and EN filled)', () => {
    for (const lang of [hr, en]) {
      const t = ((key: string) => {
        const [ns, name] = key.split('.') as ['widget', keyof typeof hr.widget];
        return lang[ns][name];
      }) as unknown as TFunction;
      const labels = widgetLabels(t);
      for (const value of Object.values(labels)) expect(value.length).toBeGreaterThan(0);
    }
    expect(Object.keys(hr.widget).sort()).toEqual(Object.keys(en.widget).sort());
  });
});
