import { requireOptionalNativeModule } from 'expo';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { appendDictation, dictationProblem, recognitionLocale, voiceLevel, type DictationProblem } from '@/core/voice';

import { playHaptic } from './haptics';

/**
 * Glasovni unos (korak 30) preko `expo-speech-recognition`.
 *
 * Modul se učitava **opcionalno** (`requireOptionalNativeModule`), ne uvozom paketa: development
 * build napravljen prije PR-a #63 nema native dio, a uvoz paketa bi tada srušio app. Bez modula
 * (stari build, web) mikrofon se jednostavno ne prikazuje.
 *
 * U jednom trenutku sluša samo jedno polje (`owner`); novo polje prekida staro.
 */

type Subscription = { remove(): void };

type SpeechEvents = {
  start: () => void;
  end: () => void;
  result: (event: { isFinal: boolean; results: { transcript: string }[] }) => void;
  error: (event: { error: string; message?: string }) => void;
  volumechange: (event: { value: number }) => void;
};

/** Dio API-ja `ExpoSpeechRecognitionModule` koji app koristi. */
export type SpeechModule = {
  start(options: {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    requiresOnDeviceRecognition: boolean;
    addsPunctuation: boolean;
    iosTaskHint?: 'unspecified' | 'dictation' | 'search' | 'confirmation';
    volumeChangeEventOptions?: { enabled?: boolean; intervalMillis?: number };
  }): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  addListener<K extends keyof SpeechEvents>(event: K, listener: SpeechEvents[K]): Subscription;
};

export type DictationStatus = 'idle' | 'starting' | 'listening';

export type DictationState = {
  owner: string | null;
  status: DictationStatus;
  /** Glasnoća 0–1 dok korisnik govori (sjaj mikrofona). */
  level: number;
  /** Zadnja poruka o grešci i polje kojem pripada. */
  problem: { owner: string; kind: DictationProblem } | null;
};

const IDLE: DictationState = { owner: null, status: 'idle', level: 0, problem: null };

let speechModule: SpeechModule | null | undefined;
let state: DictationState = IDLE;
let subscriptions: Subscription[] = [];
const listeners = new Set<() => void>();

function loadModule(): SpeechModule | null {
  if (speechModule !== undefined) return speechModule;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    speechModule = null;
    return null;
  }
  try {
    speechModule = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');
  } catch (error: unknown) {
    console.warn('Speech recognition module failed to load', error);
    speechModule = null;
  }
  return speechModule;
}

let available: boolean | null = null;

/** Može li se na ovom uređaju diktirati (modul postoji i prepoznavanje govora je dostupno). */
export function dictationAvailable(): boolean {
  if (available !== null) return available;
  const speech = loadModule();
  try {
    available = speech !== null && speech.isRecognitionAvailable();
  } catch (error: unknown) {
    console.warn('Speech recognition availability check failed', error);
    available = false;
  }
  return available;
}

function setState(next: DictationState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function detach() {
  for (const subscription of subscriptions) subscription.remove();
  subscriptions = [];
}

function finish(problem: DictationState['problem'] = null) {
  detach();
  setState({ ...IDLE, problem });
}

export type DictationRequest = {
  /** Tekst polja u trenutku početka; izgovoreno se dodaje iza njega. */
  base: string;
  maxLength?: number;
  /** Jezik appa (`i18n.language`). */
  language: string;
  /** Novi tekst polja (privremeni rezultati dok korisnik govori, pa konačni). */
  onText: (text: string) => void;
};

/**
 * Počni slušati za polje `owner`. Prvi put traži dopuštenje za mikrofon i prepoznavanje govora.
 * Prepoznavanje se traži **na uređaju** (`requiresOnDeviceRecognition`); iOS za jezik bez modela
 * na uređaju koristi Appleov poslužitelj (kao diktiranje na tipkovnici) — pitanje 93.
 */
export async function startDictation(owner: string, request: DictationRequest): Promise<void> {
  const speech = loadModule();
  if (!speech) return;
  if (state.owner !== null) cancelDictation(state.owner);
  setState({ owner, status: 'starting', level: 0, problem: null });

  let granted = false;
  try {
    granted = (await speech.requestPermissionsAsync()).granted;
  } catch (error: unknown) {
    console.warn('Speech permission request failed', error);
  }
  // Korisnik je u međuvremenu prekinuo ili je počelo drugo polje.
  if (state.owner !== owner) return;
  if (!granted) {
    finish({ owner, kind: 'permission' });
    return;
  }

  subscriptions = [
    speech.addListener('start', () => {
      if (state.owner !== owner) return;
      setState({ ...state, status: 'listening' });
      playHaptic('tick');
    }),
    speech.addListener('result', (event) => {
      if (state.owner !== owner) return;
      const transcript = event.results[0]?.transcript ?? '';
      request.onText(appendDictation(request.base, transcript, request.maxLength));
    }),
    speech.addListener('volumechange', (event) => {
      if (state.owner !== owner || state.status !== 'listening') return;
      setState({ ...state, level: voiceLevel(event.value) });
    }),
    speech.addListener('error', (event) => {
      if (state.owner !== owner) return;
      const kind = dictationProblem(event.error);
      finish(kind ? { owner, kind } : null);
    }),
    speech.addListener('end', () => {
      if (state.owner !== owner) return;
      finish(state.problem);
    }),
  ];

  try {
    speech.start({
      lang: recognitionLocale(request.language),
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    });
  } catch (error: unknown) {
    console.warn('Speech recognition failed to start', error);
    finish({ owner, kind: 'failed' });
  }
}

/** Završi slušanje (stigne konačni rezultat, zatim `end`). */
export function stopDictation(owner: string): void {
  if (state.owner !== owner) return;
  const speech = loadModule();
  if (state.status === 'starting' || !speech) {
    finish();
    return;
  }
  try {
    speech.stop();
  } catch (error: unknown) {
    console.warn('Speech recognition failed to stop', error);
    finish();
  }
}

/** Prekini bez rezultata (polje nestaje s ekrana, drugo polje počinje). */
export function cancelDictation(owner: string): void {
  if (state.owner !== owner) return;
  const speech = loadModule();
  finish();
  try {
    speech?.abort();
  } catch (error: unknown) {
    console.warn('Speech recognition failed to abort', error);
  }
}

/** Ukloni poruku o grešci za polje (korisnik je počeo tipkati ili ponovo diktirati). */
export function clearDictationProblem(owner: string): void {
  if (state.problem?.owner === owner) setState({ ...state, problem: null });
}

export function getDictationState(): DictationState {
  return state;
}

export function useDictationState(): DictationState {
  return useSyncExternalStore(subscribe, getDictationState, () => IDLE);
}

export function setSpeechModuleForTests(module: SpeechModule | null): void {
  speechModule = module;
  available = null;
  detach();
  state = IDLE;
}
