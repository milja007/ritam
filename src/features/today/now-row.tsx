import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ScheduleBlock } from '@/core/domain';
import { spacing } from '@/core/theme';
import { Orb, RailLineView } from '@/ui/ember';
import { Text } from '@/ui/text';

import { RAIL_WIDTH, TIME_WIDTH } from './block-card';

type NowRowProps = {
  /** Lokalno vrijeme „HH:MM“. */
  time: string;
  /** Aktivnost koja traje, ili `null` (slobodno). */
  current: ScheduleBlock | null;
  /** Ima li iznad izgorjelog dijela dana / ispod plana. */
  hasPast: boolean;
  hasUpcoming: boolean;
  onOpen: (block: ScheduleBlock) => void;
};

/**
 * Redak „Sada“ na traci dana (smjer „Žar“): orb-plamen putuje niz raspored — iznad njega
 * je izgorjeli dio dana, ispod tek ocrtan plan.
 */
export function NowRow({ time, current, hasPast, hasUpcoming, onOpen }: NowRowProps) {
  const { t } = useTranslation();
  const label = current
    ? t('today.rail.nowLabel', { time, title: current.title })
    : t('today.rail.nowFreeLabel', { time });

  const content = (
    <>
      <View style={styles.timeCol}>
        <Text variant="bodyStrong" tone="accent" style={styles.tabular}>
          {time}
        </Text>
      </View>
      <View style={styles.rail}>
        <View style={styles.segment}>{hasPast ? <RailLineView kind="burnt" /> : null}</View>
        <Orb />
        <View style={styles.segment}>{hasUpcoming ? <RailLineView kind="ahead" /> : null}</View>
      </View>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
        {current ? t('today.rail.now', { title: current.title }) : t('today.rail.nowFree')}
      </Text>
    </>
  );

  return current ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('today.blockHint')}
      onPress={() => onOpen(current)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: 56 },
  timeCol: { width: TIME_WIDTH, alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
  rail: { width: RAIL_WIDTH, alignSelf: 'stretch', alignItems: 'center' },
  segment: { flex: 1, alignItems: 'center' },
  title: { flex: 1 },
});
