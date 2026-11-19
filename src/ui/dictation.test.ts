import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  cancelDictation,
  dictationAvailable,
  getDictationState,
  setSpeechModuleForTests,
  startDictation,
  stopDictation,
  type SpeechModule,
} from './dictation';

jest.mock('./haptics', () => ({ playHaptic: () => undefined }));

type Listener = (event?: unknown) => void;

function fakeModule(options: { granted?: boolean; available?: boolean } = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const calls: string[] = [];
  let lastStart: Parameters<SpeechModule['start']>[0] | null = null;
  const speech: SpeechModule = {
    start: (startOptions) => {
      calls.push('start');
      lastStart = startOptions;
    },
    stop: () => {
      calls.push('stop');
    },
    abort: () => {
      calls.push('abort');
    },
    requestPermissionsAsync: () => Promise.resolve({ granted: options.granted ?? true }),
    isRecognitionAvailable: () => options.available ?? true,
    addListener: (event, listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener as Listener);
      listeners.set(event, set);
      return { remove: () => set.delete(listener as Listener) };
    },
  };
  const emit = (event: string, payload?: unknown) => {
    for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
  };
  const count = () => [...listeners.values()].reduce((total, set) => total + set.size, 0);
  return { speech, emit, calls, count, lastStart: () => lastStart };
}

describe('dictation', () => {
  beforeEach(() => {
    setSpeechModuleForTests(null);
  });

  it('is unavailable without the native module', async () => {
    expect(dictationAvailable()).toBe(false);
    const onText = jest.fn();
    await startDictation('a', { base: '', language: 'hr', onText });
    expect(getDictationState().status).toBe('idle');
  });

  it('reports availability from the module', () => {
    setSpeechModuleForTests(fakeModule({ available: false }).speech);
    expect(dictationAvailable()).toBe(false);
    setSpeechModuleForTests(fakeModule().speech);
    expect(dictationAvailable()).toBe(true);
  });

  it('listens on device in the app language and writes interim and final text', async () => {
    const fake = fakeModule();
    setSpeechModuleForTests(fake.speech);
    const texts: string[] = [];
    await startDictation('plan', { base: 'Trening 18-19,', language: 'hr', onText: (text) => texts.push(text) });

    expect(fake.lastStart()).toMatchObject({ lang: 'hr-HR', requiresOnDeviceRecognition: true, interimResults: true });
    fake.emit('start');
    expect(getDictationState()).toMatchObject({ owner: 'plan', status: 'listening' });

    fake.emit('volumechange', { value: 4 });
    expect(getDictationState().level).toBeCloseTo(0.5);

    fake.emit('result', { isFinal: false, results: [{ transcript: 'zubar' }] });
    fake.emit('result', { isFinal: true, results: [{ transcript: 'zubar u tri' }] });
    expect(texts).toEqual(['Trening 18-19, zubar', 'Trening 18-19, zubar u tri']);

    stopDictation('plan');
    expect(fake.calls).toContain('stop');
    fake.emit('end');
    expect(getDictationState()).toMatchObject({ owner: null, status: 'idle', problem: null });
    expect(fake.count()).toBe(0);
  });

  it('reports a denied permission without starting', async () => {
    const fake = fakeModule({ granted: false });
    setSpeechModuleForTests(fake.speech);
    await startDictation('note', { base: '', language: 'en', onText: () => undefined });
    expect(fake.calls).not.toContain('start');
    expect(getDictationState().problem).toEqual({ owner: 'note', kind: 'permission' });
  });

  it('maps recognition errors and ignores a user abort', async () => {
    const fake = fakeModule();
    setSpeechModuleForTests(fake.speech);
    await startDictation('note', { base: '', language: 'en', onText: () => undefined });
    expect(fake.lastStart()).toMatchObject({ lang: 'en-US' });
    fake.emit('error', { error: 'no-speech' });
    fake.emit('end');
    expect(getDictationState()).toMatchObject({ status: 'idle', problem: { owner: 'note', kind: 'noSpeech' } });

    await startDictation('note', { base: '', language: 'en', onText: () => undefined });
    fake.emit('error', { error: 'aborted' });
    expect(getDictationState().problem).toBeNull();
  });

  it('a new field takes over and the old one gets no more text', async () => {
    const fake = fakeModule();
    setSpeechModuleForTests(fake.speech);
    const first = jest.fn();
    const second = jest.fn();
    await startDictation('a', { base: '', language: 'hr', onText: first });
    await startDictation('b', { base: '', language: 'hr', onText: second });
    expect(fake.calls).toContain('abort');
    fake.emit('result', { isFinal: true, results: [{ transcript: 'tekst' }] });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Tekst');
    expect(getDictationState().owner).toBe('b');
  });

  it('cancel clears the session and ignores other owners', async () => {
    const fake = fakeModule();
    setSpeechModuleForTests(fake.speech);
    await startDictation('a', { base: '', language: 'hr', onText: () => undefined });
    cancelDictation('other');
    expect(getDictationState().owner).toBe('a');
    cancelDictation('a');
    expect(getDictationState().owner).toBeNull();
    expect(fake.count()).toBe(0);
  });
});
