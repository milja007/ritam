import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  archiveByMonth,
  archiveLimit,
  archivePage,
  type ArchiveEntry,
  type DiagnosisLine,
  type Trend,
} from '@/core/diagnosis';
import { radius, spacing } from '@/core/theme';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listDayReportArchive } from '@/db/repos';
import { Button } from '@/ui/button';
import { Text, type TextProps } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { DiagnosisModal } from './diagnosis-modal';

const TREND_ARROW: Record<Trend, string> = { better: '↑', same: '→', worse: '↓', first: '✦' };
// Bez crvenog: slabiji dan je informacija, ne kazna.
const TREND_TONE: Record<Trend, NonNullable<TextProps['tone']>> = {
  better: 'success',
  same: 'info',
  worse: 'textMuted',
  first: 'accent',
};
/** Najmanja visina dodirljivog reda arhive. */
const TOUCH_TARGET = 44;

type State = { key: string; status: 'ready' | 'error'; entries: ArchiveEntry[] };

/**
 * Arhiva dijagnoza na Profilu (Ž12, dio koraka 37c): prošle dnevne dijagnoze po mjesecima,
 * najnovija prvo, dodir otvara dijagnozu tog dana. Čita se samo popis — dijagnoza se ne generira
 * dok se red ne otvori. „Prikaži još“ dodaje sljedećih deset.
 */
export function DiagnosisArchive({
  checkinDay,
  dayLabel,
  monthLabel,
}: {
  /** Dan upita: arhiva ide do njega (budući dani se ne pokazuju). */
  checkinDay: string;
  /** Dugi naziv dana za naslov i oznake ("srijeda, 12. studenoga"). */
  dayLabel: (date: string) => string;
  /** Naziv mjeseca za zaglavlje grupe ("studeni 2026."). */
  monthLabel: (month: string) => string;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const limit = archiveLimit(page);
  const key = `${checkinDay}|${limit}`;

  useEffect(() => {
    let active = true;
    listDayReportArchive(getDb(), LOCAL_USER_ID, checkinDay, limit)
      .then((entries) => {
        if (active) setState({ key, status: 'ready', entries });
      })
      .catch((error: unknown) => {
        console.error('Loading diagnosis archive failed', error);
        if (active) setState({ key, status: 'error', entries: [] });
      });
    return () => {
      active = false;
    };
  }, [key, checkinDay, limit]);

  const close = useCallback(() => setOpenFor(null), []);
  const current = state?.key === key ? state : null;
  const lineText = (line: DiagnosisLine) => t(`diagnosis.lines.${line.key}`, line.params ?? {});
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (current === null) {
    return (
      <View style={card} accessibilityLabel={t('diagnosis.archive.title')}>
        <Header />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (current.status === 'error') {
    return (
      <View style={card}>
        <Header />
        <Text tone="danger">{t('diagnosis.archive.loadError')}</Text>
      </View>
    );
  }

  const { entries, more } = archivePage(current.entries, page);
  if (entries.length === 0) {
    return (
      <View style={card}>
        <Header />
        <Text tone="textMuted">{t('diagnosis.archive.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={card}>
      <Header />
      {archiveByMonth(entries).map(({ month, entries: days }) => (
        <View key={month} style={styles.month}>
          <Text variant="caption" tone="textMuted" accessibilityRole="header">
            {monthLabel(month)}
          </Text>
          {days.map((entry) => {
            const day = dayLabel(entry.date);
            return (
              <Pressable
                key={entry.date}
                accessibilityRole="button"
                accessibilityLabel={`${day}. ${t(`diagnosis.trend.${entry.trend}`)}. ${lineText(entry.summary)}${
                  entry.seen ? '' : ` ${t('diagnosis.archive.unseen')}`
                }`}
                accessibilityHint={t('diagnosis.archive.openHint')}
                onPress={() => setOpenFor(entry.date)}
                style={({ pressed }) => [
                  styles.row,
                  { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}>
                <Text variant="title" tone={TREND_TONE[entry.trend]} style={styles.arrow}>
                  {TREND_ARROW[entry.trend]}
                </Text>
                <View style={styles.rowText}>
                  <View style={styles.dayRow}>
                    <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                      {day}
                    </Text>
                    {entry.seen ? null : (
                      <View
                        style={[styles.dot, { backgroundColor: colors.accent }]}
                        accessible={false}
                        importantForAccessibility="no-hide-descendants"
                      />
                    )}
                  </View>
                  <Text variant="caption" tone="textMuted" numberOfLines={2}>
                    {lineText(entry.summary)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {more ? (
        <Button
          variant="secondary"
          label={t('diagnosis.archive.more')}
          onPress={() => setPage((value) => value + 1)}
        />
      ) : null}
      {openFor !== null ? (
        <DiagnosisModal date={openFor} dayLabel={dayLabel(openFor)} onClose={close} />
      ) : null}
    </View>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <Text variant="overline" tone="textMuted" accessibilityRole="header">
      {t('diagnosis.archive.title')}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  month: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  arrow: { width: 20, textAlign: 'center' },
  rowText: { flex: 1, gap: spacing.xxs },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
});
