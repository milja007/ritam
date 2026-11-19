import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { CALORIE_GOAL_MAX, CALORIE_GOAL_MIN, MONEY_PERIODS, type MoneyPeriod, type Settings } from '@/core/domain';
import { radius, spacing } from '@/core/theme';
import { isLowCalorieGoal } from '@/core/trackers';
import type { SettingsInput } from '@/db/repos';
import { Button } from '@/ui/button';
import { ChoiceGroup } from '@/ui/choice-group';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { formatEuro, parseEuroCents, parseKcal } from './format';

type TrackersSettingsProps = {
  settings: Settings;
  save: (patch: Partial<SettingsInput>) => void;
  today: string;
};

/** Iznos u centima kao tekst za polje („12,50“ / „12.50“), bez oznake valute. */
const euroField = (cents: number | null, language: string) =>
  cents === null ? '' : (cents / 100).toFixed(2).replace('.', language.startsWith('en') ? '.' : ',');

/**
 * Profil → Trackeri (korak 31b): kalorije i novac, isključeni po defaultu. Cilj kalorija s
 * upozorenjem za neuobičajeno nizak cilj; limit potrošnje za dan/tjedan/mjesec, po želji stanje i
 * prihodi (korak 31f, opcija novca, zadano isključena).
 */
export function TrackersSettings({ settings, save, today }: TrackersSettingsProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const language = i18n.language;
  const [goal, setGoal] = useState(settings.calorieGoal === null ? '' : String(settings.calorieGoal));
  const [limit, setLimit] = useState(euroField(settings.moneyLimitCents, language));
  const [period, setPeriod] = useState<MoneyPeriod>(settings.moneyPeriod ?? 'week');
  const [balance, setBalance] = useState(euroField(settings.moneyBalanceCents, language));
  const [invalid, setInvalid] = useState<'goal' | 'limit' | 'balance' | null>(null);

  const parsedGoal = parseKcal(goal, CALORIE_GOAL_MAX);
  const goalValid = parsedGoal !== null && parsedGoal >= CALORIE_GOAL_MIN;
  const goalChanged = (goalValid ? parsedGoal : null) !== settings.calorieGoal || (goal.trim() !== '' && !goalValid);
  const parsedLimit = parseEuroCents(limit);
  const limitChanged = parsedLimit !== settings.moneyLimitCents || period !== settings.moneyPeriod;
  const parsedBalance = parseEuroCents(balance);
  const balanceChanged = parsedBalance !== settings.moneyBalanceCents;

  function saveGoal() {
    if (goal.trim() !== '' && !goalValid) {
      setInvalid('goal');
      return;
    }
    setInvalid(null);
    save({ calorieGoal: goal.trim() === '' ? null : parsedGoal });
  }

  function saveLimit() {
    if (limit.trim() !== '' && parsedLimit === null) {
      setInvalid('limit');
      return;
    }
    setInvalid(null);
    save(parsedLimit === null ? { moneyLimitCents: null, moneyPeriod: null } : { moneyLimitCents: parsedLimit, moneyPeriod: period });
  }

  function saveBalance() {
    if (balance.trim() !== '' && parsedBalance === null) {
      setInvalid('balance');
      return;
    }
    setInvalid(null);
    // Stanje vrijedi od danas: potrošnja od danas (uključivo) se oduzima.
    save(
      parsedBalance === null
        ? { moneyBalanceCents: null, moneyBalanceOn: null }
        : { moneyBalanceCents: parsedBalance, moneyBalanceOn: today },
    );
  }

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const caloriesLabel = t('trackers.settings.calories');
  const moneyLabel = t('trackers.settings.money');
  const incomeLabel = t('trackers.settings.income');

  return (
    <View style={styles.list}>
      <View style={card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{caloriesLabel}</Text>
            <Text variant="caption" tone="textMuted">
              {t('trackers.settings.caloriesDetail')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={caloriesLabel}
            value={settings.trackCalories}
            onValueChange={(value) => save({ trackCalories: value })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        {settings.trackCalories ? (
          <>
            <TextField
              label={t('trackers.settings.goal')}
              placeholder="2000"
              value={goal}
              onChangeText={(text) => {
                setGoal(text);
                setInvalid(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
            />
            {goalValid && isLowCalorieGoal(parsedGoal) ? (
              <Text variant="caption" tone="accent" accessibilityLiveRegion="polite">
                {t('trackers.settings.lowGoal')}
              </Text>
            ) : null}
            {invalid === 'goal' ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {t('trackers.settings.goalInvalid', { min: CALORIE_GOAL_MIN, max: CALORIE_GOAL_MAX })}
              </Text>
            ) : null}
            {goalChanged ? <Button variant="secondary" label={t('trackers.settings.saveGoal')} onPress={saveGoal} /> : null}
          </>
        ) : null}
      </View>

      <View style={card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{moneyLabel}</Text>
            <Text variant="caption" tone="textMuted">
              {t('trackers.settings.moneyDetail')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={moneyLabel}
            value={settings.trackMoney}
            onValueChange={(value) => save({ trackMoney: value })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        {settings.trackMoney ? (
          <>
            <TextField
              label={t('trackers.settings.limit')}
              placeholder={language.startsWith('en') ? '100.00' : '100,00'}
              value={limit}
              onChangeText={(text) => {
                setLimit(text);
                setInvalid(null);
              }}
              keyboardType="decimal-pad"
              maxLength={12}
            />
            <ChoiceGroup<MoneyPeriod>
              layout="row"
              accessibilityLabel={t('trackers.settings.period')}
              selected={period}
              onSelect={setPeriod}
              choices={MONEY_PERIODS.map((value) => ({ value, label: t(`trackers.settings.periods.${value}`) }))}
            />
            {invalid === 'limit' ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {t('trackers.settings.amountInvalid')}
              </Text>
            ) : null}
            {limitChanged ? <Button variant="secondary" label={t('trackers.settings.saveLimit')} onPress={saveLimit} /> : null}

            <TextField
              label={t('trackers.settings.balance')}
              placeholder={t('trackers.settings.balancePlaceholder')}
              value={balance}
              onChangeText={(text) => {
                setBalance(text);
                setInvalid(null);
              }}
              keyboardType="decimal-pad"
              maxLength={12}
            />
            {settings.moneyBalanceCents !== null && settings.moneyBalanceOn !== null && !balanceChanged ? (
              <Text variant="caption" tone="textMuted">
                {t(settings.trackIncome ? 'trackers.settings.balanceSinceIncome' : 'trackers.settings.balanceSince', {
                  value: formatEuro(settings.moneyBalanceCents, language),
                  date: settings.moneyBalanceOn.split('-').reverse().join('. ') + '.',
                })}
              </Text>
            ) : null}
            {invalid === 'balance' ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {t('trackers.settings.amountInvalid')}
              </Text>
            ) : null}
            {balanceChanged ? (
              <Button variant="secondary" label={t('trackers.settings.saveBalance')} onPress={saveBalance} />
            ) : null}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{incomeLabel}</Text>
                <Text variant="caption" tone="textMuted">
                  {t('trackers.settings.incomeDetail')}
                </Text>
              </View>
              <Switch
                accessibilityLabel={incomeLabel}
                value={settings.trackIncome}
                onValueChange={(value) => save({ trackIncome: value })}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  flex: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
