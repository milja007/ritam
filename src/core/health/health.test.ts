import { describe, expect, it } from '@jest/globals';

import { dailyHealthTotal, healthNight, healthSleepFill, type SleepSample } from './health';

/** Lokalno vrijeme: (dan u studenom 2026, sat, minuta). */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, day, hour, minute);
}

function sleep(stage: SleepSample['stage'], from: Date, to: Date): SleepSample {
  return { stage, start: from, end: to };
}

describe('healthNight', () => {
  it('spaja faze sna s kratkim buđenjem u jednu noć; prekid se ne broji', () => {
    const night = healthNight(
      [
        sleep('inBed', at(18, 22, 40), at(19, 7, 5)),
        sleep('asleep', at(18, 23, 5), at(19, 2, 0)),
        sleep('awake', at(19, 2, 0), at(19, 2, 20)),
        sleep('asleep', at(19, 2, 20), at(19, 6, 50)),
      ],
      '2026-11-19',
    );
    expect(night).toEqual({ sleepStart: '23:05', wakeTime: '06:50', minutes: 445, basis: 'asleep' });
  });

  it('preklapanja iz dva izvora (sat i mobitel) ne broje se dvaput', () => {
    const night = healthNight(
      [sleep('asleep', at(18, 23, 0), at(19, 5, 0)), sleep('asleep', at(19, 4, 0), at(19, 7, 0))],
      '2026-11-19',
    );
    expect(night).toMatchObject({ sleepStart: '23:00', wakeTime: '07:00', minutes: 480 });
  });

  it('prekid dulji od sat vremena dijeli noć; uzima se dulji blok', () => {
    const night = healthNight(
      [sleep('asleep', at(18, 21, 0), at(18, 22, 30)), sleep('asleep', at(19, 0, 0), at(19, 7, 0))],
      '2026-11-19',
    );
    expect(night).toMatchObject({ sleepStart: '00:00', wakeTime: '07:00', minutes: 420 });
  });

  it('bez „spava“ uzoraka koristi vrijeme u krevetu', () => {
    expect(healthNight([sleep('inBed', at(18, 23, 30), at(19, 7, 15))], '2026-11-19')).toEqual({
      sleepStart: '23:30',
      wakeTime: '07:15',
      minutes: 465,
      basis: 'inBed',
    });
  });

  it('popodnevno drijemanje ne pobjeđuje noć; samo drijemanje poslije 14:00 nije noć', () => {
    const samples = [sleep('asleep', at(18, 23, 0), at(19, 6, 0)), sleep('asleep', at(19, 13, 0), at(19, 15, 30))];
    expect(healthNight(samples, '2026-11-19')).toMatchObject({ sleepStart: '23:00', wakeTime: '06:00' });
    expect(healthNight([sleep('asleep', at(19, 15, 0), at(19, 16, 30))], '2026-11-19')).toBeNull();
  });

  it('san koji završi prije ponoći nije noć tog jutra; točno u ponoć jest (Codex P2, #69)', () => {
    expect(healthNight([sleep('asleep', at(18, 19, 0), at(18, 23, 0))], '2026-11-19')).toBeNull();
    expect(healthNight([sleep('asleep', at(18, 20, 0), at(19, 0, 0))], '2026-11-19')).toEqual({
      sleepStart: '20:00',
      wakeTime: '00:00',
      minutes: 240,
      basis: 'asleep',
    });
    // Isti blok nije noć prethodnog jutra (prozor tog dana završava u 14:00).
    expect(healthNight([sleep('asleep', at(18, 20, 0), at(19, 0, 0))], '2026-11-18')).toBeNull();
  });

  it('noć prethodnog dana ne ulazi u prozor; blok kraći od sat vremena nije noć', () => {
    const lastNight = sleep('asleep', at(17, 23, 0), at(18, 7, 0));
    expect(healthNight([lastNight], '2026-11-19')).toBeNull();
    expect(healthNight([sleep('asleep', at(19, 5, 0), at(19, 5, 40))], '2026-11-19')).toBeNull();
  });

  it('dugi uzorak se reže na prozor (18:00 – 14:00)', () => {
    expect(healthNight([sleep('inBed', at(18, 12, 0), at(19, 16, 0))], '2026-11-19')).toMatchObject({
      sleepStart: '18:00',
      wakeTime: '14:00',
    });
  });

  it('neispravni uzorci i datum se preskaču', () => {
    const broken = [
      sleep('asleep', at(19, 7, 0), at(18, 23, 0)),
      sleep('asleep', new Date(Number.NaN), at(19, 7, 0)),
    ];
    expect(healthNight(broken, '2026-11-19')).toBeNull();
    expect(healthNight([sleep('asleep', at(18, 23, 0), at(19, 7, 0))], '2026-02-30')).toBeNull();
    expect(healthNight([], '2026-11-19')).toBeNull();
  });
});

describe('dailyHealthTotal', () => {
  it('zbraja uzorke dana; uzorak preko ponoći dijeli razmjerno', () => {
    const total = dailyHealthTotal(
      [
        { start: at(19, 8, 0), end: at(19, 9, 0), value: 4000 },
        { start: at(19, 23, 30), end: at(20, 0, 30), value: 1000 },
        { start: at(18, 23, 0), end: at(19, 1, 0), value: 600 },
        { start: at(20, 9, 0), end: at(20, 10, 0), value: 9999 },
      ],
      '2026-11-19',
    );
    expect(total).toBe(4000 + 500 + 300);
  });

  it('trenutni uzorak broji se cijeli u svom danu; negativno i neispravno otpada', () => {
    const total = dailyHealthTotal(
      [
        { start: at(19, 12, 0), end: at(19, 12, 0), value: 35 },
        { start: at(20, 0, 0), end: at(20, 0, 0), value: 99 },
        { start: at(19, 13, 0), end: at(19, 14, 0), value: -10 },
        { start: at(19, 13, 0), end: at(19, 14, 0), value: Number.NaN },
        { start: at(19, 15, 0), end: at(19, 14, 0), value: 50 },
      ],
      '2026-11-19',
    );
    expect(total).toBe(35);
  });

  it('prazno → 0, neispravan datum → null', () => {
    expect(dailyHealthTotal([], '2026-11-19')).toBe(0);
    expect(dailyHealthTotal([], '19.11.2026')).toBeNull();
  });
});

describe('healthSleepFill', () => {
  const night = { sleepStart: '23:05', wakeTime: '06:50', minutes: 445, basis: 'asleep' as const };

  it('predlaže kad upita nema ili je san prazan', () => {
    expect(healthSleepFill(null, night)).toEqual({ sleepStart: '23:05', wakeTime: '06:50' });
    expect(healthSleepFill({ sleepStart: null, wakeTime: null }, night)).toEqual({
      sleepStart: '23:05',
      wakeTime: '06:50',
    });
  });

  it('ručni unos pobjeđuje, i djelomičan', () => {
    expect(healthSleepFill({ sleepStart: '00:30', wakeTime: null }, night)).toBeNull();
    expect(healthSleepFill({ sleepStart: null, wakeTime: '07:00' }, night)).toBeNull();
  });

  it('bez noći nema prijedloga', () => {
    expect(healthSleepFill(null, null)).toBeNull();
  });
});
