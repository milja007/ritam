import { expect, it } from '@jest/globals';

import { widgetPlaceholder } from '@/core/widget';

import { RITAM_DAY_PLACEHOLDER } from './placeholder';

it('početni sadržaj widgeta jednak je onome iz core/widget (boje i tekstovi)', () => {
  expect(RITAM_DAY_PLACEHOLDER).toEqual(widgetPlaceholder());
});
