import { describe, expect, it } from '@jest/globals';

import { EXAMPLE_MONTH_THURSDAYS } from '../../../supabase/functions/_shared/report-examples';
import {
  acceptModelMonthReport,
  buildMonthReportSystemPrompt,
  buildMonthReportUserMessage,
  MONTH_REPORT_PROMPT_VERSION,
  parseWriteMonthReportRequest,
  parseWriteWeekReportRequest,
} from '../../../supabase/functions/_shared/report-logic';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Mutable = Record<string, unknown> & { month: Record<string, unknown> };

describe('write-report mjesec — zahtjev (korak 31d)', () => {
  it('primjer prolazi: statistika do 31 dan, smjer, odgovori na tjedne promjene', () => {
    const req = parseWriteMonthReportRequest(clone(EXAMPLE_MONTH_THURSDAYS));
    expect(req?.month.recorded).toBe(24);
    expect(req?.month.sleep?.nights).toBe(24);
    expect(req?.ideas).toHaveLength(2);
    expect(req?.changes).toEqual({ accepted: 2, rejected: 1 });
    expect(req?.days).toHaveLength(3);
  });

  it('start mora biti prvi dan, statistika mora pokrivati cijeli mjesec; tjedni parser ga ne prihvaća', () => {
    expect(parseWriteMonthReportRequest({ ...clone(EXAMPLE_MONTH_THURSDAYS), start: '2026-11-02' })).toBeNull();
    const wrongEnd = clone(EXAMPLE_MONTH_THURSDAYS) as unknown as Mutable;
    wrongEnd.month.end = '2026-11-29';
    expect(parseWriteMonthReportRequest(wrongEnd)).toBeNull();
    const tooMany = clone(EXAMPLE_MONTH_THURSDAYS) as unknown as Mutable;
    tooMany.month.recorded = 32;
    expect(parseWriteMonthReportRequest(tooMany)).toBeNull();
    expect(parseWriteWeekReportRequest(clone(EXAMPLE_MONTH_THURSDAYS))).toBeNull();
  });

  it('dani izvan mjeseca, kasnije dijagnoze i višak ideja otpadaju; neispravni odgovori → 0', () => {
    const raw = clone(EXAMPLE_MONTH_THURSDAYS) as unknown as Mutable;
    (raw.days as unknown[]).push({ date: '2026-12-01', score: 50, rating: null, comments: [], broken: [] });
    raw.ideas = ['a', 'b', 'c'];
    raw.previous = [{ date: '2026-11-01', summary: 'isti', ideas: [] }, { date: '2026-10-01', summary: 'listopad', ideas: [] }];
    raw.changes = { accepted: -1, rejected: 'x' };
    const req = parseWriteMonthReportRequest(raw);
    expect(req?.days.every((d) => d.date.startsWith('2026-11'))).toBe(true);
    expect(req?.ideas).toEqual(['a', 'b']);
    expect(req?.previous.map((p) => p.date)).toEqual(['2026-10-01']);
    expect(req?.changes).toEqual({ accepted: 0, rejected: 0 });
  });
});

describe('write-report mjesec — prompt llm-month-v1', () => {
  it('uputa: mjesečna, smjer se ne mijenja, ideasWhy', () => {
    const prompt = buildMonthReportSystemPrompt('hr');
    expect(prompt).toContain('MJESEČNU');
    expect(prompt).toContain('NE mijenjaj');
    expect(prompt).toContain('"ideasWhy"');
  });

  it('poruka ima mjesec s brojem dana, dane po danu u tjednu, smjer i tjedne promjene', () => {
    const message = buildMonthReportUserMessage(parseWriteMonthReportRequest(clone(EXAMPLE_MONTH_THURSDAYS))!);
    expect(message).toContain('Zaključeni dani: 24/30');
    expect(message).toContain('u krevet na vrijeme 15/24');
    expect(message).toContain('2026-11-05 (četvrtak)');
    expect(message).toContain('"Četvrtkom planiraj lakše — jedna stvar manje."');
    expect(message).toContain('prihvaćeno 2, odbijeno 1');
    expect(message).toContain('312.00 €');
  });
});

describe('write-report mjesec — odgovor modela', () => {
  const ok = {
    summary: 'Mjesec je bio bolji od prošlog, a četvrtci su i dalje najteži.',
    praise: ['Druga polovica mjeseca je bila jača.'],
    noticed: ['Četvrtkom rezultat pada.'],
    problems: [],
    ideasWhy: 'Lakši četvrtak skida najveći teret tjedna.',
  };

  it('prihvaća valjan odgovor i dodaje verziju; ideasWhy neobavezan; krivi oblik → null', () => {
    expect(acceptModelMonthReport(JSON.stringify(ok))).toEqual({ version: MONTH_REPORT_PROMPT_VERSION, ...ok });
    expect(acceptModelMonthReport(JSON.stringify({ ...ok, ideasWhy: null }))?.ideasWhy).toBeNull();
    expect(acceptModelMonthReport(JSON.stringify({ ...ok, noticed: [1] }))).toBeNull();
    expect(acceptModelMonthReport('{')).toBeNull();
  });
});
