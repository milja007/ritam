import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { SCORE_AREAS, selectedScoreAreas, type ScoreArea, type Settings } from '@/core/domain';
import { scoreWeights } from '@/core/progress';
import { radius, spacing } from '@/core/theme';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

export type ScoreAreaFlags = Pick<Settings, 'scorePlan' | 'scoreRules' | 'scoreSleep'>;

const FIELD: Record<ScoreArea, keyof ScoreAreaFlags> = {
  plan: 'scorePlan',
  rules: 'scoreRules',
  sleep: 'scoreSleep',
};

/**
 * Izbor područja dnevnog rezultata (korak 16c, odluka P39): plan / zabrane / san, bilo koja
 * kombinacija, barem jedno. Uz svako uključeno područje piše njegov udio u rezultatu.
 * Koristi se u onboardingu i u Profilu.
 */
export function ScoreAreasPicker({
  value,
  onChange,
}: {
  value: ScoreAreaFlags;
  onChange: (patch: Partial<ScoreAreaFlags>) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const selected = selectedScoreAreas(value);
  const weights = scoreWeights(selected);

  return (
    <View style={styles.stack}>
      <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        {SCORE_AREAS.map((area) => {
          const field = FIELD[area];
          const on = value[field];
          const isLastOn = on && selected.length === 1;
          const label = t(`scoreAreas.${area}`);
          return (
            <View key={area} style={styles.row}>
              <View style={styles.rowText}>
                <Text>{label}</Text>
                <Text variant="caption" tone="textMuted">
                  {t(`scoreAreas.${area}Hint`)}
                </Text>
                {on ? (
                  <Text variant="caption" tone="accent">
                    {t('scoreAreas.weight', { weight: weights[area] })}
                  </Text>
                ) : null}
              </View>
              <Switch
                accessibilityLabel={on ? t('scoreAreas.a11y', { area: label, weight: weights[area] }) : label}
                value={on}
                // Zadnje uključeno područje se ne može isključiti.
                disabled={isLastOn}
                onValueChange={(next) => onChange({ [field]: next })}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          );
        })}
      </View>
      {selected.length === 1 ? (
        <Text variant="caption" tone="textMuted">
          {t('scoreAreas.lastOne')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
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
});
