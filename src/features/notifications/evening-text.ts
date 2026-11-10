import type { TFunction } from 'i18next';

import type { EveningNeed } from '@/core/schedule';

import type { NotificationText } from './sync';

/**
 * Ležeran večernji podsjetnik (17d) prema onome što fali: neprijavljene aktivnosti (broj), plan
 * za sutra, dijagnoza koja čeka. Prazan popis → `'skip'` (taj dan se ne šalje).
 */
export function eveningReminderText(
  t: TFunction,
  needs: readonly EveningNeed[],
  unreported: number,
): NotificationText | 'skip' {
  if (needs.length === 0) return 'skip';
  const parts = needs.map((need) =>
    need === 'report'
      ? t('notifications.evening.needs.report', { count: unreported })
      : t(`notifications.evening.needs.${need}`),
  );
  return { title: t('notifications.evening.casualTitle'), body: parts.join(' ') };
}
