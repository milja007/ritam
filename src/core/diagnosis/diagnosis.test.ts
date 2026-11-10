import { describe, expect, it } from '@jest/globals';

import {
  buildDayDiagnosis,
  dayStats,
  dayTrend,
  diagnosisSuggestion,
  parseDayDiagnosis,
  type DayStats,
  type DayStatsInput,
} from './index';

const DATE = '2026-11-10'; // utorak

type BlockIn = DayStatsInput['blocks'][number];
const block = (id: string, status: BlockIn['status'], start = '09:00', kind: BlockIn['kind'] = 'task'): BlockIn => ({
  id,
  title: `Blok ${id}`,
  kind,
  status,
  start,
});

const input = (overrides: Partial<DayStatsInput> = {}): DayStatsInput => ({
  date: DATE,
  blocks: [],
  items: [],
  rules: [],
  ruleLogs: [],
  evening: { dayRating: 3, note: null },
  morning: null,
  sleepSettings: { wakeTime: '07:00', weekendWakeTime: null, sleepHours: 8 },
  xpEvents: [],
  streak: 1,
  ...overrides,
});

const stats = (overrides: Partial<DayStatsInput> = {}): DayStats => dayStats(input(overrides));

describe('dayStats', () => {
  it('broji plan bez sna; djelomično vrijedi pola', () => {
    const s = stats({
      blocks: [
        block('a', 'done'),
        block('b', 'partial'),
        block('c', 'skipped'),
        block('d', 'moved'),
        block('e', 'planned'),
        block('s', 'planned', '23:00', 'sleep'),
      ],
    });
    expect(s.plan).toEqual({ total: 5, done: 1, partial: 1, missed: 2, moved: 1, open: 1, rate: 0.3 });
    expect(s.misses.map((m) => m.title)).toEqual(['Blok b', 'Blok c', 'Blok d']);
  });

  it('bez plana je udio null', () => {
    expect(stats().plan.rate).toBeNull();
  });

  it('zabrane: poštovane, prekršene s okidačem, teže prve; nepoznate zabrane se ignoriraju', () => {
    const s = stats({
      rules: [
        { id: 'r1', title: 'Bez mobitela u krevetu', weight: 1 },
        { id: 'r2', title: 'Bez slatkiša', weight: 3 },
        { id: 'r3', title: 'Bez kave poslije 14', weight: 2 },
      ],
      ruleLogs: [
        { ruleId: 'r1', kept: false, trigger: '  ' },
        { ruleId: 'r2', kept: false, trigger: 'stres' },
        { ruleId: 'r3', kept: true, trigger: null },
        { ruleId: 'nepoznata', kept: false, trigger: null },
      ],
    });
    expect(s.rules.active).toBe(3);
    expect(s.rules.kept).toBe(1);
    expect(s.rules.broken).toBe(2);
    expect(s.rules.activeWeight).toBe(6);
    expect(s.rules.keptWeight).toBe(2);
    expect(s.rules.brokenRules).toEqual([
      { title: 'Bez slatkiša', weight: 3, trigger: 'stres' },
      { title: 'Bez mobitela u krevetu', weight: 1, trigger: null },
    ]);
  });

  it('san iz jutarnje prijave: trajanje preko ponoći i krevet na vrijeme', () => {
    expect(stats({ morning: { sleepStart: '23:10', wakeTime: '07:00' } }).sleep).toEqual({
      minutes: 470,
      onTarget: true,
      deviationMinutes: 10,
    });
    expect(stats({ morning: { sleepStart: '01:00', wakeTime: '07:00' } }).sleep).toEqual({
      minutes: 360,
      onTarget: false,
      deviationMinutes: 120,
    });
    expect(stats({ morning: { sleepStart: null, wakeTime: '07:00' } }).sleep).toBeNull();
    expect(stats({ morning: { sleepStart: '23:00', wakeTime: '07:00' }, sleepSettings: null }).sleep).toEqual({
      minutes: 480,
      onTarget: null,
      deviationMinutes: null,
    });
  });

  it('XP samo tog dana, ocjena i napomena, komentari samo za Djelomično/Nije', () => {
    const s = stats({
      blocks: [block('a', 'done'), block('b', 'skipped')],
      items: [
        { refId: 'a', outcome: 'ok', comment: 'super' },
        { refId: 'b', outcome: 'not', comment: ' umoran ' },
        { refId: 'x', outcome: 'not', comment: 'obrisan blok' },
      ],
      evening: { dayRating: 4, note: '  ' },
      xpEvents: [
        { date: DATE, amount: 15 },
        { date: DATE, amount: 10 },
        { date: '2026-11-09', amount: 50 },
      ],
    });
    expect(s.xp).toBe(25);
    expect(s.rating).toBe(4);
    expect(s.note).toBeNull();
    expect(s.comments).toEqual([{ title: 'Blok b', outcome: 'not', comment: 'umoran' }]);
  });
});

