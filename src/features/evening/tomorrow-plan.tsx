import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isTomorrowPlanValid,
  occupiedSlots,
  parsedItems,
  pickKey,
  PLAN_MIN_ITEMS,
  planDayRequest,
  planProposal,
  typedItems,
  wantsSmartParse,
  type BlockDraft,
  type LearnedPick,
  type PlanAnswer,
  type PlanItem,
  type PlanProposal,
} from '@/core/schedule';
import { spacing } from '@/core/theme';
import { isAuthEnabled } from '@/features/auth';
import { BlockEditor } from '@/features/today/block-editor';
import { formatDay } from '@/features/today/format-day';
import { Chip, DraftRow, ExistingRow } from '@/features/today/plan-parts';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { TextField } from '@/ui/text-field';
import { useAppTheme } from '@/ui/theme';

import { requestParseInput } from './parse-input-client';
import { requestPlanDay } from './plan-day-client';
import { loadPlanContext } from './plan-context';
import { PlanProposalView } from './plan-proposal-view';
import { useTomorrowPlan } from './use-tomorrow';

/** Tipkani ili diktirani unos (korak 30: izgovoreni dan s više stavki je duži od jedne stavke). */
const TYPED_MAX = 500;

type TomorrowPlanProps = {
  /** Sutrašnji dan ("YYYY-MM-DD"). */
  date: string;
  /** Pozove se nakon spremanja (osvježi timeline). */
  onSaved: () => void;
  onClose: () => void;
  /**
   * `tomorrow` (zadano) = večernje „Što imaš sutra?“; `day` = planiranje bilo kojeg dana koji tek
   * dolazi s Tjedna (korak 25) — isti tok, tekstovi s imenom dana umjesto „sutra“.
   */
  variant?: 'tomorrow' | 'day';
};

/** Stavka popisa; `pinned` = vrijeme je izričito zadano (za „Složi mi dan“ je fiksno). */
type Item = PlanItem & { key: number };

/**
 * "Što imaš sutra?": tipkanje i naučeni odabiri dodaju blokove za sutra (termini se slažu iza
 * zadnjeg bloka od buđenja), pregled s uređivanjem, Potvrdi sprema sve odjednom.
 */
