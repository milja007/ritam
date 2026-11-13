/** Formatiranje datuma za ekrane Tjedan / Mjesec / Godina (po jeziku appa). */

function toDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
}

const localeOf = (language: string) => (language === 'hr' ? 'hr-HR' : 'en-US');

function format(date: string, language: string, options: Intl.DateTimeFormatOptions, fallback: string): string {
  try {
    return new Intl.DateTimeFormat(localeOf(language), options).format(toDate(date));
  } catch {
    return fallback;
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "2026-11" → "Studeni" / "November". */
export function monthName(month: string, language: string): string {
  return capitalize(format(`${month}-01`, language, { month: 'long' }, month));
}

/** "2026-11" → "stu" / "Nov". */
export function monthShort(month: string, language: string): string {
  return format(`${month}-01`, language, { month: 'short' }, month.slice(5)).replace('.', '');
}

/** Jedno slovo dana u tjednu: "P" / "M". */
export function weekdayLetter(date: string, language: string): string {
  return format(date, language, { weekday: 'narrow' }, '').toUpperCase();
}

/** "2026-11-09" → "ponedjeljak, 9. studenoga" (za čitač zaslona). */
export function dayLong(date: string, language: string): string {
  return format(date, language, { weekday: 'long', day: 'numeric', month: 'long' }, date);
}

/** Raspon tjedna: "9. – 15. studenoga" / "Nov 9 – 15". */
export function weekRange(from: string, to: string, language: string): string {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const start = format(from, language, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' }, from);
  const end = format(to, language, { day: 'numeric', month: 'long' }, to);
  return `${start} – ${end}`;
}

/** Dan u mjesecu bez vodeće nule. */
export function dayNumber(date: string): string {
  return String(Number(date.slice(8, 10)));
}
