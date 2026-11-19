import { describe, expect, it } from '@jest/globals';

import type { PlanDayRequest } from './edge-types';
import {
  EMPTY_PLAN_CONTEXT,
  freeWindows,
  mergePlanAnswers,
  planAnswers,
  planDayRequest,
  planProposal,
  priorityOf,
  readPlanDayResponse,
  type PlanItem,
} from './plan-proposal';

const item = (title: string, start: string, end: string, pinned = false, kind: PlanItem['draft']['kind'] = 'task'): PlanItem => ({
  draft: { title, kind, start, end },
  pinned,
});

describe('freeWindows', () => {
  it('od buđenja + 30 min do kreveta, bez postojećih blokova i sna', () => {
    expect(
      freeWindows(
        [
          { start: '09:00', end: '12:00', kind: 'fixed' },
          { start: '12:10', end: '13:00', kind: 'task' },
          { start: '23:00', end: '07:00', kind: 'sleep' },
        ],
        '07:00',
        '23:00',
      ),
    ).toEqual([
      { start: '07:30', end: '09:00' },
      // 12:00–12:10 je kraće od 15 min.
      { start: '13:00', end: '23:00' },
    ]);
  });

  it('krevet poslije ponoći ili nepoznat → kraj dana; blok preko početka skraćuje prozor', () => {
    expect(freeWindows([{ start: '07:00', end: '08:00', kind: 'fixed' }], '07:00', '00:30')).toEqual([
      { start: '08:00', end: '23:59' },
    ]);
    expect(freeWindows([], '07:00', null)).toEqual([{ start: '07:30', end: '23:59' }]);
  });

  it('cijeli dan zauzet → nema prozora', () => {
    expect(freeWindows([{ start: '06:00', end: '23:59', kind: 'fixed' }], '07:00', '23:00')).toEqual([]);
  });
});

describe('priorityOf / planDayRequest', () => {
  it('izričito vrijeme je fiksni početak, trajanje iz nacrta, Fiksno je važno', () => {
    expect(priorityOf(item('Zubar', '16:00', '17:00', true, 'fixed'))).toEqual({
      title: 'Zubar',
      durationMinutes: 60,
      fixedStart: '16:00',
      important: true,
    });
    expect(priorityOf(item('Kemija', '08:00', '08:45'))).toEqual({
      title: 'Kemija',
      durationMinutes: 45,
      fixedStart: null,
      important: false,
    });
  });

  it('zahtjev nosi datum, jezik, prozore i najviše 30 prioriteta', () => {
    const items = Array.from({ length: 35 }, (_, i) => item(`A${i}`, '08:00', '09:00'));
    const request = planDayRequest('2026-11-19', items, [], '07:00', '23:00', 'en');
    expect(request.date).toBe('2026-11-19');
    expect(request.locale).toBe('en');
    expect(request.priorities).toHaveLength(30);
    expect(request.freeWindows).toEqual([{ start: '07:30', end: '23:00' }]);
    expect(request.preferences).toBeNull();
    expect(request.context).toEqual({ goals: [], tasks: [], rules: [] });
  });
});

const request: PlanDayRequest = {
  date: '2026-11-19',
  locale: 'hr',
  priorities: [
    { title: 'Zubar', durationMinutes: 60, fixedStart: '16:00', important: false },
    { title: 'Kemija', durationMinutes: 45, fixedStart: null, important: false },
  ],
  freeWindows: [
    { start: '07:30', end: '15:00' },
    { start: '18:00', end: '23:00' },
  ],
  preferences: null,
  context: { goals: [], tasks: [], rules: [] },
  answers: [],
};

describe('readPlanDayResponse', () => {
  const ok = {
    schedule: [
      { title: 'Zubar', start: '16:00', end: '17:00', kind: 'fixed' },
      { title: 'Kemija', start: '08:00', end: '08:45', kind: 'suggestion' },
    ],
    questions: ['  Koliko traje put do zubara? ', 7, '', 'Q2', 'Q3', 'Q4'],
    summary: ' Jutro za kemiju. ',
  };

  it('prihvaća valjan odgovor, slaže po vremenu, čisti pitanja i sažetak', () => {
    expect(readPlanDayResponse(ok, request)).toEqual({
      schedule: [
        { title: 'Kemija', start: '08:00', end: '08:45', kind: 'suggestion' },
        { title: 'Zubar', start: '16:00', end: '17:00', kind: 'fixed' },
      ],
      questions: ['Koliko traje put do zubara?', 'Q2', 'Q3'],
      summary: 'Jutro za kemiju.',
    });
  });

  it('odbacuje nevaljan oblik, vrijeme, preklapanje i blok izvan prozora', () => {
    expect(readPlanDayResponse(null, request)).toBeNull();
    expect(readPlanDayResponse({ schedule: 'x' }, request)).toBeNull();
    const withBlocks = (schedule: unknown[]) => readPlanDayResponse({ schedule }, request);
    expect(withBlocks([{ title: 'Kemija', start: '25:00', end: '26:00' }])).toBeNull();
    expect(withBlocks([{ title: 'Kemija', start: '09:00', end: '08:00' }])).toBeNull();
    expect(
      withBlocks([
        { title: 'Kemija', start: '08:00', end: '09:00' },
        { title: 'Čitanje', start: '08:30', end: '09:00' },
      ]),
    ).toBeNull();
    // 15:00–15:45 je između prozora i nije fiksna stavka.
    expect(withBlocks([{ title: 'Kemija', start: '15:00', end: '15:45' }])).toBeNull();
    // Fiksna stavka vrijedi samo na svom početku.
    expect(withBlocks([{ title: 'Zubar', start: '16:15', end: '17:15' }])).toBeNull();
  });

  it('prazan raspored je valjan (model pita); bez pitanja i sažetka → prazno', () => {
    expect(readPlanDayResponse({ schedule: [] }, request)).toEqual({ schedule: [], questions: [], summary: '' });
  });
});

