import { describe, expect, it } from '@jest/globals';

import { DIAGNOSIS_LINE_KEYS, METRICS, TRENDS, WEEK_LINE_KEYS, WEEK_METRICS } from '@/core/diagnosis';
import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { weekdayName, weekLineParams } from './week-diagnosis-view';

function lookup(dict: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    dict,
  );
}

describe('diagnosis i18n', () => {
  it.each([
    ['hr', hr],
    ['en', en],
  ])('%s ima svaki redak, trend i metriku dijagnoze', (_lang, dict) => {
    for (const key of DIAGNOSIS_LINE_KEYS) {
      expect(typeof lookup(dict, `diagnosis.lines.${key}`)).toBe('string');
    }
    for (const trend of TRENDS) expect(typeof lookup(dict, `diagnosis.trend.${trend}`)).toBe('string');
    for (const metric of METRICS) expect(typeof lookup(dict, `diagnosis.metric.${metric}`)).toBe('string');
  });
});

const placeholders = (text: unknown): string[] =>
  typeof text === 'string' ? [...new Set([...text.matchAll(/{{(\w+)}}/g)].map((match) => match[1] ?? ''))].sort() : [];

describe('week diagnosis i18n', () => {
  it.each([
    ['hr', hr],
    ['en', en],
  ])('%s ima svaki redak, trend i metriku tjedne dijagnoze', (_lang, dict) => {
    for (const key of WEEK_LINE_KEYS) {
      expect(typeof lookup(dict, `diagnosis.week.lines.${key}`)).toBe('string');
    }
    for (const trend of TRENDS) expect(typeof lookup(dict, `diagnosis.week.trend.${trend}`)).toBe('string');
    for (const metric of WEEK_METRICS) expect(typeof lookup(dict, `diagnosis.week.metric.${metric}`)).toBe('string');
  });

  it('HR i EN retci traže iste parametre', () => {
    for (const key of WEEK_LINE_KEYS) {
      const path = `diagnosis.week.lines.${key}`;
      expect({ key, params: placeholders(lookup(hr, path)) }).toEqual({ key, params: placeholders(lookup(en, path)) });
    }
  });
});

describe('prikaz retka tjedne dijagnoze', () => {
  it('parametar `…Date` postaje naziv dana na jeziku appa, ostali ostaju', () => {
    const line = { key: 'noticed.bestWorst', params: { bestDate: '2026-11-11', best: 90, worstDate: '2026-11-13', worst: 40 } } as const;
    expect(weekLineParams(line, 'hr')).toEqual({ bestDate: 'srijeda', best: 90, worstDate: 'petak', worst: 40 });
    expect(weekLineParams(line, 'en')).toMatchObject({ bestDate: 'Wednesday', worstDate: 'Friday' });
    expect(weekLineParams({ key: 'noticed.none' }, 'hr')).toEqual({});
  });

  it('neispravan datum ostaje kakav je', () => {
    expect(weekdayName('nije-datum', 'hr')).toBe('nije-datum');
    expect(weekdayName('', 'en')).toBe('');
  });
});
