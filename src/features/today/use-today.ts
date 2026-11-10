import { useCallback, useEffect, useState } from 'react';

import { eveningCheckinDate } from '@/core/checkin';
import type { BlockStatus, ScheduleBlock } from '@/core/domain';
import {
  draftToInput,
  draftToPatch,
  minutesOfDay,
  type BlockDraft,
} from '@/core/schedule';
import { localDateOf } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import {
  createBlock,
  deleteBlock,
  giveUpDay,
  listBlocksForDate,
  setBlockNote,
  setBlockStatus,
  updateBlock,
} from '@/db/repos';
import { syncNotificationsNow, useBlocksVersion } from '@/features/notifications';
import { notifyProgressChanged } from '@/features/progress';

const CLOCK_REFRESH_MS = 30_000;

/**
 * Trenutni lokalni dan i minuta u danu, te dan večernjeg upita (prije 04:00 je to jučer);
 * osvježava se dok je ekran otvoren (i preko ponoći).
 */
export function useNow(): { date: string; minutes: number; eveningDate: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return { date: localDateOf(now), minutes: minutesOfDay(now), eveningDate: eveningCheckinDate(now) };
}

type Loaded = { date: string; status: 'ready' | 'error'; blocks: ScheduleBlock[] };

/**
 * Blokovi zadanog dana iz lokalne baze + akcije timelinea. Svaka akcija nakon zapisa
 * ponovo učita dan (redoslijed po početku dolazi iz repoa). Akcije bacaju grešku pozivatelju.
 */
export function useDayBlocks(date: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // Gotovo na obavijesti mijenja blok izvan ekrana.
  const externalVersion = useBlocksVersion();

  useEffect(() => {
    let active = true;
    listBlocksForDate(getDb(), LOCAL_USER_ID, date)
      .then((blocks) => {
        if (active) setLoaded({ date, status: 'ready', blocks });
      })
      .catch((error: unknown) => {
        console.error('Loading blocks failed', error);
        if (active) setLoaded({ date, status: 'error', blocks: [] });
      });
    return () => {
      active = false;
    };
  }, [date, version, externalVersion]);

  /** Ponovo učitaj dan (nakon promjene ili greške). */
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Nakon zapisa: ponovo učitaj dan i uskladi podsjetnike blokova. */
  const changed = useCallback(() => {
    reload();
    notifyProgressChanged(); // kvačica / brisanje bloka mijenja XP
    void syncNotificationsNow();
  }, [reload]);

  // Dok se novi dan (npr. nakon ponoći) ne učita, prikazuje se učitavanje, ne jučerašnji blokovi.
  const current = loaded?.date === date ? loaded : null;
  const status = current?.status ?? 'loading';
  const blocks = current?.blocks ?? [];

  const add = useCallback(
    async (draft: BlockDraft) => {
      await createBlock(getDb(), LOCAL_USER_ID, draftToInput(draft, date));
      changed();
    },
    [date, changed],
  );

  const edit = useCallback(
    async (id: string, draft: BlockDraft) => {
      await updateBlock(getDb(), LOCAL_USER_ID, id, draftToPatch(draft));
      changed();
    },
    [changed],
  );

  const remove = useCallback(
    async (id: string) => {
      deleteBlock(getDb(), LOCAL_USER_ID, id);
      changed();
    },
    [changed],
  );

  /** Prijava / Otkaži s rasporeda (17c): status + XP u jednoj transakciji. */
  const setStatus = useCallback(
    async (block: ScheduleBlock, next: BlockStatus) => {
      setBlockStatus(getDb(), LOCAL_USER_ID, block.id, next);
      changed();
    },
    [changed],
  );

  /** Komentar (= bilješka) na aktivnosti; `null` briše. */
  const setNote = useCallback(
    async (id: string, note: string | null) => {
      setBlockNote(getDb(), LOCAL_USER_ID, id, note);
      reload();
    },
    [reload],
  );

  /** Odustajem od svega (17d): neriješeno → neodrađeno bez XP-a, bilješka u večernji checkin. */
  const giveUp = useCallback(
    async (note: string) => {
      giveUpDay(getDb(), LOCAL_USER_ID, date, note);
      changed(); // statusi, streak, podsjetnici
    },
    [date, changed],
  );

  return { status, blocks, reload, add, edit, remove, setStatus, setNote, giveUp };
}
