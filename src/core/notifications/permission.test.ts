import { describe, expect, it } from '@jest/globals';

import { decidePermission } from './permission';

describe('decidePermission', () => {
  it('dopušteno', () => {
    expect(decidePermission({ status: 'granted', granted: true, canAskAgain: true })).toBe('allowed');
  });

  it('iOS provisional se računa kao dopušteno', () => {
    expect(
      decidePermission({ status: 'undetermined', granted: false, canAskAgain: true, iosProvisional: true }),
    ).toBe('allowed');
  });

  it('još nije odlučeno → pitaj', () => {
    expect(decidePermission({ status: 'undetermined', granted: false, canAskAgain: true })).toBe('ask');
  });

  it('odbijeno → ne pitaj ponovo, ni kad sustav dopušta', () => {
    expect(decidePermission({ status: 'denied', granted: false, canAskAgain: true })).toBe('denied');
    expect(decidePermission({ status: 'denied', granted: false, canAskAgain: false })).toBe('denied');
  });

  it('neodlučeno, ali sustav ne dopušta pitanje → odbijeno', () => {
    expect(decidePermission({ status: 'undetermined', granted: false, canAskAgain: false })).toBe('denied');
  });
});
