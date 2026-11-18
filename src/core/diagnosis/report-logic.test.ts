import { describe, expect, it } from '@jest/globals';

import { llmModelFor } from '../../../supabase/functions/_shared/plan-logic';
import {
  EXAMPLE_GAVE_UP,
  EXAMPLE_MODEL_RESPONSE,
  EXAMPLE_TIRED_TUESDAY,
} from '../../../supabase/functions/_shared/report-examples';
import {
  acceptModelReport,
  buildReportSystemPrompt,
  buildReportUserMessage,
  DAY_REPORT_PROMPT_VERSION,
  parseWriteReportRequest,
  REPORT_LIMITS,
  weekdayOf,
} from '../../../supabase/functions/_shared/report-logic';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('write-report — zahtjev (korak 31)', () => {
  it('primjer tipičnog dana prolazi bez gubitka', () => {
    const req = parseWriteReportRequest(EXAMPLE_TIRED_TUESDAY);
    expect(req).not.toBeNull();
    expect(req?.locale).toBe('hr');
    expect(req?.today.comments).toHaveLength(2);
    expect(req?.today.rules.broken[0]).toEqual({ title: 'Bez mobitela u krevetu', weight: 2, trigger: 'stres' });
    expect(req?.history).toHaveLength(2);
    expect(req?.previous[0]?.helpful).toBe(false);
  });

  it('bez datuma, trenda ili današnjeg dana nema zahtjeva; datum dana mora odgovarati', () => {
    expect(parseWriteReportRequest(null)).toBeNull();
    expect(parseWriteReportRequest({ ...clone(EXAMPLE_TIRED_TUESDAY), trend: 'up' })).toBeNull();
    expect(parseWriteReportRequest({ ...clone(EXAMPLE_TIRED_TUESDAY), today: null })).toBeNull();
    expect(parseWriteReportRequest({ ...clone(EXAMPLE_TIRED_TUESDAY), date: '2026-11-18' })).toBeNull();
    expect(parseWriteReportRequest({ ...clone(EXAMPLE_TIRED_TUESDAY), date: '2026-13-45' })).toBeNull();
  });

  it('nevaljane stavke otpadaju, ne ruše zahtjev; nepoznat jezik → hr', () => {
    const raw = clone(EXAMPLE_TIRED_TUESDAY) as unknown as Record<string, unknown> & {
      today: { comments: unknown[]; rules: { broken: unknown[] } };
    };
    raw.locale = 'de';
    raw.today.comments.push({ title: '', outcome: 'not', comment: 'x' }, { title: 'A', outcome: 'ok', comment: 'x' });
    raw.today.rules.broken.push({ title: 'B', weight: 9, trigger: null });
    const req = parseWriteReportRequest(raw);
    expect(req?.locale).toBe('hr');
    expect(req?.today.comments).toHaveLength(2);
    expect(req?.today.rules.broken).toHaveLength(1);
  });

  it('povijest i ranije dijagnoze s datumom dana ili kasnije ne ulaze; dug tekst se skrati', () => {
    const raw = clone(EXAMPLE_TIRED_TUESDAY) as unknown as Record<string, unknown> & {
      history: unknown[];
      previous: { comment: string }[];
    };
    raw.history.push({ date: '2026-11-17', score: 50, rating: 2, comments: [], broken: [] });
    raw.history.push({ date: '2026-11-20', score: 50, rating: 2, comments: [], broken: [] });
    (raw.previous[0] as { comment: string }).comment = 'x'.repeat(2000);
    const req = parseWriteReportRequest(raw);
    expect(req?.history.map((day) => day.date)).toEqual(['2026-11-10', '2026-11-03']);
    expect(req?.previous[0]?.comment?.length).toBe(REPORT_LIMITS.comment);
  });

  it('neispravan rezultat ili ocjena dana odbija dan', () => {
    const raw = clone(EXAMPLE_TIRED_TUESDAY) as unknown as { today: Record<string, unknown> };
    raw.today.score = 140;
    expect(parseWriteReportRequest(raw)).toBeNull();
    raw.today.score = null;
    raw.today.rating = 0;
    expect(parseWriteReportRequest(raw)).toBeNull();
  });
});

