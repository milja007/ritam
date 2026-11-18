import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { Rule, RuleLog, RulePeriod } from '@/core/domain';
import { rulesForPeriod, type PeriodRule } from '@/core/rules';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listRuleLogs, listRules } from '@/db/repos';

export type RulesData = { rules: PeriodRule<Rule>[]; logs: RuleLog[] };

type Loaded = { key: string } & ({ status: 'ready'; data: RulesData } | { status: 'error' });

export type RulesState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: RulesData };

/**
 * Zabrane koje se vide u planu razdoblja (njegove, šire i stalne) i njihovi zapisi za niz.
 * Ponovo se učitaju pri povratku na tab (večernji upit je mogao dodati zapis), pri promjeni
 * razdoblja i na `reload()`.
 */
export function useRules(period: RulePeriod, periodStart: string): RulesState & { reload: () => void } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${period}|${periodStart}`;

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    const db = getDb();
    listRules(db, LOCAL_USER_ID)
      .then(async (all) => {
        const rules = rulesForPeriod(all, period, periodStart);
        const logs = await listRuleLogs(
          db,
          LOCAL_USER_ID,
          rules.map((item) => item.rule.id),
        );
        if (active) setLoaded({ key, status: 'ready', data: { rules, logs } });
      })
      .catch((error: unknown) => {
        console.error('Loading rules failed', error);
        if (active) setLoaded({ key, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [key, period, periodStart, version]);

  // Podaci drugog razdoblja (prije nego se novo učita) se ne prikazuju.
  const state: RulesState =
    loaded === null || loaded.key !== key
      ? { status: 'loading' }
      : loaded.status === 'ready'
        ? { status: 'ready', data: loaded.data }
        : { status: 'error' };
  return { ...state, reload };
}
