import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockOs = 'android';
let mockNative: object | null = {};
let mockStatus = 2;
let mockRegistered = false;
const mockDefineTask = jest.fn();
const mockRegisterTask = jest.fn(async (..._args: unknown[]) => undefined);
const mockRefresh = jest.fn(async (..._args: unknown[]) => true);

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOs;
    },
  },
}));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
jest.mock('expo-task-manager', () => ({
  isTaskDefined: () => false,
  defineTask: (...args: unknown[]) => mockDefineTask(...args),
  isTaskRegisteredAsync: async () => mockRegistered,
}));
const backgroundTask = {
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: async () => mockStatus,
  registerTaskAsync: (...args: unknown[]) => mockRegisterTask(...args),
};
const importBackgroundTask = () => Promise.resolve(backgroundTask as never);
const importRefresh = () =>
  Promise.resolve({ refreshWidgetInBackground: (...args: unknown[]) => mockRefresh(...args) } as never);

type TaskModule = typeof import('./widget-task');

function load(os: string): TaskModule {
  mockOs = os;
  let module: TaskModule | undefined;
  jest.isolateModules(() => {
    module = jest.requireActual<TaskModule>('./widget-task');
  });
  if (!module) throw new Error('module not loaded');
  return module;
}

beforeEach(() => {
  mockNative = {};
  mockStatus = 2;
  mockRegistered = false;
  mockDefineTask.mockClear();
  mockRegisterTask.mockClear();
  mockRefresh.mockClear();
  mockRefresh.mockImplementation(async () => true);
});

describe('widget refresh task', () => {
  it('is defined only on Android', () => {
    load('ios');
    expect(mockDefineTask).not.toHaveBeenCalled();
    load('android');
    expect(mockDefineTask).toHaveBeenCalledWith('ritam-widget-refresh', expect.any(Function));
  });

  it('registers every 15 minutes, once per launch', async () => {
    const task = load('android');
    await expect(task.registerWidgetRefresh(importBackgroundTask)).resolves.toBe(true);
    await task.registerWidgetRefresh(importBackgroundTask);
    expect(mockRegisterTask).toHaveBeenCalledTimes(1);
    expect(mockRegisterTask).toHaveBeenCalledWith('ritam-widget-refresh', { minimumInterval: 15 });
  });

  it('keeps an already registered task (WorkManager does not restart)', async () => {
    mockRegistered = true;
    await expect(load('android').registerWidgetRefresh(importBackgroundTask)).resolves.toBe(true);
    expect(mockRegisterTask).not.toHaveBeenCalled();
  });

  it('does nothing on iOS, on an old build, or when background work is restricted', async () => {
    await expect(load('ios').registerWidgetRefresh(importBackgroundTask)).resolves.toBe(false);
    mockNative = null;
    await expect(load('android').registerWidgetRefresh(importBackgroundTask)).resolves.toBe(false);
    mockNative = {};
    mockStatus = 1;
    await expect(load('android').registerWidgetRefresh(importBackgroundTask)).resolves.toBe(false);
    expect(mockRegisterTask).not.toHaveBeenCalled();
  });

  it('runs the refresh and reports failure without throwing', async () => {
    const task = load('android');
    await expect(task.runWidgetRefreshTask(importRefresh)).resolves.toBe(1);
    expect(mockRefresh).toHaveBeenCalledWith('android');
    mockRefresh.mockImplementation(async () => {
      throw new Error('db');
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(task.runWidgetRefreshTask(importRefresh)).resolves.toBe(2);
    error.mockRestore();
  });
});
