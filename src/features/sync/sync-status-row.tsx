import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { Text } from '@/ui/text';

import { runSync, useSyncStatus } from './sync-runner';

function formatWhen(iso: string, language: string): string {
  const date = new Date(iso);
  const locale = language === 'hr' ? 'hr-HR' : 'en-US';
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Stanje synca u kartici Račun (korak 19): zadnja sinkronizacija / greška + "Sinkroniziraj sada". */
export function SyncStatusRow() {
  const { t, i18n } = useTranslation();
  const status = useSyncStatus();
  const syncing = status.state === 'syncing';

  return (
    <View style={styles.row}>
      <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
        {syncing
          ? t('sync.syncing')
          : status.lastSyncAt
            ? t('sync.lastSync', { when: formatWhen(status.lastSyncAt, i18n.language) })
            : t('sync.never')}
      </Text>
      {status.state === 'error' ? (
        <Text tone="danger" accessibilityLiveRegion="assertive">
          {t('sync.error')}
        </Text>
      ) : null}
      <Button variant="ghost" label={t('sync.now')} loading={syncing} onPress={() => void runSync()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
});
