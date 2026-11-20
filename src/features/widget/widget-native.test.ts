import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { loadRitamDayWidget, resetWidgetLoaderForTests } from './widget-native';

let mockOs = 'android';
let mockModule: object | null = null;
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOs;
    },
  },
}));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockModule }));
const mockUpdate = jest.fn();
const importWidget = () => Promise.resolve({ default: { updateSnapshot: mockUpdate } });


beforeEach(() => {
  resetWidgetLoaderForTests();
  mockOs = 'android';
  mockModule = null;
});

describe('loadRitamDayWidget (opcionalno)', () => {
  it('does nothing on a build without the native module', async () => {
    await expect(loadRitamDayWidget(importWidget)).resolves.toBeNull();
  });

  it('does nothing on iOS until the App Group exists (decision 94a)', async () => {
    mockOs = 'ios';
    mockModule = {};
    await expect(loadRitamDayWidget(importWidget)).resolves.toBeNull();
  });

  it('a failing import is no widget, not a crash', async () => {
    mockModule = {};
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(loadRitamDayWidget(() => Promise.reject(new Error('no module')))).resolves.toBeNull();
  });

  it('loads the widget on Android with the native module', async () => {
    mockModule = {};
    const widget = await loadRitamDayWidget(importWidget);
    expect(widget?.updateSnapshot).toBe(mockUpdate);
  });
});
