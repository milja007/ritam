/** "2026-11-09" → "ponedjeljak, 9. studenoga" / "Monday, November 9" (po jeziku appa). */
export function formatDay(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  try {
    return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(value);
  } catch {
    return date;
  }
}
