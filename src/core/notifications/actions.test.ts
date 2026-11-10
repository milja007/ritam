import { describe, expect, it } from '@jest/globals';

import {
  blockActionOpensApp,
  BLOCK_ACTIONS,
  BLOCK_CATEGORY_ID,
  blockNotificationData,
  dailyNotificationData,
  parseNotificationData,
  parseNotificationResponse,
  usesBackgroundNotificationTask,
} from './actions';

const TAP = 'expo.modules.notifications.actions.DEFAULT';

describe('kategorija akcija', () => {
  it('id kategorije nema znakove koje paket zabranjuje', () => {
    expect(BLOCK_CATEGORY_ID).not.toMatch(/[:-]/);
  });

  it('Gotovo / Odgodi / Iskrslo, tim redom', () => {
    expect(BLOCK_ACTIONS).toEqual(['done', 'snooze', 'cameUp']);
  });
});

describe('parseNotificationData', () => {
  it('prihvaća naše payloade', () => {
    const daily = dailyNotificationData('evening', 'evening:2026-11-09@21:15');
    expect(parseNotificationData(daily)).toEqual(daily);
    expect(parseNotificationData(blockNotificationData('b1'))).toEqual(blockNotificationData('b1'));
  });

  it('odbija tuđe i neispravne', () => {
    for (const data of [
      null,
      undefined,
      'ritam',
      [],
      {},
      { source: 'drugi', type: 'daily', kind: 'morning', triggerId: 'x' },
      { source: 'ritam', type: 'daily', kind: 'lunch', triggerId: 'x' },
      { source: 'ritam', type: 'daily', kind: 'morning' },
      { source: 'ritam', type: 'block', blockId: '' },
      { source: 'ritam', type: 'block', blockId: 5 },
      { source: 'ritam', type: 'nesto' },
    ]) {
      expect(parseNotificationData(data)).toBeNull();
    }
  });

  it('ne prenosi višak polja', () => {
    const parsed = parseNotificationData({ ...blockNotificationData('b1'), extra: true });
    expect(parsed).toEqual({ source: 'ritam', type: 'block', blockId: 'b1' });
  });
});

describe('parseNotificationResponse', () => {
  const morning = dailyNotificationData('morning', 'morning:2026-11-09@07:00');
  const block = blockNotificationData('b1');

  it('dodir dnevne obavijesti otvara app za tu vrstu', () => {
    expect(parseNotificationResponse(TAP, morning, TAP)).toEqual({ type: 'open', kind: 'morning' });
  });

  it('dnevne obavijesti nemaju gumbe', () => {
    expect(parseNotificationResponse('done', morning, TAP)).toBeNull();
  });

  it('dodir obavijesti bloka otvara blok', () => {
    expect(parseNotificationResponse(TAP, block, TAP)).toEqual({ type: 'openBlock', blockId: 'b1' });
  });

  it('gumbi bloka', () => {
    for (const action of BLOCK_ACTIONS) {
      expect(parseNotificationResponse(action, block, TAP)).toEqual({
        type: 'blockAction',
        action,
        blockId: 'b1',
      });
    }
  });

  it('nepoznata akcija ili tuđa obavijest → null', () => {
    expect(parseNotificationResponse('delete', block, TAP)).toBeNull();
    expect(parseNotificationResponse(TAP, { foo: 1 }, TAP)).toBeNull();
  });
});

describe('blockActionOpensApp', () => {
  it('Gotovo i Odgodi bez otvaranja appa, Iskrslo otvara (P27)', () => {
    expect(blockActionOpensApp('done')).toBe(false);
    expect(blockActionOpensApp('snooze')).toBe(false);
    expect(blockActionOpensApp('cameUp')).toBe(true);
  });
});

describe('usesBackgroundNotificationTask', () => {
  it('samo Android registrira pozadinski zadatak; iOS (lokalni podsjetnici) i web ne', () => {
    expect(usesBackgroundNotificationTask('android')).toBe(true);
    expect(usesBackgroundNotificationTask('ios')).toBe(false);
    expect(usesBackgroundNotificationTask('web')).toBe(false);
  });
});
