import { RankCard } from './rank-card';
import { TrendCard } from './trend-card';
import { useEmberData } from './use-ember-data';

/**
 * Profil: „Rang i statovi“ te „Zadnjih 30 dana“. Obje kartice crtaju iz istog čitanja lokalnih
 * dnevnih rezultata, da se baza za Profil ne čita dvaput.
 */
export function ProfileEmberCards({ checkinDay }: { checkinDay: string }) {
  const state = useEmberData(checkinDay);
  return (
    <>
      <RankCard checkinDay={checkinDay} state={state} />
      <TrendCard checkinDay={checkinDay} state={state} />
    </>
  );
}
