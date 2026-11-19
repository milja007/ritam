import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing } from '@/core/theme';

import {
  cancelDictation,
  clearDictationProblem,
  dictationAvailable,
  startDictation,
  stopDictation,
  useDictationState,
} from './dictation';
import { DictationButton } from './dictation-button';
import { Text } from './text';
import { useAppTheme } from './theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  /**
   * Glasovni unos (korak 30): mikrofon uz polje upisuje izgovoreno iza postojećeg teksta.
   * Prikazuje se samo kad uređaj može diktirati; traži kontrolirano polje (`value` + `onChangeText`).
   */
  dictation?: boolean;
};

/** Polje za unos teksta s nazivom iznad. */
export function TextField({ label, style, dictation = false, ...rest }: TextFieldProps) {
  const theme = useAppTheme();
  const input = (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.accent}
      style={[
        theme.typography.body,
        styles.input,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      {...rest}
    />
  );
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      {dictation && dictationAvailable() ? (
        <DictationRow input={input} label={label} {...rest} />
      ) : (
        input
      )}
    </View>
  );
}

type DictationRowProps = TextInputProps & { input: React.ReactElement; label: string };

function DictationRow({ input, value, onChangeText, maxLength, editable }: DictationRowProps) {
  const { t, i18n } = useTranslation();
  const owner = useId();
  const dictation = useDictationState();
  const mine = dictation.owner === owner;
  const listening = mine && dictation.status === 'listening';
  const starting = mine && dictation.status === 'starting';
  const problem = dictation.problem?.owner === owner ? dictation.problem.kind : null;

  // Rezultati stižu asinkrono — uvijek piši kroz zadnji `onChangeText`.
  const onChangeRef = useRef(onChangeText);
  useEffect(() => {
    onChangeRef.current = onChangeText;
  }, [onChangeText]);

  // Polje nestaje (zatvoren list, sljedeći korak upita) → prestani slušati.
  useEffect(() => () => cancelDictation(owner), [owner]);

  // Polje postane nedostupno (spremanje u tijeku) → prestani slušati.
  useEffect(() => {
    if (editable === false) cancelDictation(owner);
  }, [editable, owner]);

  function toggle() {
    if (mine && dictation.status !== 'idle') {
      stopDictation(owner);
      return;
    }
    clearDictationProblem(owner);
    void startDictation(owner, {
      base: value ?? '',
      maxLength,
      language: i18n.language,
      onText: (text) => onChangeRef.current?.(text),
    });
  }

  return (
    <View style={styles.dictation}>
      <View style={styles.row}>
        <View style={styles.grow}>{input}</View>
        <DictationButton
          listening={listening}
          starting={starting}
          level={mine ? dictation.level : 0}
          disabled={editable === false}
          onPress={toggle}
        />
      </View>
      {listening ? (
        <Text variant="caption" tone="accent" accessibilityLiveRegion="polite">
          {t('dictation.listening')}
        </Text>
      ) : problem ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {t(`dictation.problem.${problem}`)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  dictation: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
