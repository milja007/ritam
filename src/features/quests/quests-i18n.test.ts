import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import { QUEST_DEADLINES } from '@/core/gamification';
import en from '@/i18n/en.json';
import hr from '@/i18n/hr.json';

const i18n = createInstance();
void i18n.init({
  resources: { hr: { translation: hr }, en: { translation: en } },
  lng: 'hr',
  initAsync: false,
  interpolation: { escapeValue: false },
});

describe('tekstovi epskih questova', () => {
  it('rokovi i množina (HR one/few/other, EN one/other)', () => {
    const hrT = i18n.getFixedT('hr');
    const enT = i18n.getFixedT('en');
    expect(hrT('quests.daysLeft', { count: 1, date: '1. prosinca' })).toBe('Još 1 dan · 1. prosinca');
    expect(hrT('quests.daysLeft', { count: 3, date: 'x' })).toBe('Još 3 dana · x');
    expect(hrT('quests.daysLeft', { count: 5, date: 'x' })).toBe('Još 5 dana · x');
    expect(enT('quests.daysLeft', { count: 1, date: 'Dec 1' })).toBe('1 day left · Dec 1');
    for (const t of [hrT, enT]) {
      for (const deadline of QUEST_DEADLINES) {
        expect(t(`quests.editor.deadline.${deadline}`)).not.toContain('quests.');
      }
      expect(t('quests.progress', { done: 2, total: 5 })).toMatch(/2.*5/);
      expect(t('quests.confirmDoneMessage', { title: 'Q' })).toContain('Q');
      expect(t('badges.questA11y', { title: 'Maraton', date: '3. 12.' })).toMatch(/Maraton.*3\. 12\./);
      expect(t('badges.questEarned', { date: 'd' })).toContain('d');
      expect(t('badges.questRule')).not.toContain('badges.');
      for (const key of ['confirmDoneMessage', 'doneA11y', 'milestoneDoneA11y', 'milestoneHint', 'milestoneDoneOn', 'doneOn'] as const) {
        expect(t(`quests.${key}`, { title: 'Q', date: 'd' })).not.toMatch(/XP|{{/);
      }
    }
  });
});