describe('write-report — prompt llm-day-v1', () => {
  it('verzija je zapisana i jezik slijedi zahtjev', () => {
    expect(DAY_REPORT_PROMPT_VERSION).toBe('llm-day-v1');
    expect(buildReportSystemPrompt('hr')).toContain('hrvatskom');
    expect(buildReportSystemPrompt('en')).toContain('engleskom');
  });

  it('sistemska uputa nosi strukturu i ton iz koncepta', () => {
    const system = buildReportSystemPrompt('hr');
    for (const part of ['summary', 'praise', 'noticed', 'problems', 'ideas', 'Bez posramljivanja', 'Nije pomoglo']) {
      expect(system).toContain(part);
    }
  });

  it('poruka za tipičan dan nosi komentare, povijest za uzorke i odgovor na prošli savjet', () => {
    const req = parseWriteReportRequest(EXAMPLE_TIRED_TUESDAY);
    if (req === null) throw new Error('primjer nije valjan');
    const message = buildReportUserMessage(req);
    expect(message).toContain('2026-11-17 (utorak)');
    expect(message).toContain('lošije nego jučer');
    expect(message).toContain('"Trening": "umoran nakon posla"');
    expect(message).toContain('2026-11-10 (utorak)');
    expect(message).toContain('2026-11-03 (utorak)');
    expect(message).toContain('okidač: "stres"');
    expect(message).toContain('korisnik: Nije pomoglo — "ujutro ne mogu, radim od 7"');
    expect(message).toContain('San: 6 h 20 min, u krevet 50 min od cilja');
    expect(message).toContain('JUČER (2026-11-16)');
  });

  it('dan s odustajanjem: bilješka ide modelu, bez jučer i povijesti', () => {
    const req = parseWriteReportRequest(EXAMPLE_GAVE_UP);
    if (req === null) throw new Error('primjer nije valjan');
    const message = buildReportUserMessage(req);
    expect(message).toContain('Odustao od dana: "Migraine all afternoon."');
    expect(message).toContain('San: nije zapisan');
    expect(message).not.toContain('JUČER');
    expect(message).not.toContain('PRETHODNE');
  });

  it('dan u tjednu ne ovisi o zoni', () => {
    expect(weekdayOf('2026-11-16')).toBe('ponedjeljak');
    expect(weekdayOf('2026-11-22')).toBe('nedjelja');
  });
});

describe('write-report — odgovor modela', () => {
  it('primjer odgovora (u ```json bloku) prolazi', () => {
    const report = acceptModelReport(EXAMPLE_MODEL_RESPONSE);
    expect(report?.version).toBe('llm-day-v1');
    expect(report?.praise).toHaveLength(2);
    expect(report?.ideas).toHaveLength(1);
  });

  it('bez ideje, krivog tipa ili ne-JSON → null', () => {
    expect(acceptModelReport('nije json')).toBeNull();
    expect(acceptModelReport(JSON.stringify({ summary: 'Dan.', ideas: [] }))).toBeNull();
    expect(acceptModelReport(JSON.stringify({ summary: 'Dan.', praise: 'super', ideas: ['a'] }))).toBeNull();
    expect(acceptModelReport(JSON.stringify({ summary: '', ideas: ['a'] }))).toBeNull();
  });

  it('predug redak ili sažetak → null; višak redaka se reže, prazni otpadaju', () => {
    expect(acceptModelReport(JSON.stringify({ summary: 'Dan.', ideas: ['x'.repeat(REPORT_LIMITS.line + 1)] }))).toBeNull();
    expect(acceptModelReport(JSON.stringify({ summary: 'x'.repeat(REPORT_LIMITS.summary + 1), ideas: ['a'] }))).toBeNull();
    const report = acceptModelReport(
      JSON.stringify({ summary: ' Dan. ', praise: ['a', ' ', 'b', 'c', 'd'], ideas: ['1', '2', '3'] }),
    );
    expect(report).toEqual({
      version: 'llm-day-v1',
      summary: 'Dan.',
      praise: ['a', 'b', 'c'],
      noticed: [],
      problems: [],
      ideas: ['1', '2'],
    });
  });

  it('model za write-report je Bornin izbor (2026-11-09) i zamjenjiv varijablom', () => {
    expect(llmModelFor('write-report', () => undefined)).toBe('claude-sonnet-5-5');
    expect(llmModelFor('write-report', (name) => (name === 'LLM_MODEL_WRITE_REPORT' ? 'x-model' : undefined))).toBe(
      'x-model',
    );
  });
});
