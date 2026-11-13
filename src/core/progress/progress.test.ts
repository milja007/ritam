import { describe, expect, it } from '@jest/globals';

import { progressOverview, scoreHeadline, scorePill, scoreTrend, weekStart, type ScoredDay } from './compare';
import { dayScore, scoreWeights, sleepPart, type ScoreInput } from './score';

const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  plan: { total: 0, done: 0, partial: 0 },
  rules: { activeWeight: 0, keptWeight: 0 },
  sleep: null,
  ...over,
});

describe('dayScore', () => {
  it('bez ijednog dijela nema rezultata', () => {
    expect(dayScore(input())).toEqual({ score: null, parts: { plan: null, rules: null, sleep: null } });
  });

  it('samo plan: djelomično = pola', () => {
    expect(dayScore(input({ plan: { total: 4, done: 2, partial: 1 } })).score).toBe(63);
  });

  it('težine plan 50 / zabrane 30 / san 20 na prisutnim dijelovima; nezabilježeni ne ulaze', () => {
    const result = dayScore(
      input({
        plan: { total: 4, done: 4, partial: 0 },
        rules: { activeWeight: 4, keptWeight: 1 },
      }),
    );
    expect(result.parts).toEqual({ plan: 1, rules: 0.25, sleep: null });
    // (1 × 50 + 0,25 × 30) / 80 = 0,71875
    expect(result.score).toBe(72);
  });

  it('boduje samo odabrana područja (neodabrana su null)', () => {
    const all = {
      plan: { total: 2, done: 1, partial: 0 },
      rules: { activeWeight: 3, keptWeight: 0 },
      sleep: { deviationMinutes: 0 },
    };
    expect(dayScore(all, ['plan'])).toEqual({ score: 50, parts: { plan: 0.5, rules: null, sleep: null } });
    expect(dayScore(all, ['rules']).score).toBe(0);
    expect(dayScore(all, ['sleep']).score).toBe(100);
    // plan+san 50/20: (0,5 × 50 + 1 × 20) / 70 = 0,643
    expect(dayScore(all, ['plan', 'sleep']).score).toBe(64);
    // plan+zabrane 50/30: 25 / 80
    expect(dayScore(all, ['plan', 'rules']).score).toBe(31);
    // zabrane+san 30/20: 20 / 50
    expect(dayScore(all, ['rules', 'sleep']).score).toBe(40);
    // sva tri: 45 / 100
    expect(dayScore(all, ['plan', 'rules', 'sleep']).score).toBe(45);
    expect(dayScore(all, []).score).toBeNull();
  });

  it('scoreWeights: razmjerna preraspodjela (odluka P39), zbroj 100', () => {
    expect(scoreWeights(['plan', 'rules', 'sleep'])).toEqual({ plan: 50, rules: 30, sleep: 20 });
    expect(scoreWeights(['plan', 'sleep'])).toEqual({ plan: 71, rules: 0, sleep: 29 });
    expect(scoreWeights(['plan', 'rules'])).toEqual({ plan: 62, rules: 38, sleep: 0 });
    expect(scoreWeights(['rules', 'sleep'])).toEqual({ plan: 0, rules: 60, sleep: 40 });
    expect(scoreWeights(['sleep'])).toEqual({ plan: 0, rules: 0, sleep: 100 });
    expect(scoreWeights([])).toEqual({ plan: 0, rules: 0, sleep: 0 });
  });

  it('zabrane po težini: prekršena teška zabrana više vuče dolje', () => {
    expect(dayScore(input({ rules: { activeWeight: 4, keptWeight: 1 } })).score).toBe(25);
  });

  it('san bez cilja ne ulazi', () => {
    expect(dayScore(input({ sleep: { deviationMinutes: null } })).score).toBeNull();
  });

  it('sve savršeno = 100', () => {
    expect(
      dayScore({
        plan: { total: 3, done: 3, partial: 0 },
        rules: { activeWeight: 2, keptWeight: 2 },
        sleep: { deviationMinutes: 10 },
      }).score,
    ).toBe(100);
  });
});

describe('sleepPart', () => {
  it('±30 min = puno, 2 h = nula, između linearno', () => {
    expect(sleepPart(0)).toBe(1);
    expect(sleepPart(30)).toBe(1);
    expect(sleepPart(75)).toBeCloseTo(0.5);
    expect(sleepPart(120)).toBe(0);
    expect(sleepPart(300)).toBe(0);
  });
});

describe('scoreTrend', () => {
  it('prag 5 bodova', () => {
    expect(scoreTrend(5)).toBe('better');
    expect(scoreTrend(4)).toBe('same');
    expect(scoreTrend(-4)).toBe('same');
    expect(scoreTrend(-5)).toBe('worse');
  });
});

describe('weekStart', () => {
  it('ponedjeljak tjedna', () => {
    expect(weekStart('2026-11-10')).toBe('2026-11-09'); // utorak
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // ponedjeljak
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // nedjelja
    expect(weekStart('nije-datum')).toBeNull();
  });
});

const day = (date: string, score: number, final = true): ScoredDay => ({ date, score, final });

