import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BlockStatus, ScheduleBlock } from '@/core/domain';
import { flameBlockId } from '@/core/ember';
import {
  blockPhase,
  canGiveUp,
  daySchedule,
  draftFromBlock,
  formatClockSeconds,
  giveUpBlocks,
  isCancelled,
  needsTodayPlan,
  newBlockDraft,
  reportedStatus,
  secondsOfDay,
  shouldAutoOpenTodayPlan,
  shouldOfferDiagnosis,
  tomorrowOf,
  type BlockDraft,
} from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { DiagnosisModal, DiagnosisReadyCard, useDiagnosisPickup } from '@/features/diagnosis';
import { EveningCard, EveningCheckinFlow, TomorrowPlan, useEveningCheckin } from '@/features/evening';
import { MorningBrief, MorningCard, useMorningCheckin } from '@/features/morning';
import {
  consumeBlockRequest,
  consumeEveningRequest,
  consumeMorningRequest,
  PermissionCard,
  useBlockRequested,
  useEveningRequested,
  useMorningRequested,
} from '@/features/notifications';
import { DayScoreCard, XpStreakBar } from '@/features/progress';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { BlockCard } from './block-card';
import { BlockEditor } from './block-editor';
import { BlockSheet } from './block-sheet';
import { DayPills } from './day-pills';
import { formatDay } from './format-day';
import { GiveUp } from './give-up';
import { NowCard } from './now-card';
import { NowRow } from './now-row';
import { TodayPlan } from './today-plan';
import { useLiveClock } from './use-live-clock';
import { useDayBlocks, useNow } from './use-today';

/** Pauza između zatvaranja upita i otvaranja "Što imaš sutra?" (iOS ne prikaže novi modal dok se stari zatvara). */
const MODAL_SWAP_DELAY_MS = 400;

type Editing =
  | { mode: 'add'; draft: BlockDraft }
  | { mode: 'edit'; draft: BlockDraft; id: string };

/**
 * Tab Danas (17c): "Trenutno" sa živim satom i odbrojavanjem, ispod ostatak dana od sada,
 * prošle aktivnosti sklopljene s prijavom izravno na rasporedu; akcije bloka po fazi.
 */
