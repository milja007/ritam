import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScheduleBlock } from '@/core/domain';
import {
  blockPhase,
  currentBlockId,
  draftFromBlock,
  newBlockDraft,
  tomorrowOf,
  type BlockDraft,
} from '@/core/schedule';
import { radius, spacing } from '@/core/theme';
import { DiagnosisModal } from '@/features/diagnosis';
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
import { XpStreakBar } from '@/features/progress';
import { Button } from '@/ui/button';
import { GradientBackground } from '@/ui/gradient-background';
import { Text } from '@/ui/text';
import { useAppTheme } from '@/ui/theme';

import { BlockCard } from './block-card';
import { BlockEditor } from './block-editor';
import { formatDay } from './format-day';
import { useDayBlocks, useNow } from './use-today';

/** Pauza između zatvaranja upita i otvaranja "Što imaš sutra?" (iOS ne prikaže novi modal dok se stari zatvara). */
const MODAL_SWAP_DELAY_MS = 400;

type Editing =
  | { mode: 'add'; draft: BlockDraft }
  | { mode: 'edit'; draft: BlockDraft; id: string };

/** Tab Danas: timeline današnjih blokova, trenutni istaknut, kvačica Gotovo, dodavanje/uređivanje. */
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

  // "Što imaš sutra?" = dan nakon dana upita (prije 04:00 je to današnji dan).
  const tomorrowDate = tomorrowOf(now.eveningDate);
  const [tomorrowOpen, setTomorrowOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);

  function closeEvening() {
    setEveningOpen(false);
    consumeEveningRequest();
  }

  function planTomorrow() {
    closeEvening();
    setTimeout(() => setTomorrowOpen(true), MODAL_SWAP_DELAY_MS);
  }

  const currentId = currentBlockId(day.blocks, now.minutes);

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

  async function toggle(block: ScheduleBlock) {
    setActionFailed(false);
    try {
      await day.toggleDone(block);
      evening.reload(); // nacrt upita kreće od svježih statusa
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

          <XpStreakBar today={now.date} checkinDay={now.eveningDate} />

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

          {day.status === 'ready' && evening.status !== 'error' ? (
            <EveningCard
              saved={evening.saved}
              forYesterday={now.eveningDate !== now.date}
              disabled={!eveningReady}
              onOpen={() => setEveningOpen(true)}
              onPlanTomorrow={() => setTomorrowOpen(true)}
              onOpenDiagnosis={() => setDiagnosisOpen(true)}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>

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
            return result;
          }}
          onClose={closeEvening}
          onPlanTomorrow={planTomorrow}
        />
      ) : null}

      {diagnosisOpen ? (
        <DiagnosisModal
          date={now.eveningDate}
          dayLabel={formatDay(now.eveningDate, i18n.language)}
          onClose={() => setDiagnosisOpen(false)}
        />
      ) : null}

      {tomorrowOpen && tomorrowDate !== null ? (
        // Prije 04:00 "sutra" je današnji timeline, pa se dan nakon spremanja osvježava.
        <TomorrowPlan
          date={tomorrowDate}
          onSaved={day.reload}
          onClose={() => setTomorrowOpen(false)}
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
