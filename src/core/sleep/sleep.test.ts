import { describe, expect, it } from '@jest/globals';

import { assessNight, bedtimeStep, sleepNights, summarizeNights } from './sleep';

/** 07:00 buđenje, 8 h sna → krevet 23:00; vikend bez zasebnog buđenja. */
const SETTINGS = { wakeTime: '07:00', weekendWakeTime: null, sleepHours: 8 };

describe('assessNight', () => {
  it('odmoran, kratko i jako kratko prema cilju', () => {
    expect(assessNight(SETTINGS, { sleepStart: '23:00', wakeTime: '07:00' })).toEqual({
      level: 'rested',
      minutes: 480,
      deficit: 0,
    });
    expect(assessNight(SETTINGS, { sleepStart: '23:30', wakeTime: '07:00' })?.level).toBe('rested');
    expect(assessNight(SETTINGS, { sleepStart: '00:00', wakeTime: '07:00' })).toEqual({
      level: 'short',
      minutes: 420,
      deficit: 60,
    });
    expect(assessNight(SETTINGS, { sleepStart: '01:30', wakeTime: '07:00' })?.level).toBe('veryShort');
  });

  it('više sna od cilja nema manjak', () => {
    expect(assessNight(SETTINGS, { sleepStart: '22:00', wakeTime: '08:00' })?.deficit).toBe(0);
  });

  it('bez prijave ili neispravno → null', () => {
    expect(assessNight(SETTINGS, null)).toBeNull();
    expect(assessNight(SETTINGS, { sleepStart: null, wakeTime: '07:00' })).toBeNull();
    expect(assessNight(SETTINGS, { sleepStart: '07:00', wakeTime: '07:00' })).toBeNull();
  });
});

describe('sleepNights', () => {
  it('7 noći od najstarije, rupe su prazne, kašnjenje preko ponoći', () => {
    const nights = sleepNights(
      SETTINGS,
      [
        { date: '2026-11-17', sleepStart: '00:15', wakeTime: '07:00' },
        { date: '2026-11-15', sleepStart: '22:45', wakeTime: '07:00' },
        { date: '2026-11-01', sleepStart: '23:00', wakeTime: '07:00' },
      ],
      '2026-11-17',
    );
    expect(nights.map((night) => night.date)).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
    ]);
    expect(nights[6]).toMatchObject({ minutes: 405, lateBy: 75, level: 'short', targetBedtime: '23:00' });
    expect(nights[4]).toMatchObject({ minutes: 495, lateBy: -15, level: 'rested' });
    expect(nights[5]).toMatchObject({ minutes: null, lateBy: null, level: null, sleepStart: null });
  });

  it('ciljani krevet prati vikend buđenje', () => {
    const weekend = { ...SETTINGS, weekendWakeTime: '09:00' };
    // 2026-11-14 je subota: noć prije (petak navečer) prati subotnje buđenje → krevet 01:00.
    const [night] = sleepNights(weekend, [{ date: '2026-11-14', sleepStart: '01:00', wakeTime: '09:00' }], '2026-11-14', 1);
    expect(night).toMatchObject({ targetBedtime: '01:00', lateBy: 0, level: 'rested' });
  });
});

describe('summarizeNights', () => {
  it('prosjek samo prijavljenih noći', () => {
    const nights = sleepNights(
      SETTINGS,
      [
        { date: '2026-11-16', sleepStart: '23:00', wakeTime: '07:00' },
        { date: '2026-11-17', sleepStart: '00:00', wakeTime: '07:00' },
      ],
      '2026-11-17',
    );
    expect(summarizeNights(nights)).toEqual({ logged: 2, averageMinutes: 450, averageLateBy: 30, rested: 1 });
  });

  it('bez prijava', () => {
    expect(summarizeNights(sleepNights(SETTINGS, [], '2026-11-17'))).toEqual({
      logged: 0,
      averageMinutes: null,
      averageLateBy: null,
      rested: 0,
    });
  });
});

describe('bedtimeStep', () => {
  const late = (sleepStart: string, dates: string[]) =>
    dates.map((date) => ({ date, sleepStart, wakeTime: '07:00' }));

  it('krevet kasni ~1 h → večeras 15 min ranije od navike (23:45)', () => {
    const nights = sleepNights(SETTINGS, late('00:00', ['2026-11-15', '2026-11-16', '2026-11-17']), '2026-11-17');
    expect(bedtimeStep(SETTINGS, nights, '2026-11-17')).toEqual({
      target: '23:00',
      tonight: '23:45',
      laterThanTarget: 45,
      stepping: true,
    });
  });

  it('kašnjenje do 15 min → ravno cilj, bez koraka', () => {
    const nights = sleepNights(SETTINGS, late('23:15', ['2026-11-15', '2026-11-16', '2026-11-17']), '2026-11-17');
    expect(bedtimeStep(SETTINGS, nights, '2026-11-17')).toMatchObject({ tonight: '23:00', stepping: false });
  });

  it('kašnjenje 20 min → korak je već cilj', () => {
    const nights = sleepNights(SETTINGS, late('23:20', ['2026-11-15', '2026-11-16', '2026-11-17']), '2026-11-17');
    expect(bedtimeStep(SETTINGS, nights, '2026-11-17')).toMatchObject({
      tonight: '23:00',
      laterThanTarget: 0,
      stepping: true,
    });
  });

  it('manje od 3 noći → cilj', () => {
    const nights = sleepNights(SETTINGS, late('01:00', ['2026-11-16', '2026-11-17']), '2026-11-17');
    expect(bedtimeStep(SETTINGS, nights, '2026-11-17')).toMatchObject({ tonight: '23:00', stepping: false });
  });

  it('raniji krevet od cilja se ne pomiče kasnije', () => {
    const nights = sleepNights(SETTINGS, late('22:00', ['2026-11-15', '2026-11-16', '2026-11-17']), '2026-11-17');
    expect(bedtimeStep(SETTINGS, nights, '2026-11-17')).toMatchObject({ tonight: '23:00', stepping: false });
  });

  it('korak preko ponoći', () => {
    const nights = sleepNights(SETTINGS, late('01:40', ['2026-11-15', '2026-11-16', '2026-11-17']), '2026-11-17');
    // kasni 160 → 150 − 15 = 135 → 01:15
    expect(bedtimeStep(SETTINGS, nights, '2026-11-17')).toMatchObject({ tonight: '01:15', laterThanTarget: 135 });
  });
});
