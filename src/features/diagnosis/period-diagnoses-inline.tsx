import { MonthDiagnosisInline } from './month-diagnosis-inline';
import { WeekDiagnosisInline } from './week-diagnosis-inline';

/**
 * Dijagnoze razdoblja koja završavaju danom `date`, odmah ispod dnevne (koncept: nedjelja → dan +
 * tjedan; zadnji dan mjeseca → + mjesec). Svaki dio sam odlučuje pokazuje li se.
 */
export function PeriodDiagnosesInline({ date }: { date: string }) {
  return (
    <>
      <WeekDiagnosisInline date={date} />
      <MonthDiagnosisInline date={date} />
    </>
  );
}