export function TomorrowPlan({ date, onSaved, onClose, variant = 'tomorrow' }: TomorrowPlanProps) {
  const { t, i18n } = useTranslation();
  // Tekstovi koji spominju „sutra“ imaju inačicu s imenom dana; ostali su zajednički.
  const copy = variant === 'day' ? 'evening.dayPlan' : 'evening.tomorrow';
  const dayName = formatDay(date, i18n.language);
  const { colors } = useAppTheme();
  const plan = useTomorrowPlan(date);
  const [items, setItems] = useState<Item[]>([]);
  const nextKey = useRef(1);
  const [typed, setTyped] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  /** `parse-input` radi — unos i odabiri čekaju da se termini ne slože preko istih mjesta. */
  const [parsing, setParsing] = useState(false);
  /** „Složi mi dan“ (korak 22): poziv u tijeku, prijedlog za odobrenje, greška. */
  const [planning, setPlanning] = useState(false);
  const [proposal, setProposal] = useState<PlanProposal<Item> | null>(null);
  const [planError, setPlanError] = useState(false);
  /** Svaki novi prijedlog počinje s praznim odgovorima (ključ `PlanProposalView`). */
  const [proposalRound, setProposalRound] = useState(0);
  const busy = parsing || planning;

  const drafts = items.map((item) => item.draft);
  const occupied = occupiedSlots(plan.existing, drafts);

  function addAll(newItems: readonly PlanItem[]) {
    const entries = newItems.map((item) => ({
      ...item,
      key: nextKey.current++,
    }));
    setItems((current) => [...current, ...entries]);
  }

  /** Naučeni odabir dolazi u svom uobičajenom terminu (korisnik ga mijenja u editoru). */
  function addLearned(pick: LearnedPick) {
    if (busy) return;
    addAll([
      {
        draft: {
          title: pick.title,
          kind: pick.kind,
          start: pick.start,
          end: pick.end,
        },
        pinned: true,
      },
    ]);
  }

  // Naučeni odabir koji je već dodan se skriva.
  const added = new Set(drafts.map((draft) => pickKey(draft.title)));
  const learned = plan.learned.filter((pick) => !added.has(pick.key));

  /**
   * Tipkani unos → stavke. S oblakom i prijavom unos s više stavki ide kroz `parse-input`
   * (korak 21); bez toga, na grešku ili istek vremena dijeli se lokalno („Trening 18-19, zubar u 15“).
   */
  async function addTyped() {
    const text = typed;
    if (text.trim().length === 0 || busy) return;
    let newItems: PlanItem[] = [];
    if (isAuthEnabled && wantsSmartParse(text)) {
      setParsing(true);
      const blocks = await requestParseInput(text, locale);
      setParsing(false);
      if (blocks) newItems = parsedItems(blocks, occupied, plan.wakeTime);
    }
    if (newItems.length === 0) newItems = typedItems(text, occupied, plan.wakeTime);
    if (newItems.length === 0) return;
    addAll(newItems);
    setTyped('');
    setPlanError(false);
    if (newItems.length > 1) {
      AccessibilityInfo.announceForAccessibility(t('evening.tomorrow.addedCount', { count: newItems.length }));
    }
  }

  const locale = i18n.language.startsWith('en') ? 'en' : 'hr';

  /**
   * „Složi mi dan“: stavke + slobodni prozori → `plan-day` → prijedlog. Ništa se ne mijenja dok
   * korisnik ne prihvati prijedlog, a ništa se ne sprema dok ne potvrdi plan.
   */
  async function arrange(answers: readonly PlanAnswer[] = []) {
    if (busy || items.length < PLAN_MIN_ITEMS) return;
    const snapshot = items;
    setPlanError(false);
    setPlanning(true);
    // Korak 26: model dobiva i ciljeve, tjedne zadatke kojima fale termini i zabrane tog dana.
    const { context, tasks } = await loadPlanContext(date);
    const response = await requestPlanDay(
      planDayRequest(date, snapshot, plan.existing, plan.wakeTime, plan.bedtime, locale, context, answers),
    );
    setPlanning(false);
    if (!response) {
      setPlanError(true);
      return;
    }
    setProposal(planProposal(response, snapshot, tasks));
    setProposalRound((round) => round + 1);
    if (answers.length > 0) AccessibilityInfo.announceForAccessibility(t('evening.plan.rearranged'));
  }

  function acceptProposal() {
    if (!proposal) return;
    // Prihvaćeni termini su sada korisnikovi; stavke koje nisu stale ostaju kakve jesu.
    const accepted = proposal.drafts.map((draft) => ({
      key: nextKey.current++,
      draft,
      pinned: true,
    }));
    setItems([...accepted, ...proposal.leftOut]);
    setProposal(null);
    AccessibilityInfo.announceForAccessibility(t('evening.plan.accepted'));
  }

  function replace(key: number, draft: BlockDraft) {
    // Vrijeme iz uređivača je korisnikov izbor.
    // Termin tjednog zadatka ostaje vezan dok mu se naslov ne promijeni.
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const taskId = item.draft.taskId && item.draft.title.trim() === draft.title.trim() ? item.draft.taskId : null;
        return { key, draft: taskId ? { ...draft, taskId } : draft, pinned: true };
      }),
    );
  }

  function remove(key: number) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function confirm() {
    setSaving(true);
    setSaveError(false);
    try {
      setSavedCount(plan.confirm(drafts));
      onSaved();
    } catch (error: unknown) {
      console.error('Saving tomorrow plan failed', error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const sortedItems = [...items].sort((a, b) => a.draft.start.localeCompare(b.draft.start) || a.key - b.key);

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      // Android Natrag: s otvorenog prijedloga natrag na popis, inače zatvori.
      onRequestClose={
        proposal
          ? () => {
              // Dok se prijedlog slaže ponovo, Natrag čeka (inače bi odgovor vratio prijedlog).
              if (!planning) setProposal(null);
            }
          : onClose
      }>
      <GradientBackground>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {savedCount !== null ? (
              <View style={styles.done}>
                <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
                  {t(`${copy}.doneTitle`, { day: dayName })}
                </Text>
                <Text tone="textMuted">{t(`${copy}.doneBody`, { count: savedCount })}</Text>
                <Button label={t('evening.tomorrow.close')} onPress={onClose} style={styles.primary} />
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                  <View style={styles.topRow}>
                    <Text variant="overline" tone="textMuted">
                      {t(`${copy}.overline`, { day: dayName })}
                    </Text>
                    <Button variant="ghost" label={t('evening.close')} onPress={onClose} disabled={saving} />
                  </View>
                  <Text variant="title" accessibilityRole="header">
                    {t(`${copy}.title`, { day: dayName })}
                  </Text>
                  <Text tone="textMuted">{t(`${copy}.subtitle`)}</Text>

                  {plan.status === 'loading' ? (
                    <ActivityIndicator color={colors.accent} style={styles.section} />
                  ) : plan.status === 'error' ? (
                    <View style={styles.section}>
                      <Text tone="danger">{t('evening.tomorrow.loadError')}</Text>
                      <Button variant="secondary" label={t('today.retry')} onPress={plan.reload} />
                    </View>
                  ) : proposal ? (
                    <PlanProposalView
                      key={proposalRound}
                      proposal={proposal}
                      onAccept={acceptProposal}
                      onBack={() => {
                        setPlanError(false);
                        setProposal(null);
                      }}
                      // Korak 22: isti popis + odgovori na pitanja modela → novi prijedlog.
                      onAnswer={(answers) => void arrange(answers)}
                      busy={planning}
                      error={planError}
                    />
                  ) : (
                    <>
                      {plan.existing.length > 0 ? (
                        <View style={styles.section}>
                          <Text variant="caption" tone="textMuted">
                            {t('evening.tomorrow.existing')}
                          </Text>
                          {plan.existing.map((block) => (
                            <ExistingRow key={block.id} block={block} />
                          ))}
                        </View>
                      ) : null}

                      {learned.length > 0 ? (
                        <View style={styles.section}>
                          <Text variant="caption" tone="textMuted">
                            {t('evening.tomorrow.learned')}
                          </Text>
                          <View style={styles.chips}>
                            {learned.map((pick) => (
                              <Chip
                                key={pick.key}
                                label={t('evening.tomorrow.learnedPick', {
                                  title: pick.title,
                                  start: pick.start,
                                })}
                                hint={t('evening.tomorrow.learnedHint', {
                                  start: pick.start,
                                  end: pick.end,
                                })}
                                onPress={() => addLearned(pick)}
                              />
                            ))}
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.section}>
                        <TextField
                          label={t('evening.tomorrow.typeLabel')}
                          dictation
                          placeholder={t('evening.tomorrow.typePlaceholder')}
                          value={typed}
                          onChangeText={setTyped}
                          onSubmitEditing={() => void addTyped()}
                          editable={!busy}
                          maxLength={TYPED_MAX}
                          returnKeyType="done"
                          submitBehavior="submit"
                        />
                        <Button
                          variant="secondary"
                          label={t('evening.tomorrow.add')}
                          onPress={() => void addTyped()}
                          disabled={typed.trim().length === 0 || planning}
                          loading={parsing}
                        />
                        <Text variant="caption" tone="textMuted">
                          {t('todayPlan.examplesHint')}
                        </Text>
                      </View>

                      <View style={styles.section}>
                        <Text variant="caption" tone="textMuted">
                          {t(`${copy}.newItems`, { day: dayName })}
                        </Text>
                        {sortedItems.length === 0 ? (
                          <Text tone="textMuted">{t('evening.tomorrow.empty')}</Text>
                        ) : (
                          sortedItems.map((item) => (
                            <DraftRow
                              key={item.key}
                              draft={item.draft}
                              onEdit={() => setEditing(item)}
                              onRemove={() => remove(item.key)}
                            />
                          ))
                        )}
                        {isAuthEnabled && items.length >= PLAN_MIN_ITEMS ? (
                          <View style={styles.arrange}>
                            <Button
                              variant="secondary"
                              label={t('evening.plan.arrange')}
                              onPress={() => void arrange()}
                              disabled={parsing}
                              loading={planning}
                            />
                            <Text variant="caption" tone="textMuted">
                              {t('evening.plan.arrangeHint')}
                            </Text>
                            {planError ? (
                              <Text tone="danger" accessibilityLiveRegion="assertive">
                                {t('evening.plan.error')}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </>
                  )}
                </ScrollView>

                {proposal ? null : (
                  <View style={styles.footer}>
                    {saveError ? (
                      <Text tone="danger" accessibilityLiveRegion="assertive">
                        {t('evening.tomorrow.saveError')}
                      </Text>
                    ) : null}
                    <View style={styles.buttons}>
                      <Button
                        variant="ghost"
                        label={t('evening.tomorrow.skip')}
                        onPress={onClose}
                        disabled={saving || busy}
                      />
                      <Button
                        label={t('evening.tomorrow.confirm', {
                          count: items.length,
                        })}
                        disabled={plan.status !== 'ready' || busy || !isTomorrowPlanValid(drafts)}
                        loading={saving}
                        onPress={confirm}
                        style={styles.primary}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>

      {editing ? (
        <BlockEditor
          mode="edit"
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            replace(editing.key, draft);
            return Promise.resolve();
          }}
          onDelete={() => {
            remove(editing.key);
            return Promise.resolve();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primary: { minWidth: 140 },
  arrange: { marginTop: spacing.sm, gap: spacing.xs },
  done: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