describe('dayTrend (dnevni rezultat, prag 5 bodova)', () => {
  it('bolje / slično / slabije / prvi dan', () => {
    const good = stats({ blocks: [block('a', 'done'), block('b', 'done')] }); // 100
    const half = stats({ blocks: [block('a', 'done'), block('b', 'skipped')] }); // 50
    const almost = stats({
      blocks: [block('p', 'partial'), ...Array.from({ length: 24 }, (_, i) => block(`b${i}`, 'done'))],
    }); // 98
    const atThreshold = stats({
      blocks: [block('p', 'partial'), ...Array.from({ length: 9 }, (_, i) => block(`b${i}`, 'done'))],
    }); // 95
    expect(dayTrend(good, half)).toBe('better');
    expect(dayTrend(half, good)).toBe('worse');
    expect(dayTrend(good, almost)).toBe('same');
    expect(dayTrend(good, atThreshold)).toBe('better');
    expect(dayTrend(good, null)).toBe('first');
    expect(dayTrend(good, stats())).toBe('first');
  });

  it('san i zabrane ulaze u trend', () => {
    const plan = [block('a', 'done')];
    const rules = [{ id: 'r', title: 'R', weight: 2 as const }];
    const kept = stats({ blocks: plan, rules, ruleLogs: [{ ruleId: 'r', kept: true, trigger: null }] });
    const broken = stats({ blocks: plan, rules, ruleLogs: [{ ruleId: 'r', kept: false, trigger: null }] });
    expect(dayTrend(kept, broken)).toBe('better');
    const lateBed = stats({ blocks: plan, morning: { sleepStart: '02:00', wakeTime: '07:00' } });
    const onTime = stats({ blocks: plan, morning: { sleepStart: '23:00', wakeTime: '07:00' } });
    expect(dayTrend(onTime, lateBed)).toBe('better');
  });
});

