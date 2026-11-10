import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { ScheduleBlock } from '@/core/domain';
import { blockPhase, isDone } from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** Vodoravni razmak sadržaja briefa (mora odgovarati paddingu ekrana). */
const SCREEN_PADDING = spacing.xl;
const CARD_GAP = spacing.sm;

/** Raspored dana kao kartice koje se listaju vodoravno, od trenutnog/sljedećeg bloka. */
export function DayCards({
  blocks,
  nowMinutes,
  startIndex,
}: {
  /** Blokovi bez sna, redom. */
  blocks: readonly ScheduleBlock[];
  nowMinutes: number;
  startIndex: number;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(200, width - SCREEN_PADDING * 2);
  const interval = cardWidth + CARD_GAP;
  const [index, setIndex] = useState(startIndex);

  if (blocks.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="heading">{t('morning.cards.emptyTitle')}</Text>
        <Text tone="textMuted">{t('morning.cards.emptyBody')}</Text>
      </View>
    );
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / interval);
    setIndex(Math.min(blocks.length - 1, Math.max(0, next)));
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        contentOffset={{ x: startIndex * interval, y: 0 }}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.scroller}
        contentContainerStyle={[styles.row, { paddingHorizontal: SCREEN_PADDING }]}>
        {blocks.map((block, i) => {
          const phase = blockPhase(block, nowMinutes);
          const current = phase === 'current';
          const done = isDone(block);
          const time = t('today.timeRange', { start: block.start, end: block.end });
          return (
            <View
              key={block.id}
              accessible
              accessibilityLabel={t('morning.cards.label', {
                position: i + 1,
                total: blocks.length,
                title: block.title,
                time,
                kind: t(`today.kind.${block.kind}`),
              })}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: current ? colors.surfaceRaised : colors.surface,
                  borderColor: current ? colors.accent : colors.border,
                  borderWidth: current ? 2 : StyleSheet.hairlineWidth,
                  opacity: done || phase === 'past' ? 0.6 : 1,
                },
              ]}>
              <View style={styles.cardTop}>
                <Text variant="overline" tone={current ? 'accent' : 'textMuted'}>
                  {current ? t('today.now') : t(`today.kind.${block.kind}`)}
                </Text>
                <Text variant="caption" tone="textMuted">
                  {t('morning.cards.position', { position: i + 1, total: blocks.length })}
                </Text>
              </View>
              <Text variant="display" tone={current ? 'accent' : 'text'}>
                {block.start}
              </Text>
              <Text variant="heading" numberOfLines={3}>
                {block.title}
              </Text>
              <Text tone="textMuted">
                {done ? t('morning.cards.done') : t('morning.cards.until', { end: block.end })}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {blocks.map((block, i) => (
          <View
            key={block.id}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.accent : colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  // Kartice idu od ruba do ruba ekrana, pa poništi padding roditelja.
  scroller: { marginHorizontal: -SCREEN_PADDING },
  row: { gap: CARD_GAP },
  card: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    minHeight: 200,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  empty: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