export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const now = useNow();
  const day = useDayBlocks(now.date);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  // Upit prije 04:00 pripada prethodnom danu, pa ima vlastiti dan i blokove.
  const evening = useEveningCheckin(now.eveningDate);
  const [eveningOpen, setEveningOpen] = useState(false);
  const eveningRequested = useEveningRequested();
  const eveningReady = day.status === 'ready' && evening.status === 'ready';
  // Dodir večernje obavijesti otvara upit čim su podaci dana učitani; zahtjev se briše pri zatvaranju.
  const showEvening = eveningReady && (eveningOpen || eveningRequested);

  // Jutarnji brief: dodir jutarnje obavijesti ili kartica na Danas (dok san nije prijavljen).
  const morning = useMorningCheckin(now.date);
  const [morningOpen, setMorningOpen] = useState(false);
  const morningRequested = useMorningRequested();
  const morningReady = day.status === 'ready' && morning.status === 'ready';
  const showMorning =
    morningReady && morning.settings !== null && !showEvening && (morningOpen || morningRequested);

  function closeMorning() {
    setMorningOpen(false);
    consumeMorningRequest();
  }

  // "Što imaš sutra?" = dan nakon dana upita (prije 04:00 je to današnji dan); nakon Odustajem
  // dan nakon današnjeg timelinea.
  const tomorrowDate = tomorrowOf(now.eveningDate);
  const [tomorrowFor, setTomorrowFor] = useState<string | null>(null);
  const tomorrowOpen = tomorrowFor !== null;
  // Dijagnoza: s večernje kartice (dan upita) ili pokupljena na Dan (današnji dan).
  const [diagnosisFor, setDiagnosisFor] = useState<string | null>(null);
  const diagnosisOpen = diagnosisFor !== null;
  const pickup = useDiagnosisPickup(now.date);
  const [giveUpOpen, setGiveUpOpen] = useState(false);

  function closeEvening() {
    setEveningOpen(false);
    consumeEveningRequest();
  }

  function planTomorrow() {
    closeEvening();
    setTimeout(() => setTomorrowFor(tomorrowDate), MODAL_SWAP_DELAY_MS);
  }

  /** Odustajem od svega → zatvori dan, pa odmah plan za sutra (17d). */
  async function confirmGiveUp(note: string) {
    await day.giveUp(note);
    evening.reload();
    setGiveUpOpen(false);
    const next = tomorrowOf(now.date);
    if (next !== null) setTimeout(() => setTomorrowFor(next), MODAL_SWAP_DELAY_MS);
  }

  function openPickedDiagnosis() {
    if (pickup.pickUp()) setDiagnosisFor(now.date);
    else setActionFailed(true);
  }

  // Živi sat (1 s) za "Trenutno" i faze blokova; dan i upiti idu po `now` (30 s).
  const live = useLiveClock();
  const nowSeconds = secondsOfDay(live);
  const liveMinutes = Math.floor(nowSeconds / 60);
  const view = daySchedule(day.blocks, nowSeconds);
  const [pastOpen, setPastOpen] = useState<boolean | null>(null);
  // Ranije danas: otvoreno samo dok ima neprijavljenih (osim ako je korisnik sam odlučio).
  const pastUnreported = view.past.some((block) => block.status === 'planned' && !isCancelled(block));
  const showPast = pastOpen ?? pastUnreported;

  // Akcije jedne aktivnosti (list): blok se čita iz svježih podataka dana.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheetBlock = sheetId !== null ? (day.blocks.find((block) => block.id === sheetId) ?? null) : null;

  // Plan za danas (17b): bez plana se izrada otvara sama — jednom po danu, ne preko drugih modala.
  const [planOpen, setPlanOpen] = useState(false);
  const [planDismissedFor, setPlanDismissedFor] = useState<string | null>(null);
  const needsPlan = day.status === 'ready' && needsTodayPlan(day.blocks);

  // Iskrslo na podsjetniku otvara taj blok u uređivaču (puni "Iskrslo" flow je korak 27).
  const blockRequest = useBlockRequested();
  const requestedBlock =
    blockRequest !== null && day.status === 'ready'
      ? (day.blocks.find((block) => block.id === blockRequest) ?? null)
      : null;
  const blockRequestMissing = blockRequest !== null && day.status === 'ready' && requestedBlock === null;
  useEffect(() => {
    // Blok nije na današnjem timelineu (npr. sutrašnji) — app se samo otvori na Danas.
    if (blockRequestMissing) consumeBlockRequest();
  }, [blockRequestMissing]);
  const activeEditing: Editing | null =
    editing ??
    (requestedBlock !== null && !showEvening && !showMorning && !tomorrowOpen
      ? { mode: 'edit', draft: draftFromBlock(requestedBlock), id: requestedBlock.id }
      : null);

  const otherModalOpen =
    showEvening ||
    showMorning ||
    tomorrowOpen ||
    diagnosisOpen ||
    giveUpOpen ||
    activeEditing !== null ||
    sheetBlock !== null;
  const autoOpenPlan =
    day.status === 'ready' &&
    !planOpen &&
    !otherModalOpen &&
    planDismissedFor !== now.date &&
    shouldAutoOpenTodayPlan(day.blocks, now.minutes);
  useEffect(() => {
    if (!autoOpenPlan) return;
    // Pauza: iOS ne prikaže novi modal dok se prethodni (npr. jutarnji brief) zatvara.
    const id = setTimeout(() => setPlanOpen(true), MODAL_SWAP_DELAY_MS);
    return () => clearTimeout(id);
  }, [autoOpenPlan]);

  function closePlan() {
    setPlanOpen(false);
    setPlanDismissedFor(now.date);
  }

  function closeEditor() {
    setEditing(null);
    consumeBlockRequest();
  }

  function openAdd() {
    setEditing({ mode: 'add', draft: newBlockDraft(day.blocks, now.minutes) });
  }

  function openEdit(block: ScheduleBlock) {
    setEditing({ mode: 'edit', draft: draftFromBlock(block), id: block.id });
  }

  /** Uređivanje iz lista akcija: list se zatvori, editor se otvori nakon pauze (iOS). */
  function editFromSheet(block: ScheduleBlock) {
    setSheetId(null);
    setTimeout(() => openEdit(block), MODAL_SWAP_DELAY_MS);
  }

  async function changeStatus(block: ScheduleBlock, next: BlockStatus) {
    await day.setStatus(block, next);
    evening.reload(); // nacrt upita kreće od svježih statusa
  }

  /** Prijava izravno na rasporedu; greška se prikaže ispod rasporeda. */
  async function report(block: ScheduleBlock, chosen: BlockStatus) {
    setActionFailed(false);
    try {
      await changeStatus(block, reportedStatus(block.status, chosen));
    } catch (error: unknown) {
      console.error('Reporting block failed', error);
      setActionFailed(true);
    }
  }

  const flameId = flameBlockId(day.blocks, (block) => blockPhase(block, liveMinutes));

  /** Redak trake; `joined` = redak se nastavlja na plamen „Sada“ (linija ide do njega). */
  const renderRow = (
    block: ScheduleBlock,
    index: number,
    list: readonly ScheduleBlock[],
    joined: 'none' | 'above' | 'below' = 'none',
  ) => (
    <BlockCard
      key={block.id}
      block={block}
      phase={blockPhase(block, liveMinutes)}
      first={index === 0 && joined !== 'below'}
      last={index === list.length - 1 && joined !== 'above'}
      // Jedan orb na traci: uz redak „Sada“ nosi ga taj redak, inače prva aktivnost koja traje.
      flame={joined === 'none' && block.id === flameId}
      onPress={() => setSheetId(block.id)}
      onReport={(status) => void report(block, status)}
    />
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="caption" tone="textMuted" numberOfLines={1}>
                {formatDay(now.date, i18n.language)}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {t('today.header.title')}
              </Text>
            </View>
            <DayPills today={now.date} checkinDay={now.eveningDate} />
          </View>

          {day.status === 'ready' && !needsPlan ? (
            <NowCard
              view={view}
              nowSeconds={nowSeconds}
              onDone={(block) => void report(block, 'done')}
              onOpen={(block) => setSheetId(block.id)}
            />
          ) : null}

          {day.status === 'ready' && pickup.seen === false && shouldOfferDiagnosis(day.blocks, false) ? (
            <DiagnosisReadyCard onOpen={openPickedDiagnosis} />
          ) : null}

          <PermissionCard />

          {morning.status === 'ready' && morning.saved === null ? (
            <MorningCard disabled={!morningReady} onOpen={() => setMorningOpen(true)} />
          ) : null}

          {day.status === 'loading' ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : day.status === 'error' ? (
            <View style={styles.message}>
              <Text tone="danger">{t('today.loadError')}</Text>
              <Button variant="secondary" label={t('today.retry')} onPress={day.reload} />
            </View>
          ) : needsPlan ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
              <Text variant="heading">{t('todayPlan.cardTitle')}</Text>
              <Text tone="textMuted">{t('todayPlan.cardBody')}</Text>
              <Button label={t('todayPlan.cardAction')} onPress={() => setPlanOpen(true)} />
              {day.blocks.map((block, index, list) => renderRow(block, index, list))}
            </View>
          ) : (
            // Traka dana, kronološki: izgorjeli dio (ranije) → plamen „Sada“ → plan ispred.
            <View style={styles.section}>
              {view.past.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showPast }}
                  onPress={() => setPastOpen(!showPast)}
                  style={({ pressed }) => [styles.pastHeader, { opacity: pressed ? 0.7 : 1 }]}>
                  <Text variant="overline" tone="textMuted">
                    {t('today.earlier', { count: view.past.length })}
                  </Text>
                  <Text variant="caption" tone={pastUnreported ? 'accent' : 'textMuted'}>
                    {showPast ? t('today.hide') : pastUnreported ? t('today.toReport') : t('today.show')}
                  </Text>
                </Pressable>
              ) : null}
              <View>
                {showPast ? view.past.map((block, index, list) => renderRow(block, index, list, 'above')) : null}
                <NowRow
                  time={formatClockSeconds(nowSeconds).slice(0, 5)}
                  current={view.current}
                  hasPast={showPast && view.past.length > 0}
                  hasUpcoming={view.upcoming.length > 0}
                  onOpen={(block) => setSheetId(block.id)}
                />
                {view.upcoming.map((block, index, list) => renderRow(block, index, list, 'below'))}
              </View>
              {view.upcoming.length === 0 ? (
                <Text tone="textMuted" style={styles.sectionTitle}>
                  {t('today.restOfDayEmpty')}
                </Text>
              ) : null}
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

          {day.status === 'ready' && !needsPlan && canGiveUp(day.blocks) ? (
            <Button variant="ghost" label={t('giveUp.action')} onPress={() => setGiveUpOpen(true)} />
          ) : null}

          <XpStreakBar today={now.date} checkinDay={now.eveningDate} />

          <DayScoreCard checkinDay={now.eveningDate} />

          {day.status === 'ready' && evening.status !== 'error' ? (
            <EveningCard
              saved={evening.saved}
              forYesterday={now.eveningDate !== now.date}
              disabled={!eveningReady}
              onOpen={() => setEveningOpen(true)}
              onPlanTomorrow={() => setTomorrowFor(tomorrowDate)}
              onOpenDiagnosis={() => {
                if (now.eveningDate === now.date) pickup.markSeen();
                setDiagnosisFor(now.eveningDate);
              }}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {sheetBlock ? (
        <BlockSheet
          block={sheetBlock}
          phase={blockPhase(sheetBlock, liveMinutes)}
          onReport={(status) => changeStatus(sheetBlock, reportedStatus(sheetBlock.status, status))}
          onSaveNote={(note) => day.setNote(sheetBlock.id, note)}
          onToggleCancel={() => changeStatus(sheetBlock, isCancelled(sheetBlock) ? 'planned' : 'skipped')}
          onEdit={() => editFromSheet(sheetBlock)}
          onClose={() => setSheetId(null)}
        />
      ) : null}

      {activeEditing ? (
        // Editor se montira pri svakom otvaranju, pa uvijek kreće od svježeg nacrta.
        <BlockEditor
          mode={activeEditing.mode}
          initial={activeEditing.draft}
          onClose={closeEditor}
          onSave={(draft) =>
            activeEditing.mode === 'add' ? day.add(draft) : day.edit(activeEditing.id, draft)
          }
          onDelete={activeEditing.mode === 'edit' ? () => day.remove(activeEditing.id) : undefined}
        />
      ) : null}

      {showMorning && morning.settings !== null ? (
        <MorningBrief
          date={now.date}
          nowMinutes={now.minutes}
          blocks={day.blocks}
          settings={morning.settings}
          saved={morning.saved}
          onSave={morning.save}
          onClose={closeMorning}
          onAdjust={closeMorning}
        />
      ) : null}

      {showEvening ? (
        <EveningCheckinFlow
          date={now.eveningDate}
          blocks={evening.blocks}
          activeRules={evening.activeRules}
          saved={evening.saved}
          onSave={(draft) => {
            const result = evening.save(draft);
            day.reload(); // statusi blokova (i premješteni blokovi) su se promijenili
            // Dijagnoza se prikaže na kraju upita — time je pokupljena (17d).
            if (result.diagnosis !== null && draft.date === now.date) pickup.markSeen();
            return result;
          }}
          onClose={closeEvening}
          onPlanTomorrow={planTomorrow}
        />
      ) : null}

      {diagnosisFor !== null ? (
        <DiagnosisModal
          date={diagnosisFor}
          dayLabel={formatDay(diagnosisFor, i18n.language)}
          onClose={() => setDiagnosisFor(null)}
        />
      ) : null}

      {giveUpOpen ? (
        <GiveUp
          remaining={giveUpBlocks(day.blocks).length}
          onConfirm={confirmGiveUp}
          onClose={() => setGiveUpOpen(false)}
        />
      ) : null}

      {planOpen && day.status === 'ready' ? (
        <TodayPlan
          date={now.date}
          nowMinutes={now.minutes}
          existing={day.blocks}
          onSaved={day.reload}
          onClose={closePlan}
        />
      ) : null}

      {tomorrowFor !== null ? (
        // Prije 04:00 "sutra" je današnji timeline, pa se dan nakon spremanja osvježava.
        <TomorrowPlan date={tomorrowFor} onSaved={day.reload} onClose={() => setTomorrowFor(null)} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  headerText: { flex: 1, gap: spacing.xxs },
  loading: { marginTop: spacing.xxl },
  message: { gap: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.xs },
  pastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  empty: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