describe('buildDayDiagnosis', () => {
  it('ima sve sekcije redom i uvijek barem jednu pohvalu i jednu ideju', () => {
    const d = buildDayDiagnosis(stats(), null);
    expect(Object.keys(d)).toEqual(['version', 'date', 'trend', 'summary', 'progress', 'praise', 'noticed', 'problems', 'ideas']);
    expect(d.trend).toBe('first');
    expect(d.summary).toEqual({ key: 'summary.firstNoPlan' });
    expect(d.praise).toEqual([{ key: 'praise.showedUp' }]);
    expect(d.noticed).toEqual([{ key: 'noticed.none' }]);
    expect(d.problems).toEqual([{ key: 'problems.none' }]);
    expect(d.ideas).toEqual([{ key: 'ideas.keepRhythm' }]);
  });

  it('dobar dan: sve odrađeno, zabrane poštovane, krevet na vrijeme, niz', () => {
    const today = stats({
      blocks: [block('a', 'done'), block('b', 'done')],
      rules: [{ id: 'r', title: 'R', weight: 2 }],
      ruleLogs: [{ ruleId: 'r', kept: true, trigger: null }],
      morning: { sleepStart: '23:00', wakeTime: '07:00' },
      evening: { dayRating: 5, note: null },
      streak: 4,
    });
    const yesterday = stats({ date: '2026-11-09', blocks: [block('a', 'done'), block('b', 'skipped')] });
    const d = buildDayDiagnosis(today, yesterday);
    expect(d.trend).toBe('better');
    expect(d.summary).toEqual({ key: 'summary.better', params: { done: 2, total: 2 } });
    expect(d.praise.map((p) => p.key)).toEqual(['praise.allDone', 'praise.rulesKept', 'praise.bedtime']);
    expect(d.problems).toEqual([{ key: 'problems.none' }]);
  });

  it('napredak: redovi danas vs jučer s dobrim/lošim smjerom; san neutralan', () => {
    const today = stats({
      blocks: [block('a', 'done'), block('b', 'skipped')],
      morning: { sleepStart: '00:00', wakeTime: '07:00' },
      xpEvents: [{ date: DATE, amount: 30 }],
      evening: { dayRating: 2, note: null },
      streak: 2,
    });
    const yesterday = stats({
      date: '2026-11-09',
      blocks: [block('a', 'done'), block('b', 'done'), block('c', 'done')],
      morning: { sleepStart: '23:00', wakeTime: '07:00' },
      xpEvents: [{ date: '2026-11-09', amount: 30 }],
      evening: { dayRating: 4, note: null },
    });
    const rows = buildDayDiagnosis(today, yesterday).progress;
    expect(rows).toEqual([
      // rezultat (sva područja, 50/20): plan 50 % i san 60 min kasnije (2/3) → 38,3 / 70 → 55; jučer → 100
      { metric: 'score', value: 55, previous: 100, change: 'down', good: false },
      { metric: 'plan', value: 1, total: 2, previous: 3, previousTotal: 3, change: 'down', good: false },
      { metric: 'sleep', value: 420, previous: 480, change: 'down', good: null },
      { metric: 'xp', value: 30, previous: 30, change: 'same', good: null },
      { metric: 'rating', value: 2, previous: 4, change: 'down', good: false },
      { metric: 'streak', value: 2, previous: null, change: null, good: null },
    ]);
    // Samo plan odabran → rezultat je udio plana.
    expect(buildDayDiagnosis(today, yesterday, { areas: ['plan'] }).progress[0]).toMatchObject({
      metric: 'score',
      value: 50,
    });
  });

  it('dijagnoza govori samo o odabranim područjima (P50)', () => {
    const day = stats({
      blocks: [block('a', 'done')],
      rules: [{ id: 'r', title: 'Bez slatkiša', weight: 3 }],
      ruleLogs: [{ ruleId: 'r', kept: false, trigger: 'stres' }],
      morning: { sleepStart: '02:00', wakeTime: '07:00' },
    });
    const planOnly = buildDayDiagnosis(day, null, { areas: ['plan'] });
    const text = JSON.stringify(planOnly);
    expect(text).not.toMatch(/Rule|rule|Sleep|sleep|earlierBed/);
    expect(planOnly.progress.map((row) => row.metric)).not.toContain('sleep');
    expect(planOnly.ideas).toEqual([{ key: 'ideas.keepRhythm' }]);

    const withSleep = buildDayDiagnosis(day, null, { areas: ['plan', 'sleep'] });
    expect(withSleep.problems).toEqual([{ key: 'problems.shortSleep', params: { hours: 5 } }]);
    expect(withSleep.ideas[0]?.key).toBe('ideas.earlierBed');

    const all = buildDayDiagnosis(day, null, { areas: ['plan', 'rules', 'sleep'] });
    expect(all.ideas[0]?.key).toBe('ideas.ruleTrigger');
  });

  it('jučerašnji rezultat se računa s jučerašnjim područjima', () => {
    const day = stats({
      blocks: [block('a', 'done')],
      rules: [{ id: 'r', title: 'R', weight: 3 }],
      ruleLogs: [{ ruleId: 'r', kept: false, trigger: null }],
    });
    const d = buildDayDiagnosis(day, day, { areas: ['plan'], yesterdayAreas: ['plan', 'rules'] });
    // danas plan 100; jučer (50 × 1 + 30 × 0) / 80 → 63
    expect(d.progress[0]).toMatchObject({ metric: 'score', value: 100, previous: 63 });
    expect(d.trend).toBe('better');
  });

  it('bez jučer: nema usporedbe', () => {
    const rows = buildDayDiagnosis(stats({ blocks: [block('a', 'done')] }), null).progress;
    expect(rows[0]).toEqual({ metric: 'score', value: 100, previous: null, change: null, good: null });
    expect(rows[1]).toEqual({ metric: 'plan', value: 1, total: 1, previous: null, change: null, good: null });
  });

  it('težak dan: problemi iskreno, primjećeni komentari i okidači, jedna ideja za zabranu', () => {
    const today = stats({
      blocks: [block('a', 'skipped', '18:00'), block('b', 'moved', '19:30'), block('c', 'done', '10:00')],
      items: [{ refId: 'a', outcome: 'not', comment: 'umoran' }],
      rules: [{ id: 'r', title: 'Bez slatkiša', weight: 3 }],
      ruleLogs: [{ ruleId: 'r', kept: false, trigger: 'stres' }],
      morning: { sleepStart: '02:00', wakeTime: '07:00' },
      evening: { dayRating: 2, note: null },
    });
    const d = buildDayDiagnosis(today, null);
    expect(d.noticed).toEqual([
      { key: 'noticed.comment.not', params: { title: 'Blok a', comment: 'umoran' } },
      { key: 'noticed.trigger', params: { rule: 'Bez slatkiša', trigger: 'stres' } },
      { key: 'noticed.misses.evening', params: { count: 2 } },
      { key: 'noticed.moved', params: { count: 1 } },
    ]);
    expect(d.problems).toEqual([
      { key: 'problems.lowPlan', params: { done: 1, total: 3 } },
      { key: 'problems.heavyRule', params: { rule: 'Bez slatkiša' } },
      { key: 'problems.shortSleep', params: { hours: 5 } },
    ]);
    expect(d.ideas).toEqual([{ key: 'ideas.ruleTrigger', params: { rule: 'Bez slatkiša', trigger: 'stres' } }]);
    expect(d.praise).toEqual([{ key: 'praise.showedUp' }]);
  });

  it('ideje po prioritetu: zabrana bez okidača → mali plan → navečer → san → premještanja', () => {
    const lowPlan = stats({ blocks: [block('a', 'skipped', '09:00'), block('b', 'skipped', '14:00')] });
    expect(buildDayDiagnosis(lowPlan, null).ideas[0]?.key).toBe('ideas.smallerPlan');

    const lowEvening = stats({ blocks: [block('a', 'skipped', '18:00'), block('b', 'skipped', '20:00')] });
    expect(buildDayDiagnosis(lowEvening, null).ideas[0]?.key).toBe('ideas.eveningEarlier');

    const ruleNoTrigger = stats({
      rules: [{ id: 'r', title: 'R', weight: 1 }],
      ruleLogs: [{ ruleId: 'r', kept: false, trigger: null }],
    });
    expect(buildDayDiagnosis(ruleNoTrigger, null).ideas[0]).toEqual({ key: 'ideas.ruleNote', params: { rule: 'R' } });

    const tired = stats({ morning: { sleepStart: '02:00', wakeTime: '07:00' } });
    expect(buildDayDiagnosis(tired, null).ideas[0]?.key).toBe('ideas.earlierBed');

    const moves = stats({
      blocks: [block('a', 'moved', '09:00'), block('b', 'moved', '14:00'), block('c', 'done'), block('d', 'done'), block('e', 'done')],
    });
    expect(buildDayDiagnosis(moves, null).ideas[0]?.key).toBe('ideas.fewerMoves');
  });

  it('ponovljena ideja ostaje (s brojem dana) i dodaje se nova (odluka P38)', () => {
    const rule = { rules: [{ id: 'r', title: 'R', weight: 1 as const }] };
    const brokenWithLowPlan = stats({
      ...rule,
      ruleLogs: [{ ruleId: 'r', kept: false, trigger: null }],
      blocks: [block('a', 'skipped', '09:00'), block('b', 'skipped', '14:00')],
    });
    const day1 = buildDayDiagnosis(brokenWithLowPlan, null);
    expect(day1.ideas).toEqual([{ key: 'ideas.ruleNote', params: { rule: 'R' } }]);

    // Isti problem drugi dan → ista ideja ostaje + sljedeći problem dana kao nova ideja.
    const day2 = buildDayDiagnosis(brokenWithLowPlan, null, { previous: day1 });
    expect(day2.ideas).toEqual([
      { key: 'ideas.ruleNote', params: { rule: 'R', repeatedDays: 2 } },
      { key: 'ideas.smallerPlan' },
    ]);
    expect(diagnosisSuggestion(day2)).toBe('ideas.ruleNote');

    // Treći dan, samo zabrana → ista ideja (3. dan) + drugi pristup istom problemu.
    const onlyRule = stats({ ...rule, ruleLogs: [{ ruleId: 'r', kept: false, trigger: null }] });
    const day3 = buildDayDiagnosis(onlyRule, null, { previous: day2 });
    expect(day3.ideas).toEqual([
      { key: 'ideas.ruleNote', params: { rule: 'R', repeatedDays: 3 } },
      { key: 'ideas.ruleSmallStep', params: { rule: 'R' } },
    ]);
  });

  it('bez ponavljanja: druga ideja jučer, ili "zadrži ritam" → samo jedna ideja', () => {
    const tired = stats({ morning: { sleepStart: '02:00', wakeTime: '07:00' } });
    const lowPlan = stats({ blocks: [block('a', 'skipped', '09:00'), block('b', 'skipped', '14:00')] });
    const yesterday = buildDayDiagnosis(lowPlan, null);
    expect(buildDayDiagnosis(tired, null, { previous: yesterday }).ideas).toEqual([{ key: 'ideas.earlierBed' }]);

    const calm = stats({ blocks: [block('a', 'done')] });
    const calmYesterday = buildDayDiagnosis(calm, null);
    expect(buildDayDiagnosis(calm, null, { previous: calmYesterday }).ideas).toEqual([{ key: 'ideas.keepRhythm' }]);
  });

  it('ocjena se ne slaže s planom → primijećeno', () => {
    const d = buildDayDiagnosis(stats({ blocks: [block('a', 'done')], evening: { dayRating: 1, note: null } }), null);
    expect(d.noticed).toContainEqual({ key: 'noticed.lowRatingDespitePlan' });
    const e = buildDayDiagnosis(
      stats({ blocks: [block('a', 'skipped', '09:00'), block('b', 'done', '15:00'), block('c', 'skipped', '20:00')], evening: { dayRating: 5, note: null } }),
      null,
    );
    expect(e.noticed).toContainEqual({ key: 'noticed.goodRatingDespitePlan' });
  });

  it('najviše tri pohvale i tri komentara', () => {
    const d = buildDayDiagnosis(
      stats({
        blocks: [block('a', 'done'), block('b', 'partial'), block('c', 'partial'), block('d', 'partial'), block('e', 'partial')],
        items: ['b', 'c', 'd', 'e'].map((id) => ({ refId: id, outcome: 'partial' as const, comment: `k${id}` })),
        rules: [{ id: 'r', title: 'R', weight: 1 }],
        ruleLogs: [{ ruleId: 'r', kept: true, trigger: null }],
        morning: { sleepStart: '23:00', wakeTime: '07:00' },
        evening: { dayRating: 5, note: null },
        streak: 10,
      }),
      null,
    );
    expect(d.praise).toHaveLength(3);
    expect(d.noticed.filter((n) => n.key.startsWith('noticed.comment'))).toHaveLength(3);
  });

  it('prijedlog i parsiranje pohranjenih sekcija', () => {
    const d = buildDayDiagnosis(stats(), null);
    expect(diagnosisSuggestion(d)).toBe('ideas.keepRhythm');
    expect(parseDayDiagnosis(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(parseDayDiagnosis({ version: 'llm-v1' })).toBeNull();
    expect(parseDayDiagnosis(null)).toBeNull();
  });
});
