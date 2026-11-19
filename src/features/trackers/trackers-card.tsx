import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import type { Settings, TrackerEntry, TrackerKind } from '@/core/domain';
import { weekStart } from '@/core/progress';
import { radius, spacing } from '@/core/theme';
import { calorieCheck, moneySummary, trackerTotal } from '@/core/trackers';
import { useSettings } from '@/features/settings';
import { Button } from '@/ui/button';
import { ProgressBar } from '@/ui/progress-bar';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { formatEuro, formatKcal, parseEuroCents, parseKcal } from './format';
import { useTrackerEntries } from './use-trackers';

type TrackersCardProps = {
  /** Dan na koji se unosi i za koji se računa provjera. */
  date: string;
  /** Večernja provjera (kraj dana): „ispod cilja za X“ umjesto „još X do cilja“. */
  evening?: boolean;
};

const earliest = (...dates: (string | null)[]) =>
  dates.filter((value): value is string => value !== null).reduce((a, b) => (a < b ? a : b));

/**
 * Opcionalni trackeri (korak 31b) za jedan dan: kalorije (zbroj naspram cilja, unos po obroku)
 * i novac (koliko je ostalo od limita, tjedni i mjesečni zbroj, stanje, unos potrošnje; uz opciju
 * i prihodi, korak 31f). Prikazuje
 * se samo kad je barem jedan tracker uključen u Profilu. Bez crvenog: prekoračenje je informacija.
 */
export function TrackersCard({ date, evening = false }: TrackersCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { settings } = useSettings();
  const from = earliest(
    `${date.slice(0, 7)}-01`,
    weekStart(date),
    settings?.trackMoney && settings.moneyBalanceOn !== null && settings.moneyBalanceOn <= date
      ? settings.moneyBalanceOn
      : null,
  );
  const { entries, add, remove } = useTrackerEntries(from, date);

  if (settings === null || (!settings.trackCalories && !settings.trackMoney)) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="overline" tone="textMuted" accessibilityRole="header">
        {t(evening ? 'trackers.card.eveningOverline' : 'trackers.card.overline')}
      </Text>
      {entries === null ? (
        <Text tone="danger">{t('trackers.card.loadError')}</Text>
      ) : (
        <>
          {settings.trackCalories ? (
            <CaloriesSection date={date} evening={evening} goal={settings.calorieGoal} entries={entries} add={add} remove={remove} />
          ) : null}
          {settings.trackCalories && settings.trackMoney ? (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          ) : null}
          {settings.trackMoney ? (
            <MoneySection date={date} settings={settings} entries={entries} add={add} remove={remove} />
          ) : null}
        </>
      )}
    </View>
  );
}

type SectionProps = {
  date: string;
  entries: TrackerEntry[];
  add: ReturnType<typeof useTrackerEntries>['add'];
  remove: ReturnType<typeof useTrackerEntries>['remove'];
};

function CaloriesSection({ date, evening, goal, entries, add, remove }: SectionProps & { evening: boolean; goal: number | null }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const total = trackerTotal(entries, 'calories', date, date);
  const check = calorieCheck(total, goal);
  const kcal = (value: number) => formatKcal(value, i18n.language);
  const value = goal === null ? t('trackers.kcal', { value: kcal(total) }) : t('trackers.kcalOf', { value: kcal(total), goal: kcal(goal) });

  let status: string;
  if (goal === null) status = t('trackers.calories.noGoal');
  else if (check === null) status = t('trackers.calories.empty');
  else if (check.status === 'within') status = t('trackers.calories.within', { diff: kcal(Math.abs(check.difference)) });
  else if (check.status === 'over') status = t('trackers.calories.over', { diff: kcal(check.difference) });
  else status = t(evening ? 'trackers.calories.under' : 'trackers.calories.left', { diff: kcal(-check.difference) });

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="bodyStrong" style={styles.flex}>
          {t('trackers.calories.title')}
        </Text>
        <Text variant="bodyStrong" style={styles.tabular}>
          {value}
        </Text>
      </View>
      {goal !== null ? (
        <ProgressBar
          fraction={Math.min(1, total / goal)}
          accessibilityLabel={t('trackers.calories.title')}
          valueText={value}
          color={check?.status === 'over' ? colors.textMuted : undefined}
        />
      ) : null}
      <Text variant="caption" tone={check?.status === 'within' ? 'success' : 'textMuted'} accessibilityLiveRegion="polite">
        {status}
      </Text>
      <EntryList kind="calories" date={date} entries={entries} remove={remove} />
      <QuickAdd kind="calories" date={date} add={add} />
    </View>
  );
}

