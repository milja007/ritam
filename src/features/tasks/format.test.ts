import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import type { Task } from '@/core/domain';
import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

import { durationText, taskSummary } from './format';

const i18n = createInstance();
void i18n.init({
  resources: { hr: { translation: hr }, en: { translation: en } },
  lng: 'hr',
  initAsync: false,
  interpolation: { escapeValue: false },
});

const task: Task = {
  id: 't',
  userId: 'u',
  createdAt: '2026-11-16T08:00:00.000Z',
  updatedAt: '2026-11-16T08:00:00.000Z',
  weekStart: '2026-11-16',
  title: 'Trening',
  durationMinutes: 90,
  timesPerWeek: 3,
  deadline: null,
  partOfDay: 'evening',
  energy: 'high',
  needs: '',
};

describe('sažetak zadatka', () => {
  it('trajanje', () => {
    const t = i18n.getFixedT('hr');
    expect(durationText(t, 45)).toBe('45 min');
    expect(durationText(t, 60)).toBe('1 h');
    expect(durationText(t, 90)).toBe('1 h 30 min');
  });

  it('srednja energija i „bilo kad“ se ne ponavljaju; rok s imenom dana', () => {
    expect(taskSummary(i18n.getFixedT('hr'), task, 'hr')).toBe('1 h 30 min · 3× tjedno · navečer · puno energije');
    expect(
      taskSummary(i18n.getFixedT('en'), { ...task, partOfDay: 'any', energy: 'medium', deadline: '2026-11-20' }, 'en'),
    ).toBe('1 h 30 min · 3× a week · by Friday');
  });
});
