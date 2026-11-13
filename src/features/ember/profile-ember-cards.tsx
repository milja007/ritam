import { BadgesCard } from './badges-card';
import { RankCard } from './rank-card';
import { TrendCard } from './trend-card';
import { useEmberData } from './use-ember-data';

/**
 * Profil: „Rang i statovi“, „Zadnjih 30 dana“ i „Bedževi“. Sve kartice crtaju iz istog čitanja lokalnih
 * dnevnih rezultata, da se baza za Profil ne čita više puta.
 */
export function ProfileEmberCards({ checkinDay }: { checkinDay: string }) {
  const state = useEmberData(checkinDay);
  return (
    <>
      <RankCard checkinDay={checkinDay} state={state} />
      <TrendCard checkinDay={checkinDay} state={state} />
      <BadgesCard checkinDay={checkinDay} state={state} />
    </>
  );
}
