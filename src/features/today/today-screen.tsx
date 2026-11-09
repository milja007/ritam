import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScheduleBlock } from '@/core/domain';
import {
  blockPhase,
  currentBlockId,
  draftFromBlock,
  newBlockDraft,
  type BlockDraft,
} from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { BlockCard } from './block-card';
import { BlockEditor } from './block-editor';
import { useDayBlocks, useNow } from './use-today';

type Editing =
  | { mode: 'add'; draft: BlockDraft }
  | { mode: 'edit'; draft: BlockDraft; id: string };

/** "2026-11-09" → "ponedjeljak, 9. studenoga" / "Monday, November 9" (po jeziku appa). */
function formatDay(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  try {
    return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(value);
  } catch {
    return date;
  }
}

/** Tab Danas: timeline današnjih blokova, trenutni istaknut, kvačica Gotovo, dodavanje/uređivanje. */
export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const now = useNow();
  const day = useDayBlocks(now.date);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  const currentId = currentBlockId(day.blocks, now.minutes);

  function openAdd() {
    setEditing({ mode: 'add', draft: newBlockDraft(day.blocks, now.minutes) });
  }

  function openEdit(block: ScheduleBlock) {
    setEditing({ mode: 'edit', draft: draftFromBlock(block), id: block.id });
  }

  async function toggle(block: ScheduleBlock) {
    setActionFailed(false);
    try {
      await day.toggleDone(block);
    } catch (error: unknown) {
      console.error('Toggling block failed', error);
      setActionFailed(true);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text variant="overline" tone="textMuted">
              {t('tabs.today')}
            </Text>
            <Text variant="title" accessibilityRole="header">
              {formatDay(now.date, i18n.language)}
            </Text>
          </View>

          {day.status === 'loading' ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : day.status === 'error' ? (
            <View style={styles.message}>
              <Text tone="danger">{t('today.loadError')}</Text>
              <Button variant="secondary" label={t('today.retry')} onPress={day.reload} />
            </View>
          ) : day.blocks.length === 0 ? (
            <View
              style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="heading">{t('today.emptyTitle')}</Text>
              <Text tone="textMuted">{t('today.emptyBody')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {day.blocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  phase={blockPhase(block, now.minutes)}
                  isCurrent={block.id === currentId}
                  onPress={() => openEdit(block)}
                  onToggleDone={() => void toggle(block)}
                />
              ))}
            </View>
          )}

          {actionFailed ? (
            <Text tone="danger" accessibilityLiveRegion="assertive">
              {t('today.actionError')}
            </Text>
          ) : null}

          {day.status === 'ready' ? (
            <Button variant="secondary" label={t('today.addBlock')} onPress={openAdd} />
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {editing ? (
        // Editor se montira pri svakom otvaranju, pa uvijek kreće od svježeg nacrta.
        <BlockEditor
          mode={editing.mode}
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSave={(draft) =>
            editing.mode === 'add' ? day.add(draft) : day.edit(editing.id, draft)
          }
          onDelete={editing.mode === 'edit' ? () => day.remove(editing.id) : undefined}
        />
      ) : null}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  loading: { marginTop: spacing.xxl },
  message: { gap: spacing.md },
  list: { gap: spacing.sm },
  empty: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
