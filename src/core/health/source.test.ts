import { healthNight } from './health';
import {
  dayQueryRange,
  healthAmount,
  nightQueryRange,
  sleepSamplesFromHealthConnect,
  sleepSamplesFromHealthKit,
  sleepStageFromHealthConnect,
  sleepStageFromHealthKit,
} from './source';

describe('sleepStageFromHealthKit', () => {
  it('maps inBed, all asleep variants and awake', () => {
    expect(sleepStageFromHealthKit(0)).toBe('inBed');
    expect([1, 3, 4, 5].map(sleepStageFromHealthKit)).toEqual(['asleep', 'asleep', 'asleep', 'asleep']);
    expect(sleepStageFromHealthKit(2)).toBe('awake');
  });

  it('drops unknown values', () => {
    expect(sleepStageFromHealthKit(9)).toBeNull();
    expect(sleepStageFromHealthKit(-1)).toBeNull();
  });
});

describe('sleepStageFromHealthConnect', () => {
  it('maps sleeping, light, deep and REM to asleep', () => {
    expect([2, 4, 5, 6].map(sleepStageFromHealthConnect)).toEqual(['asleep', 'asleep', 'asleep', 'asleep']);
    expect(sleepStageFromHealthConnect(1)).toBe('awake');
  });

  it('treats unknown and out of bed as no sleep', () => {
    expect(sleepStageFromHealthConnect(0)).toBeNull();
    expect(sleepStageFromHealthConnect(3)).toBeNull();
  });
});

describe('sleepSamplesFromHealthKit', () => {
  it('keeps mapped records and drops unknown ones', () => {
    const start = new Date(2026, 10, 18, 23);
    const end = new Date(2026, 10, 19, 7);
    expect(
      sleepSamplesFromHealthKit([
        { startDate: start, endDate: end, value: 3 },
        { startDate: start, endDate: end, value: 42 },
      ]),
    ).toEqual([{ start, end, stage: 'asleep' }]);
  });
});

describe('sleepSamplesFromHealthConnect', () => {
  it('uses the whole session as sleep when it has no stages', () => {
    const samples = sleepSamplesFromHealthConnect([
      { startTime: new Date(2026, 10, 18, 23, 30).toISOString(), endTime: new Date(2026, 10, 19, 7).toISOString() },
    ]);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.stage).toBe('asleep');
    expect(healthNight(samples, '2026-11-19')).toEqual({
      sleepStart: '23:30',
      wakeTime: '07:00',
      minutes: 450,
      basis: 'asleep',
    });
  });

  it('uses only stages when present, so a long awake gap splits the night', () => {
    const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();
    const samples = sleepSamplesFromHealthConnect([
      {
        startTime: at(18, 23),
        endTime: at(19, 7),
        stages: [
          { startTime: at(18, 23), endTime: at(19, 2), stage: 4 },
          { startTime: at(19, 2), endTime: at(19, 4), stage: 1 },
          { startTime: at(19, 4), endTime: at(19, 7), stage: 6 },
          { startTime: at(19, 7), endTime: at(19, 7, 10), stage: 3 },
        ],
      },
    ]);
    expect(samples.map((s) => s.stage)).toEqual(['asleep', 'awake', 'asleep']);
    // Prekid 2 h (dulji od 60 min) dijeli noć na dva bloka od 3 h — ne broji se 8 h.
    const night = healthNight(samples, '2026-11-19');
    expect(night?.minutes).toBe(180);
  });
});

describe('query ranges', () => {
  it('night range starts at noon the day before and ends at 14:00', () => {
    expect(nightQueryRange('2026-11-19')).toEqual({
      start: new Date(2026, 10, 18, 12),
      end: new Date(2026, 10, 19, 14),
    });
  });

  it('night range crosses month and year boundaries', () => {
    expect(nightQueryRange('2027-01-01')?.start).toEqual(new Date(2026, 11, 31, 12));
  });

  it('day range is local midnight to midnight', () => {
    expect(dayQueryRange('2026-11-19')).toEqual({
      start: new Date(2026, 10, 19),
      end: new Date(2026, 10, 20),
    });
  });

  it('rejects invalid dates', () => {
    expect(nightQueryRange('2026-02-30')).toBeNull();
    expect(dayQueryRange('x')).toBeNull();
  });
});

describe('healthAmount', () => {
  it('rounds valid amounts and rejects missing or invalid ones', () => {
    expect(healthAmount(8421.6)).toBe(8422);
    expect(healthAmount(0)).toBe(0);
    expect(healthAmount(null)).toBeNull();
    expect(healthAmount(undefined)).toBeNull();
    expect(healthAmount(Number.NaN)).toBeNull();
    expect(healthAmount(-3)).toBeNull();
  });
});
