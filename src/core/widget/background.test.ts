import { describe, expect, it } from '@jest/globals';

import { usesWidgetBackgroundRefresh, WIDGET_BACKGROUND_INTERVAL_MINUTES } from './background';

describe('usesWidgetBackgroundRefresh', () => {
  it('samo Android (iOS ima vremensku crtu, web nema widget)', () => {
    expect(usesWidgetBackgroundRefresh('android')).toBe(true);
    expect(usesWidgetBackgroundRefresh('ios')).toBe(false);
    expect(usesWidgetBackgroundRefresh('web')).toBe(false);
  });

  it('razmak poštuje WorkManager minimum od 15 minuta', () => {
    expect(WIDGET_BACKGROUND_INTERVAL_MINUTES).toBeGreaterThanOrEqual(15);
  });
});
