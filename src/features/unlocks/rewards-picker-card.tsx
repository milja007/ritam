import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { railColors } from '@/core/ember';
import {
  AVATAR_FRAMES,
  type AvatarFrameId,
  DONE_EFFECTS,
  type DoneEffectId,
  doneEffectUnlockLevel,
  frameUnlockLevel,
  type OrbFlame as OrbFlameState,
} from '@/core/gamification';
import { radius, spacing } from '@/core/theme';
import { useProgress } from '@/features/progress';
import { playHaptic } from '@/ui/haptics';
import { RailDot } from '@/ui/ember';
import { DoneFlare } from '@/ui/flare';
import { OrbFlame } from '@/ui/orb-flame';
import { setAvatarFrame, setDoneEffect, useAvatarFrame, useDoneEffect } from '@/ui/reward-prefs';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

/** Najmanja visina retka — dodirna meta od barem 44 pt. */
const ROW_MIN_HEIGHT = 56;
const PREVIEW = 40;
const DOT = 10;

/** Plamen za pregled okvira: topao, bez iskri i disanja (pregled stoji). */
const PREVIEW_FLAME: OrbFlameState = {
  rank: 'C',
  heat: 'warm',
  state: 'burning',
  average: 70,
  coreScale: 0.6,
  streak: 0,
  sparks: 0,
  pulseMs: 0,
};

type Locked = { kind: 'frame'; id: AvatarFrameId } | { kind: 'effect'; id: DoneEffectId };

/**
 * Birač okvira avatara i animacije „Gotovo“ na Profilu (korak 32b, Bornina odluka 2026-11-18:
 * nagrade po razini). Kao birač teme: zaključano je prigušeno, pokazuje razinu i na dodir objasni
 * kad se otključava. Odabir animacije je odmah i pokaže (točka bljesne), uz haptiku „Gotovo“.
 */
export function RewardsPickerCard({ today, checkinDay }: { today: string; checkinDay: string }) {
  const { t } = useTranslation();
  const { colors, scheme, flame } = useAppTheme();
  const progress = useProgress(today, checkinDay);
  const frame = useAvatarFrame();
  const effect = useDoneEffect();
  const [locked, setLocked] = useState<Locked | null>(null);
  // Pregled animacije: brojač po retku, raste na svaki odabir tog retka.
  const [previews, setPreviews] = useState<Partial<Record<DoneEffectId, number>>>({});
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (progress.status === 'loading') {
    return (
      <View style={cardStyle}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const level = progress.status === 'ready' ? progress.summary.level.level : 1;
  const dotColor = railColors(scheme, flame).lit;

  function toggleLocked(next: Locked) {
    setLocked((current) => (current?.kind === next.kind && current.id === next.id ? null : next));
  }

  const lockedName =
    locked === null
      ? null
      : locked.kind === 'frame'
        ? t(`unlocks.frames.${locked.id}`)
        : t(`unlocks.doneEffects.${locked.id}`);
  const lockedLevel =
    locked === null ? 0 : locked.kind === 'frame' ? frameUnlockLevel(locked.id) : doneEffectUnlockLevel(locked.id);

  return (
    <View style={cardStyle}>
      <Text variant="caption" tone="textMuted">
        {t('unlocks.rewards.hint')}
      </Text>

      <Text variant="overline" tone="textMuted">
        {t('unlocks.rewards.frames')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('unlocks.rewards.frames')} style={styles.list}>
        {AVATAR_FRAMES.map((id) => {
          const unlockLevel = frameUnlockLevel(id);
          return (
            <Choice
              key={id}
              name={t(`unlocks.frames.${id}`)}
              selected={id === frame}
              unlockLevel={unlockLevel}
              unlocked={unlockLevel <= level}
              onChoose={() => {
                setLocked(null);
                setAvatarFrame(id);
              }}
              onLocked={() => toggleLocked({ kind: 'frame', id })}
              preview={<OrbFlame flame={PREVIEW_FLAME} size={PREVIEW} active={false} frame={id} />}
            />
          );
        })}
      </View>

      <Text variant="overline" tone="textMuted">
        {t('unlocks.rewards.effects')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('unlocks.rewards.effects')} style={styles.list}>
        {DONE_EFFECTS.map((id) => {
          const unlockLevel = doneEffectUnlockLevel(id);
          return (
            <Choice
              key={id}
              name={t(`unlocks.doneEffects.${id}`)}
              selected={id === effect}
              unlockLevel={unlockLevel}
              unlocked={unlockLevel <= level}
              onChoose={() => {
                setLocked(null);
                setDoneEffect(id);
                setPreviews((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
                playHaptic('done');
              }}
              onLocked={() => toggleLocked({ kind: 'effect', id })}
              preview={
                <View style={styles.previewBox}>
                  <DoneFlare effect={id} trigger={previews[id] ?? 0} size={DOT} color={dotColor}>
                    <RailDot state="lit" size={DOT} />
                  </DoneFlare>
                </View>
              }
            />
          );
        })}
      </View>

      {locked !== null && lockedName !== null ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {t('unlocks.rewards.lockedInfo', { name: lockedName, level: lockedLevel, current: level })}
        </Text>
      ) : null}
    </View>
  );
}

function Choice({
  name,
  selected,
  unlocked,
  unlockLevel,
  onChoose,
  onLocked,
  preview,
}: {
  name: string;
  selected: boolean;
  unlocked: boolean;
  unlockLevel: number;
  onChoose: () => void;
  onLocked: () => void;
  preview: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !unlocked }}
      accessibilityLabel={unlocked ? name : t('unlocks.picker.lockedA11y', { name, level: unlockLevel })}
      onPress={unlocked ? onChoose : onLocked}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: selected ? colors.accent : 'transparent',
          backgroundColor: selected ? colors.surfaceRaised : 'transparent',
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <View style={[styles.preview, { opacity: unlocked ? 1 : 0.4 }]}>{preview}</View>
      <Text variant={selected ? 'bodyStrong' : 'body'} tone={unlocked ? 'text' : 'textMuted'} style={styles.name}>
        {name}
      </Text>
      {selected ? (
        <Text variant="caption" tone="accent">
          {t('unlocks.picker.selected')} ✓
        </Text>
      ) : unlocked ? null : (
        <View style={[styles.lock, { borderColor: colors.border }]}>
          <Text variant="caption" tone="textMuted" style={styles.tabular}>
            {t('unlocks.picker.locked', { level: unlockLevel })}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { gap: spacing.xs },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  preview: { width: PREVIEW, height: PREVIEW, alignItems: 'center', justifyContent: 'center' },
  previewBox: { width: PREVIEW, height: PREVIEW, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1 },
  lock: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
