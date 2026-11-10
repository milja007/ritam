import { describe, expect, it } from '@jest/globals';

import type { BlockKind, BlockStatus } from '../domain';
import { canGiveUp, eveningReminderNeeds, giveUpBlocks, isDayResolved, shouldOfferDiagnosis } from '.';

const b = (id: string, status: BlockStatus = 'planned', kind: BlockKind = 'task') => ({ id, kind, status });

describe('giveUpBlocks', () => {
  it('closes every unresolved block except sleep, past, current and future alike', () => {
    const blocks = [
      b('sleep', 'planned', 'sleep'),
      b('done', 'done'),
      b('partial', 'partial'),
      b('cancelled', 'skipped'),
      b('moved', 'moved'),
      b('open1'),
      b('open2', 'planned', 'fixed'),
    ];
    expect(giveUpBlocks(blocks).map((block) => block.id)).toEqual(['open1', 'open2']);
    expect(canGiveUp(blocks)).toBe(true);
  });

  it('has nothing to give up when everything is resolved', () => {
    expect(canGiveUp([b('a', 'done'), b('s', 'planned', 'sleep')])).toBe(false);
    expect(canGiveUp([])).toBe(false);
  });
});

describe('isDayResolved', () => {
  it('needs at least one reportable block', () => {
    expect(isDayResolved([])).toBe(false);
    expect(isDayResolved([b('s', 'planned', 'sleep')])).toBe(false);
  });

  it('is resolved when every block has an outcome (cancelled counts)', () => {
    expect(isDayResolved([b('a', 'done'), b('b', 'skipped'), b('c', 'partial'), b('d', 'moved')])).toBe(true);
    expect(isDayResolved([b('a', 'done'), b('b')])).toBe(false);
  });

  it('ignores an unreported sleep block', () => {
    expect(isDayResolved([b('a', 'done'), b('s', 'planned', 'sleep')])).toBe(true);
  });
});

describe('eveningReminderNeeds', () => {
  it('is empty when nothing is missing', () => {
    expect(
      eveningReminderNeeds({ blocks: [b('a', 'done')], tomorrowHasPlan: true, diagnosisSeen: true }),
    ).toEqual([]);
  });

  it('lists unreported blocks, missing tomorrow plan and an uncollected diagnosis', () => {
    expect(eveningReminderNeeds({ blocks: [b('a')], tomorrowHasPlan: false, diagnosisSeen: false })).toEqual([
      'report',
      'tomorrow',
    ]);
    expect(eveningReminderNeeds({ blocks: [b('a', 'done')], tomorrowHasPlan: true, diagnosisSeen: false })).toEqual([
      'diagnosis',
    ]);
  });

  it('does not offer a diagnosis for a day without a plan', () => {
    expect(eveningReminderNeeds({ blocks: [], tomorrowHasPlan: true, diagnosisSeen: false })).toEqual([]);
  });
});

describe('shouldOfferDiagnosis', () => {
  it('offers it once the day is resolved and until it is seen', () => {
    expect(shouldOfferDiagnosis([b('a', 'done')], false)).toBe(true);
    expect(shouldOfferDiagnosis([b('a', 'done')], true)).toBe(false);
    expect(shouldOfferDiagnosis([b('a')], false)).toBe(false);
  });
});
