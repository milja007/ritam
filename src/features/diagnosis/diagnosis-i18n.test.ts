import { describe, expect, it } from '@jest/globals';

import { DIAGNOSIS_LINE_KEYS, METRICS, TRENDS } from '@/core/diagnosis';
import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

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