describe('progressOverview', () => {
  it('prazna povijest', () => {
    const overview = progressOverview([], '2026-11-10');
    expect(overview.today).toBeNull();
    expect(overview.vsYesterday).toBeNull();
    expect(overview.last7).toBeNull();
    expect(overview.records).toEqual({ day: null, week: null, month: null, longestStreak: 0 });
    expect(overview.isDayRecord).toBe(false);
  });

  it('prvi dan: rezultat bez usporedbe i bez "rekorda"', () => {
    const overview = progressOverview([day('2026-11-10', 70, false)], '2026-11-10');
    expect(overview.today).toEqual(day('2026-11-10', 70, false));
    expect(overview.vsYesterday).toBeNull();
    expect(overview.records.day).toEqual({ date: '2026-11-10', score: 70 });
    expect(overview.isDayRecord).toBe(false);
  });

  it('jučer i isti dan prošli tjedan', () => {
    const overview = progressOverview(
      [day('2026-11-03', 80), day('2026-11-09', 60), day('2026-11-10', 72)],
      '2026-11-10',
    );
    expect(overview.vsYesterday).toEqual({ previous: 60, diff: 12, trend: 'better' });
    expect(overview.vsLastWeek).toEqual({ previous: 80, diff: -8, trend: 'worse' });
    expect(overview.isDayRecord).toBe(false);
  });

  it('7 dana vs 7 prije (prosjek samo ocijenjenih dana)', () => {
    const overview = progressOverview(
      [
        day('2026-10-27', 40), // 14 dana prije — izvan oba prozora
        day('2026-10-28', 50),
        day('2026-11-03', 60),
        day('2026-11-04', 70),
        day('2026-11-10', 80),
      ],
      '2026-11-10',
    );
    expect(overview.prev7).toBe(55);
    expect(overview.last7).toBe(75);
    expect(overview.last7Trend).toBe('better');
  });

  it('novi rekord dana', () => {
    const overview = progressOverview([day('2026-11-08', 70), day('2026-11-10', 90)], '2026-11-10');
    expect(overview.isDayRecord).toBe(true);
    expect(overview.records.day).toEqual({ date: '2026-11-10', score: 90 });
  });

  it('dani poslije traženog se zanemaruju', () => {
    const overview = progressOverview([day('2026-11-10', 50), day('2026-11-11', 99)], '2026-11-10');
    expect(overview.records.day?.score).toBe(50);
  });

  it('rekord tjedna i mjeseca bez uvjeta o broju dana (odluka P42)', () => {
    const october = Array.from({ length: 16 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`, 60));
    const days = [
      ...october,
      // tjedan 2.–8. 11.: 4 dana × 80 → vrijedi
      day('2026-11-02', 80),
      day('2026-11-03', 80),
      day('2026-11-04', 80),
      day('2026-11-05', 80),
      // tjedan 9.–15. 11.: 1 dan × 100 → i on vrijedi
      day('2026-11-10', 100),
    ];
    const overview = progressOverview(days, '2026-11-10', 12);
    expect(overview.records.week).toEqual({ start: '2026-11-09', average: 100, days: 1 });
    // studeni (5 dana, prosjek 84) bolji od listopada (60)
    expect(overview.records.month).toEqual({ start: '2026-11-01', average: 84, days: 5 });
    expect(overview.records.longestStreak).toBe(12);
  });
});

describe('scoreHeadline (odluka P43)', () => {
  const at = (date: string, score: number, final = true): ScoredDay => ({ date, score, final });

  it('prije upita: jučer konačan istaknut, danas "u tijeku" ispod', () => {
    const days = [at('2026-11-08', 50), at('2026-11-09', 70), at('2026-11-10', 20, false)];
    const headline = scoreHeadline(days, '2026-11-10', 3);
    expect(headline.featuresYesterday).toBe(true);
    expect(headline.featured.date).toBe('2026-11-09');
    expect(headline.featured.today).toEqual(at('2026-11-09', 70));
    expect(headline.featured.vsYesterday).toEqual({ previous: 50, diff: 20, trend: 'better' });
    expect(headline.todayInProgress).toEqual(at('2026-11-10', 20, false));
  });

  it('prije upita bez današnjeg rezultata: jučer istaknut, danas null', () => {
    const headline = scoreHeadline([at('2026-11-09', 70)], '2026-11-10');
    expect(headline.featuresYesterday).toBe(true);
    expect(headline.todayInProgress).toBeNull();
  });

  it('nakon upita: današnji konačni istaknut', () => {
    const days = [at('2026-11-09', 70), at('2026-11-10', 80)];
    const headline = scoreHeadline(days, '2026-11-10');
    expect(headline.featuresYesterday).toBe(false);
    expect(headline.featured.today).toEqual(at('2026-11-10', 80));
    expect(headline.todayInProgress).toBeNull();
  });

  it('bez jučerašnjeg konačnog rezultata: istaknut današnji "u tijeku"', () => {
    const headline = scoreHeadline([at('2026-11-08', 60), at('2026-11-10', 30, false)], '2026-11-10');
    expect(headline.featuresYesterday).toBe(false);
    expect(headline.featured.today).toEqual(at('2026-11-10', 30, false));
  });
});

describe('scorePill (zaglavlje Dana)', () => {
  it('bez ijednog rezultata nema pilule', () => {
    expect(scorePill(scoreHeadline([], '2026-11-10'))).toBeNull();
  });

  it('prije upita: jučerašnji konačni rezultat i trend naspram prekjučer', () => {
    const days = [day('2026-11-08', 50), day('2026-11-09', 70), day('2026-11-10', 20, false)];
    expect(scorePill(scoreHeadline(days, '2026-11-10'))).toEqual({ score: 70, trend: 'better', yesterday: true });
  });

  it('nakon upita: današnji rezultat; slabiji dan je trend, ne kazna', () => {
    const days = [day('2026-11-09', 70), day('2026-11-10', 40)];
    expect(scorePill(scoreHeadline(days, '2026-11-10'))).toEqual({ score: 40, trend: 'worse', yesterday: false });
  });

  it('bez dana za usporedbu nema trenda', () => {
    const days = [day('2026-11-08', 60), day('2026-11-10', 30, false)];
    expect(scorePill(scoreHeadline(days, '2026-11-10'))).toEqual({ score: 30, trend: null, yesterday: false });
  });
});