function MoneySection({ date, settings, entries, add, remove }: SectionProps & { settings: Settings }) {
  const { t, i18n } = useTranslation();
  const euro = (cents: number) => formatEuro(cents, i18n.language);
  const summary = moneySummary(entries, settings, date);
  const limit = summary.limit;
  const value = limit
    ? limit.remaining >= 0
      ? t('trackers.money.left', { value: euro(limit.remaining) })
      : t('trackers.money.overLimit', { value: euro(-limit.remaining) })
    : t('trackers.money.today', { value: euro(summary.today) });

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="bodyStrong" style={styles.flex}>
          {t('trackers.money.title')}
        </Text>
        <Text variant="bodyStrong" style={styles.tabular}>
          {value}
        </Text>
      </View>
      {limit ? (
        <>
          <ProgressBar
            fraction={Math.min(1, limit.spent / limit.cents)}
            accessibilityLabel={t('trackers.money.title')}
            valueText={value}
          />
          <Text variant="caption" tone="textMuted">
            {t(`trackers.money.limit.${limit.period}`, { spent: euro(limit.spent), limit: euro(limit.cents) })}
          </Text>
        </>
      ) : (
        <Text variant="caption" tone="textMuted">
          {t('trackers.money.noLimit')}
        </Text>
      )}
      <Text variant="caption" tone="textMuted" style={styles.tabular}>
        {t('trackers.money.totals', { week: euro(summary.week), month: euro(summary.month) })}
        {summary.balance !== null ? ` · ${t('trackers.money.balance', { value: euro(summary.balance) })}` : ''}
      </Text>
      <EntryList kind="money" date={date} entries={entries} remove={remove} />
      <QuickAdd kind="money" date={date} add={add} />
      {summary.income !== null ? (
        <IncomeSection date={date} income={summary.income} entries={entries} add={add} remove={remove} />
      ) : null}
    </View>
  );
}

/** Prihodi (korak 31f): zbrojevi s „+“, popis i unos; dodaju se stanju, ne limitu. */
function IncomeSection({
  date,
  income,
  entries,
  add,
  remove,
}: SectionProps & { income: { today: number; week: number; month: number } }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const plus = (cents: number) => `+${formatEuro(cents, i18n.language)}`;
  return (
    <View style={[styles.subsection, { borderTopColor: colors.border }]}>
      <View style={styles.head}>
        <Text variant="bodyStrong" style={styles.flex}>
          {t('trackers.income.title')}
        </Text>
        <Text variant="bodyStrong" tone="success" style={styles.tabular}>
          {plus(income.month)}
        </Text>
      </View>
      <Text variant="caption" tone="textMuted" style={styles.tabular}>
        {t('trackers.income.totals', { today: plus(income.today), week: plus(income.week), month: plus(income.month) })}
      </Text>
      <EntryList kind="income" date={date} entries={entries} remove={remove} />
      <QuickAdd kind="income" date={date} add={add} />
    </View>
  );
}

function EntryList({ kind, date, entries, remove }: { kind: TrackerKind; date: string; entries: TrackerEntry[]; remove: SectionProps['remove'] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const rows = entries.filter((entry) => entry.kind === kind && entry.date === date);
  if (rows.length === 0) return null;
  const amount = (entry: TrackerEntry) =>
    kind === 'calories'
      ? t('trackers.kcal', { value: formatKcal(entry.amount, i18n.language) })
      : `${kind === 'income' ? '+' : ''}${formatEuro(entry.amount, i18n.language)}`;
  return (
    <View style={styles.rows}>
      {rows.map((entry) => {
        const label = entry.note || t(`trackers.${kind}.unnamed`);
        return (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.flex} numberOfLines={1}>
              {label}
            </Text>
            <Text tone="textMuted" style={styles.tabular}>
              {amount(entry)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trackers.remove', { label, amount: amount(entry) })}
              onPress={() => remove(entry.id)}
              hitSlop={4}
              style={styles.remove}>
              <Text tone="textMuted" style={{ color: colors.textMuted }}>
                ×
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function QuickAdd({ kind, date, add }: { kind: TrackerKind; date: string; add: SectionProps['add'] }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);

  function submit() {
    const value = kind === 'calories' ? parseKcal(amount) : parseEuroCents(amount);
    if (value === null) {
      setError('invalid');
      return;
    }
    if (!add({ date, kind, amount: value, note: note.trim() })) {
      setError('failed');
      return;
    }
    setAmount('');
    setNote('');
    setError(null);
    AccessibilityInfo.announceForAccessibility(t(`trackers.${kind}.added`));
  }

  return (
    <View style={styles.addBlock}>
      <View style={styles.addRow}>
        <View style={styles.amount}>
          <TextField
            label={t(`trackers.${kind}.amountLabel`)}
            placeholder={t(`trackers.${kind}.amountPlaceholder`)}
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setError(null);
            }}
            keyboardType={kind === 'calories' ? 'number-pad' : 'decimal-pad'}
            maxLength={12}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t(`trackers.${kind}.noteLabel`)}
            placeholder={t(`trackers.${kind}.notePlaceholder`)}
            value={note}
            onChangeText={setNote}
            maxLength={200}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
      </View>
      {error !== null ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t(error === 'invalid' ? `trackers.${kind}.invalid` : 'trackers.addFailed')}
        </Text>
      ) : null}
      <Button variant="secondary" label={t(`trackers.${kind}.add`)} onPress={submit} disabled={amount.trim() === ''} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth },
  subsection: { gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  rows: { gap: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addBlock: { gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  amount: { width: 110 },
});
