import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { setHealthEnabled, useHealthEnabled } from './health-prefs';

/** Ime izvora za prikaz: Zdravlje (iOS) ili Health Connect (Android). */
export function useHealthSourceName(): string {
  const { t } = useTranslation();
  return Platform.OS === 'ios' ? t('health.sourceIos') : t('health.sourceAndroid');
}

/**
 * Profil → Zdravlje: prekidač za čitanje sna, koraka i aktivnih kalorija (korak 39).
 * Uključivanje traži dopuštenje; ako Health na uređaju nije dostupan, prekidač ostaje isključen
 * i ispod piše zašto.
 */
export function HealthToggle() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const on = useHealthEnabled();
  const source = useHealthSourceName();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const label = t('health.label', { source });

  async function change(next: boolean) {
    setBusy(true);
    setUnavailable(false);
    try {
      setUnavailable((await setHealthEnabled(next)) === 'unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text>{label}</Text>
          <Text variant="caption" tone="textMuted">
            {t('health.detail')}
          </Text>
        </View>
        <Switch
          accessibilityLabel={label}
          accessibilityHint={t('health.detail')}
          value={on}
          disabled={busy}
          onValueChange={(next) => void change(next)}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>
      {unavailable ? (
        <Text style={styles.note} tone="danger" accessibilityLiveRegion="polite">
          {t('health.unavailable', { source })}
        </Text>
      ) : on ? (
        <Text style={styles.note} variant="caption" tone="textMuted">
          {t('health.permissionHint', { source })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xxs,
  },
  rowText: { flex: 1, gap: spacing.xxs },
  note: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