describe('planProposal', () => {
  it('veže blokove na stavke istog naslova, čuva vrstu, nesmještene vraća', () => {
    const items = [
      item('Zubar', '16:00', '17:00', true, 'fixed'),
      item('Kemija', '07:30', '08:15'),
      item('kemija', '08:15', '09:00'),
      item('Trčanje', '09:00', '10:00'),
    ];
    const proposal = planProposal(
      {
        schedule: [
          { title: 'Kemija', start: '08:00', end: '08:45', kind: 'suggestion' },
          { title: 'Kemija', start: '09:00', end: '09:45', kind: 'suggestion' },
          { title: 'Zubar', start: '16:00', end: '17:00', kind: 'fixed' },
          { title: 'Pauza', start: '17:00', end: '17:15', kind: 'suggestion' },
        ],
        questions: ['Q'],
        summary: 'S',
      },
      items,
    );
    expect(proposal.drafts).toEqual([
      { title: 'Kemija', kind: 'task', start: '08:00', end: '08:45' },
      { title: 'Kemija', kind: 'task', start: '09:00', end: '09:45' },
      { title: 'Zubar', kind: 'fixed', start: '16:00', end: '17:00' },
      { title: 'Pauza', kind: 'task', start: '17:00', end: '17:15' },
    ]);
    expect(proposal.leftOut.map((entry) => entry.draft.title)).toEqual(['Trčanje']);
    expect(proposal.questions).toEqual(['Q']);
    expect(proposal.summary).toBe('S');
  });

  it('blok s naslovom tjednog zadatka postaje njegov termin, najviše jednom (korak 26)', () => {
    const tasks = [{ id: 'task-1', title: 'Trening' }];
    const proposal = planProposal(
      {
        schedule: [
          { title: 'Kemija', start: '08:00', end: '08:45', kind: 'suggestion' },
          { title: 'trening', start: '18:00', end: '19:00', kind: 'suggestion' },
          { title: 'Trening', start: '20:00', end: '21:00', kind: 'suggestion' },
        ],
        questions: [],
        summary: '',
      },
      [item('Kemija', '07:30', '08:15')],
      tasks,
    );
    expect(proposal.drafts).toEqual([
      { title: 'Kemija', kind: 'task', start: '08:00', end: '08:45' },
      { title: 'Trening', kind: 'task', start: '18:00', end: '19:00', taskId: 'task-1' },
      { title: 'Trening', kind: 'task', start: '20:00', end: '21:00' },
    ]);
  });

  it('stavka koja je već termin zadatka čuva vezu', () => {
    const linked = { ...item('Trening', '18:00', '19:00'), draft: { ...item('Trening', '18:00', '19:00').draft, taskId: 'task-1' } };
    const proposal = planProposal(
      { schedule: [{ title: 'Trening', start: '17:00', end: '18:00', kind: 'suggestion' }], questions: [], summary: '' },
      [linked],
    );
    expect(proposal.drafts[0]?.taskId).toBe('task-1');
  });
});

describe('planAnswers (korak 22)', () => {
  it('šalje samo pitanja s odgovorom, sažima razmake i reže na 300 znakova', () => {
    const questions = ['Koliko traje kemija?', 'Kad je trening?', 'Ide li zubar prije posla?'];
    expect(planAnswers(questions, [' Sat  i pol ', '', 'Da'])).toEqual([
      { question: 'Koliko traje kemija?', answer: 'Sat i pol' },
      { question: 'Ide li zubar prije posla?', answer: 'Da' },
    ]);
    expect(planAnswers(questions, [])).toEqual([]);
    expect(planAnswers(['P?'], ['y'.repeat(400)])[0]?.answer).toHaveLength(300);
  });

  it('najviše 3 pitanja; zahtjev nosi odgovore, bez njih prazno', () => {
    const questions = ['A?', 'B?', 'C?', 'D?'];
    expect(planAnswers(questions, ['a', 'b', 'c', 'd'])).toHaveLength(3);
    const answers = planAnswers(['A?'], ['a']);
    expect(planDayRequest('2026-11-20', [], [], '07:00', '23:00', 'hr', EMPTY_PLAN_CONTEXT, answers).answers).toEqual(answers);
    expect(planDayRequest('2026-11-20', [], [], '07:00', '23:00', 'hr').answers).toEqual([]);
  });
});

describe('mergePlanAnswers (Codex P2, #68)', () => {
  const a = (question: string, answer: string) => ({ question, answer });

  it('drugi krug zadržava odgovor iz prvog; novi odgovor na isto pitanje pobjeđuje', () => {
    const first = [a('Koliko traje kemija?', '90 minuta')];
    const second = mergePlanAnswers(first, [a('Kad je trening?', 'Navečer')]);
    expect(second).toEqual([a('Kad je trening?', 'Navečer'), a('Koliko traje kemija?', '90 minuta')]);
    expect(mergePlanAnswers(second, [a('koliko  traje kemija?', 'Sat')])).toEqual([
      a('koliko  traje kemija?', 'Sat'),
      a('Kad je trening?', 'Navečer'),
    ]);
  });

  it('najviše 6, najnoviji ostaju', () => {
    const earlier = Array.from({ length: 5 }, (_, i) => a(`S${i}?`, `s${i}`));
    const merged = mergePlanAnswers(earlier, [a('N1?', 'n1'), a('N2?', 'n2')]);
    expect(merged).toHaveLength(6);
    expect(merged.slice(0, 2).map((x) => x.question)).toEqual(['N1?', 'N2?']);
    expect(merged.map((x) => x.question)).not.toContain('S4?');
  });
});
