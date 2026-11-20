import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { WidgetDayInput } from '@/core/widget';

import { refreshWidgetInBackground } from './widget-background';

let mockWidget: { updateSnapshot: jest.Mock } | null = null;
let mockSettings: { language: string } | null = null;
const mockLoadInput = jest.fn(async (..._args: unknown[]) => ({}) as WidgetDayInput);
const mockPush = jest.fn((..._args: unknown[]) => null);

jest.mock('@/db/open', () => ({ getDb: () => ({}) }));
jest.mock('@/db/repos', () => ({ getSettings: async () => mockSettings }));
jest.mock('@/ui/theme', () => ({ getColorTheme: () => 'zora' }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'en', getFixedT: (language: string) => `t:${language}` },
  languageFor: (preference: string) => (preference === 'system' ? 'en' : preference),
}));
jest.mock('./widget-native', () => ({ loadRitamDayWidget: async () => mockWidget }));
jest.mock('./widget-content', () => ({ loadWidgetInput: (...args: unknown[]) => mockLoadInput(...args) }));
jest.mock('./widget-refresh', () => ({ pushWidgetUpdate: (...args: unknown[]) => mockPush(...args) }));

const now = new Date(2026, 10, 20, 14, 0);

beforeEach(() => {
  mockWidget = { updateSnapshot: jest.fn() };
  mockSettings = null;
  mockLoadInput.mockClear();
  mockPush.mockClear();
});

describe('refreshWidgetInBackground', () => {
  it('does nothing without a widget in the build', async () => {
    mockWidget = null;
    await expect(refreshWidgetInBackground('android', now)).resolves.toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('uses the saved language (app may not be running) and the device theme', async () => {
    mockSettings = { language: 'hr' };
    await expect(refreshWidgetInBackground('android', now)).resolves.toBe(true);
    expect(mockLoadInput).toHaveBeenCalledWith(now, 't:hr', 'zora');
    expect(mockPush).toHaveBeenCalledWith(mockWidget, {}, now, 'android');
  });

  it('falls back to the current language without settings', async () => {
    await refreshWidgetInBackground('android', now);
    expect(mockLoadInput).toHaveBeenCalledWith(now, 't:en', 'zora');
  });
});
