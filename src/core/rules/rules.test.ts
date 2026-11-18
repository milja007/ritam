import { describe, expect, it } from '@jest/globals';

import {
  isRuleActiveOn,
  rulePeriodEnd,
  rulePeriodStart,
  rulesActiveOn,
  rulesForPeriod,
  ruleStreak,
  type RuleWhen,
} from './rules';

const ALL = [0, 1, 2, 3, 4, 5, 6];
const always: RuleWhen = { activeDays: ALL, period: null, periodStart: null };
const week: RuleWhen = { activeDays: ALL, period: 'week', periodStart: '2026-11-16' };

describe('razdoblje zabrane', () => {
  it('računa početak i kraj tjedna, mjeseca i godine', () => {
    expect(rulePeriodStart('week', '2026-11-18')).toBe('2026-11-16');
    expect(rulePeriodStart('week', '2026-11-22')).toBe('2026-11-16');
    expect(rulePeriodStart('month', '2026-11-18')).toBe('2026-11-01');
    expect(rulePeriodStart('year', '2026-11-18')).toBe('2026-01-01');
    expect(rulePeriodStart('week', 'x')).toBeNull();
    expect(rulePeriodEnd('week', '2026-11-30')).toBe('2026-12-06');
    expect(rulePeriodEnd('month', '2026-02-01')).toBe('2026-02-28');
    expect(rulePeriodEnd('month', '2024-02-01')).toBe('2024-02-29');
    expect(rulePeriodEnd('month', '2026-12-01')).toBe('2026-12-31');
    expect(rulePeriodEnd('year', '2026-01-01')).toBe('2026-12-31');
  });

  it('vrijedi samo unutar razdoblja i na svoje dane', () => {
    expect(isRuleActiveOn(week, '2026-11-15')).toBe(false);
    expect(isRuleActiveOn(week, '2026-11-16')).toBe(true);
    expect(isRuleActiveOn(week, '2026-11-22')).toBe(true);
    expect(isRuleActiveOn(week, '2026-11-23')).toBe(false);
    expect(isRuleActiveOn({ ...week, activeDays: [1] }, '2026-11-17')).toBe(false);
    expect(isRuleActiveOn(always, '2030-01-01')).toBe(true);
    expect(rulesActiveOn([week, always], '2026-11-30')).toEqual([always]);
  });
});

describe('rulesForPeriod', () => {
  const base = { createdAt: '2026-11-01T00:00:00.000Z', activeDays: ALL };
  const rules = [
    { ...base, id: 'stalna', period: null, periodStart: null },
    { ...base, id: 'godina', period: 'year' as const, periodStart: '2026-01-01' },
    { ...base, id: 'studeni', period: 'month' as const, periodStart: '2026-11-01' },
    { ...base, id: 'prosinac', period: 'month' as const, periodStart: '2026-12-01' },
    { ...base, id: 'tjedan', period: 'week' as const, periodStart: '2026-11-16' },
    { ...base, id: 'drugi-tjedan', period: 'week' as const, periodStart: '2026-11-23' },
    { ...base, id: 'prosla-godina', period: 'year' as const, periodStart: '2025-01-01' },
  ];

  it('tjedan vidi svoje, pa šire (mjesec, godina), pa stalne', () => {
    expect(rulesForPeriod(rules, 'week', '2026-11-16').map((r) => [r.rule.id, r.scope])).toEqual([
      ['tjedan', 'own'],
      ['godina', 'wider'],
      ['studeni', 'wider'],
      ['stalna', 'always'],
    ]);
  });

  it('tjedan preko granice mjeseca vidi oba mjeseca', () => {
    const ids = rulesForPeriod(rules, 'week', '2026-11-30').map((r) => r.rule.id);
    expect(ids).toEqual(['godina', 'studeni', 'prosinac', 'stalna']);
  });

  it('mjesec ne prikazuje uže (tjedne) zabrane', () => {
    expect(rulesForPeriod(rules, 'month', '2026-11-01').map((r) => r.rule.id)).toEqual(['studeni', 'godina', 'stalna']);
    expect(rulesForPeriod(rules, 'year', '2026-01-01').map((r) => r.rule.id)).toEqual(['godina', 'stalna']);
  });
});

describe('ruleStreak', () => {
  const kept = (date: string) => ({ date, kept: true });
  const broke = (date: string) => ({ date, kept: false });

  it('broji dane zaredom, današnji neodgovoren dan ne prekida', () => {
    const logs = [kept('2026-11-16'), kept('2026-11-17')];
    expect(ruleStreak(week, logs, '2026-11-18')).toEqual({
      current: 2,
      best: 2,
      kept: 2,
      broken: 0,
      answeredToday: false,
    });
    expect(ruleStreak(week, [...logs, kept('2026-11-18')], '2026-11-18').current).toBe(3);
  });

  it('prekršaj i propušten prošli dan prekidaju niz, najbolji ostaje', () => {
    const logs = [kept('2026-11-16'), kept('2026-11-17'), broke('2026-11-18'), kept('2026-11-19')];
    expect(ruleStreak(week, logs, '2026-11-19')).toMatchObject({ current: 1, best: 2, kept: 3, broken: 1 });
    const gap = [kept('2026-11-16'), kept('2026-11-18')];
    expect(ruleStreak(week, gap, '2026-11-18')).toMatchObject({ current: 1, best: 1 });
  });

  it('dani kad zabrana ne vrijedi se preskaču', () => {
    const weekdays: RuleWhen = { ...week, activeDays: [1, 3, 5] };
    const logs = [kept('2026-11-16'), kept('2026-11-18'), kept('2026-11-20')];
    expect(ruleStreak(weekdays, logs, '2026-11-22').current).toBe(3);
  });

  it('prošlo razdoblje završava na zadnjem danu, buduće nema niz', () => {
    const logs = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map(kept);
    expect(ruleStreak(week, logs, '2026-12-10')).toMatchObject({ current: 7, best: 7 });
    expect(ruleStreak({ ...week, periodStart: '2026-11-23' }, [], '2026-11-18').current).toBe(0);
  });

  it('stalna zabrana počinje od prvog zapisa; bez zapisa nema niza', () => {
    expect(ruleStreak(always, [], '2026-11-18').current).toBe(0);
    expect(ruleStreak(always, [kept('2026-11-17'), kept('2026-11-18')], '2026-11-18')).toMatchObject({
      current: 2,
      answeredToday: true,
    });
    expect(ruleStreak(always, [kept('2026-11-19')], '2026-11-18').current).toBe(0);
  });
});
