import { describe, expect, it } from '@jest/globals';

import { shownAfterPendingChange } from './level-up-gate';

describe('shownAfterPendingChange', () => {
  it('keeps the celebration while the same level-up is pending', () => {
    expect(shownAfterPendingChange('3-4', '3-4')).toBe('3-4');
  });

  it('forgets the celebration when the pending level-up disappears (reload on day change)', () => {
    expect(shownAfterPendingChange('3-4', null)).toBeNull();
  });

  it('does not reopen by itself when the same level-up comes back', () => {
    // nestalo → vratilo se: ostaje skriveno dok domaćin ponovno ne potvrdi fokus, blokadu i pauzu
    const afterLoading = shownAfterPendingChange('3-4', null);
    expect(shownAfterPendingChange(afterLoading, '3-4')).toBeNull();
  });

  it('forgets the celebration when a different level-up replaces it', () => {
    expect(shownAfterPendingChange('3-4', '3-5')).toBeNull();
  });

  it('stays hidden when nothing was shown', () => {
    expect(shownAfterPendingChange(null, '3-4')).toBeNull();
    expect(shownAfterPendingChange(null, null)).toBeNull();
  });
});
