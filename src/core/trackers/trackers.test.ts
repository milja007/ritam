import { describe, expect, it } from '@jest/globals';

import {
  calorieCheck,
  isLowCalorieGoal,
  moneySummary,
  moneyWindow,
  trackerDay,
  trackerTotal,
  type MoneySettings,
  type TrackerSettings,
} from './index';

const money = (date: string, amount: number) => ({ date, kind: 'money' as const, amount });
const kcal = (date: string, amount: number) => ({ date, kind: 'calories' as const, amount });

describe('kalorije (korak 31b)', () => {
  it('zbroj po danu i vrsti', () => {
    const entries = [kcal('2026-11-18', 600), kcal('2026-11-18', 900), kcal('2026-11-17', 2000), money('2026-11-18', 500)];
    expect(trackerTotal(entries, 'calories', '2026-11-18', '2026-11-18')).toBe(1500);
  });

  it('unutar ±10 %, iznad, ispod; bez unosa ili cilja → null', () => {
    expect(calorieCheck(2150, 2000)).toEqual({ status: 'within', total: 2150, goal: 2000, difference: 150 });
    expect(calorieCheck(1800, 2000)?.status).toBe('within');
    expect(calorieCheck(2201, 2000)).toMatchObject({ status: 'over', difference: 201 });
    expect(calorieCheck(1500, 2000)).toMatchObject({ status: 'under', difference: -500 });
    expect(calorieCheck(0, 2000)).toBeNull();
    expect(calorieCheck(1500, null)).toBeNull();
  });

  it('upozorenje za neuobičajeno nizak cilj', () => {
    expect(isLowCalorieGoal(1000)).toBe(true);
    expect(isLowCalorieGoal(1200)).toBe(false);
    expect(isLowCalorieGoal(null)).toBe(false);
  });
});

describe('novac (korak 31b)', () => {
  it('razdoblja limita', () => {
    expect(moneyWindow('day', '2026-11-18')).toEqual({ start: '2026-11-18', end: '2026-11-18' });
    expect(moneyWindow('week', '2026-11-18')).toEqual({ start: '2026-11-16', end: '2026-11-22' });
    expect(moneyWindow('month', '2026-11-18')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(moneyWindow('month', '2024-02-10')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(moneyWindow('month', '2026-12-31')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  const entries = [
    money('2026-10-31', 9000),
    money('2026-11-15', 2000),
    money('2026-11-16', 1500),
    money('2026-11-18', 1250),
    money('2026-11-18', 750),
    money('2026-11-23', 400),
    kcal('2026-11-18', 700),
  ];
  const settings: MoneySettings = {
    moneyLimitCents: 10000,
    moneyPeriod: 'week',
    moneyBalanceCents: 50000,
    moneyBalanceOn: '2026-11-16',
  };

  it('koliko je ostalo od tjednog limita, zbrojevi i stanje', () => {
    expect(moneySummary(entries, settings, '2026-11-18')).toEqual({
      limit: { period: 'week', cents: 10000, spent: 3500, remaining: 6500, start: '2026-11-16', end: '2026-11-22' },
      today: 2000,
      week: 3500,
      month: 5500,
      balance: 46500,
    });
  });

  it('prekoračen limit daje negativan ostatak; bez limita i stanja nema ih', () => {
    const daily = moneySummary(entries, { ...settings, moneyLimitCents: 1500, moneyPeriod: 'day' }, '2026-11-18');
    expect(daily.limit?.remaining).toBe(-500);
    const none = moneySummary(entries, { moneyLimitCents: null, moneyPeriod: null, moneyBalanceCents: null, moneyBalanceOn: null }, '2026-11-18');
    expect(none.limit).toBeNull();
    expect(none.balance).toBeNull();
  });

  it('stanje postavljeno za budući dan se ne umanjuje', () => {
    expect(moneySummary(entries, { ...settings, moneyBalanceOn: '2026-11-20' }, '2026-11-18').balance).toBe(50000);
  });
});

describe('trackerDay (rezultat dana, korak 31b)', () => {
  const on: TrackerSettings = {
    trackCalories: true,
    calorieGoal: 2000,
    trackMoney: true,
    moneyLimitCents: 7000,
    moneyPeriod: 'week',
    moneyBalanceCents: null,
    moneyBalanceOn: null,
  };
  const entries = [kcal('2026-11-18', 900), kcal('2026-11-18', 1000), money('2026-11-18', 1500), money('2026-11-17', 500)];

  it('uključeni trackeri s unosima tog dana; dnevni dio limita = limit / dani razdoblja', () => {
    expect(trackerDay(entries, on, '2026-11-18')).toEqual({
      calories: { total: 1900, goal: 2000 },
      money: { spent: 1500, dailyBudget: 1000 },
    });
    expect(trackerDay(entries, { ...on, moneyPeriod: 'month' }, '2026-11-18').money?.dailyBudget).toBe(233);
    expect(trackerDay(entries, { ...on, moneyPeriod: 'day' }, '2026-11-18').money?.dailyBudget).toBe(7000);
  });

  it('isključen tracker, bez cilja/limita ili bez unosa tog dana → ne ulazi', () => {
    expect(trackerDay(entries, { ...on, trackCalories: false, trackMoney: false }, '2026-11-18')).toEqual({ calories: null, money: null });
    expect(trackerDay(entries, { ...on, calorieGoal: null, moneyLimitCents: null }, '2026-11-18')).toEqual({ calories: null, money: null });
    expect(trackerDay(entries, on, '2026-11-17').calories).toBeNull();
    expect(trackerDay(entries, on, '2026-11-16')).toEqual({ calories: null, money: null });
    expect(trackerDay(entries, null, '2026-11-18')).toEqual({ calories: null, money: null });
  });
});
