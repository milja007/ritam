import { appendDictation, dictationProblem, recognitionLocale, voiceLevel } from './dictation';

describe('recognitionLocale', () => {
  it('maps app language to a recognition locale', () => {
    expect(recognitionLocale('hr')).toBe('hr-HR');
    expect(recognitionLocale('en')).toBe('en-US');
    expect(recognitionLocale('en-GB')).toBe('en-US');
    expect(recognitionLocale('EN')).toBe('en-US');
    expect(recognitionLocale('de')).toBe('hr-HR');
  });
});

describe('appendDictation', () => {
  it('fills an empty field and capitalizes', () => {
    expect(appendDictation('', 'trening u šest')).toBe('Trening u šest');
    expect(appendDictation('   ', '  trening   u šest ')).toBe('Trening u šest');
  });

  it('continues an unfinished sentence after a space', () => {
    expect(appendDictation('Trening 18-19,', 'zubar u tri')).toBe('Trening 18-19, zubar u tri');
    expect(appendDictation('Trening ', 'ujutro')).toBe('Trening ujutro');
  });

  it('starts a new sentence after a full stop', () => {
    expect(appendDictation('Bilo je teško.', 'sutra bolje')).toBe('Bilo je teško. Sutra bolje');
    expect(appendDictation('Zašto?', 'ne znam')).toBe('Zašto? Ne znam');
  });

  it('keeps the base when nothing was said', () => {
    expect(appendDictation('Trening', '   ')).toBe('Trening');
  });

  it('respects maxLength on a word boundary', () => {
    expect(appendDictation('', 'jedan dva tri četiri', 12)).toBe('Jedan dva');
    expect(appendDictation('Abc', 'defghijklmnop', 8)).toBe('Abc');
    expect(appendDictation('', 'abcdefghij', 4)).toBe('Abcd');
    expect(appendDictation('', 'kratko', 200)).toBe('Kratko');
  });
});

describe('dictationProblem', () => {
  it('ignores a user abort', () => {
    expect(dictationProblem('aborted')).toBeNull();
  });

  it('maps permissions, availability and silence', () => {
    expect(dictationProblem('not-allowed')).toBe('permission');
    expect(dictationProblem('service-not-allowed')).toBe('permission');
    expect(dictationProblem('language-not-supported')).toBe('unavailable');
    expect(dictationProblem('audio-capture')).toBe('unavailable');
    expect(dictationProblem('no-speech')).toBe('noSpeech');
    expect(dictationProblem('speech-timeout')).toBe('noSpeech');
    expect(dictationProblem('network')).toBe('failed');
    expect(dictationProblem('something-new')).toBe('failed');
  });
});

describe('voiceLevel', () => {
  it('normalizes volume to 0–1', () => {
    expect(voiceLevel(-2)).toBe(0);
    expect(voiceLevel(10)).toBe(1);
    expect(voiceLevel(4)).toBeCloseTo(0.5);
    expect(voiceLevel(-50)).toBe(0);
    expect(voiceLevel(99)).toBe(1);
    expect(voiceLevel(Number.NaN)).toBe(0);
  });
});
