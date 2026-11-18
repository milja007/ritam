/**
 * Primjeri podataka za prompt `llm-day-v1` (korak 31: „promptovi testirani na primjerima podataka“).
 * Koriste ih testovi (`src/core/diagnosis/report-logic.test.ts`), a mogu se poslati i živoj
 * funkciji kad se deploya — da se vidi kako model piše za tipičan i za težak dan.
 */

/** Tipičan dan: dio plana pao navečer, „umoran“ treći utorak zaredom, jedna prekršena zabrana. */
export const EXAMPLE_TIRED_TUESDAY = {
  date: '2026-11-17',
  locale: 'hr',
  trend: 'worse',
  today: {
    date: '2026-11-17',
    score: 58,
    plan: { total: 5, done: 3, partial: 0, missed: 2, moved: 1 },
    comments: [
      { title: 'Trening', outcome: 'not', comment: 'umoran nakon posla' },
      { title: 'Kemija', outcome: 'not', comment: 'nisam stigao' },
    ],
    misses: [
      { title: 'Trening', start: '18:00' },
      { title: 'Kemija', start: '20:00' },
    ],
    rules: { active: 2, kept: 1, broken: [{ title: 'Bez mobitela u krevetu', weight: 2, trigger: 'stres' }] },
    sleep: { minutes: 380, onTarget: false, deviationMinutes: 50 },
    xp: 45,
    rating: 2,
    note: 'Dug dan na poslu.',
    streak: 6,
    gaveUp: false,
    gaveUpNote: null,
    calories: { total: 2650, goal: 2200 },
    money: { spentCents: 1850, dailyBudgetCents: 1430 },
  },
  yesterday: {
    date: '2026-11-16',
    score: 74,
    plan: { total: 4, done: 3, partial: 1, missed: 0, moved: 0 },
    comments: [],
    misses: [],
    rules: { active: 2, kept: 2, broken: [] },
    sleep: { minutes: 450, onTarget: true, deviationMinutes: 5 },
    xp: 70,
    rating: 4,
    note: null,
    streak: 5,
    gaveUp: false,
    gaveUpNote: null,
  },
  history: [
    {
      date: '2026-11-10',
      score: 61,
      rating: 3,
      comments: [{ title: 'Trening', outcome: 'not', comment: 'umoran' }],
      broken: [],
    },
    {
      date: '2026-11-03',
      score: 55,
      rating: 2,
      comments: [{ title: 'Trening', outcome: 'partial', comment: 'umoran, samo pola' }],
      broken: [],
    },
  ],
  previous: [
    {
      date: '2026-11-16',
      summary: 'Dobar dan: gotovo sve odrađeno i na vrijeme u krevetu.',
      ideas: ['Trening prebaci na jutro dva dana u tjednu.'],
      helpful: false,
      comment: 'ujutro ne mogu, radim od 7',
      suggestionAccepted: null,
    },
  ],
} as const;

/** Težak dan: korisnik je odustao — dijagnoza mora biti blaga i gledati prema sutra. */
export const EXAMPLE_GAVE_UP = {
  date: '2026-11-18',
  locale: 'en',
  trend: 'first',
  today: {
    date: '2026-11-18',
    score: 20,
    plan: { total: 4, done: 1, partial: 0, missed: 3, moved: 0 },
    comments: [],
    misses: [],
    rules: { active: 0, kept: 0, broken: [] },
    sleep: null,
    xp: 15,
    rating: 1,
    note: null,
    streak: 1,
    gaveUp: true,
    gaveUpNote: 'Migraine all afternoon.',
  },
  yesterday: null,
  history: [],
  previous: [],
} as const;

/** Odgovor u traženom obliku (za provjeru `acceptModelReport`). */
export const EXAMPLE_MODEL_RESPONSE = `\`\`\`json
{
  "summary": "Teži dan od jučer: jutro je išlo po planu, a večer je opet pala na umor.",
  "praise": ["Tri od pet aktivnosti odrađeno usprkos dugom danu na poslu.", "Niz traje već 6 dana."],
  "noticed": ["Treći utorak zaredom trening pada uz komentar 'umoran' — utorak nakon posla ti je najteži termin."],
  "problems": ["Krevet 50 min kasnije od cilja i mobitel u krevetu zbog stresa — to vuče i sutrašnji dan."],
  "ideas": ["Utorkom zamijeni trening laganom šetnjom od 20 min, a pravi trening stavi u srijedu."]
}
\`\`\``;

/**
 * Primjer za prompt `llm-week-v1` (korak 31c): tjedan s padom navečer radnim danima, kalorije
 * iznad cilja, ranija tjedna promjena „Nije pomoglo“; lokalna promjena tjedna je zadana.
 */
export const EXAMPLE_WEEK_EVENINGS = {
  period: 'week',
  start: '2026-11-09',
  locale: 'hr',
  trend: 'same',
  betterWeeks: 0,
  week: {
    start: '2026-11-09',
    end: '2026-11-15',
    recorded: 6,
    average: 66,
    best: { date: '2026-11-14', score: 88 },
    worst: { date: '2026-11-11', score: 41 },
    plan: { total: 28, done: 18, partial: 2, missed: 8, moved: 3 },
    rules: {
      active: 12,
      kept: 10,
      broken: 2,
      byRule: [{ title: 'Bez mobitela u krevetu', weight: 2, broken: 2, triggers: ['stres'] }],
    },
    sleep: { nights: 6, averageMinutes: 395, shortNights: 3, onTarget: 2, withTarget: 6 },
    xp: 310,
    rating: 3.2,
    gaveUpDays: 0,
    misses: { morning: 1, afternoon: 1, evening: 6 },
    repeatedMisses: [{ title: 'Trening', count: 3 }],
    calories: { days: 5, within: 2, over: 3, under: 0 },
    money: { days: 4, spentCents: 6200, budgetCents: 5714, overDays: 2 },
  },
  previousWeek: {
    start: '2026-11-02',
    end: '2026-11-08',
    recorded: 5,
    average: 65,
    best: { date: '2026-11-07', score: 80 },
    worst: null,
    plan: { total: 22, done: 15, partial: 1, missed: 6, moved: 2 },
    rules: { active: 10, kept: 9, broken: 1, byRule: [] },
    sleep: null,
    xp: 260,
    rating: 3,
    gaveUpDays: 1,
    misses: { morning: 0, afternoon: 2, evening: 4 },
    repeatedMisses: [],
    calories: null,
    money: null,
  },
  days: [
    { date: '2026-11-10', score: 58, rating: 2, comments: [{ title: 'Trening', outcome: 'not', comment: 'umoran nakon posla' }], broken: [] },
    { date: '2026-11-11', score: 41, rating: 2, comments: [], broken: [{ title: 'Bez mobitela u krevetu', weight: 2, trigger: 'stres' }] },
    { date: '2026-11-14', score: 88, rating: 5, comments: [], broken: [] },
  ],
  idea: { text: 'Prebaci jednu večernju aktivnost na jutro ili popodne.', carried: false },
  previous: [
    {
      date: '2026-11-02',
      summary: 'Tjedan je bio stabilan, a večeri su ti najteže.',
      ideas: ['Večernji plan neka bude lakši: najviše jedna zahtjevna stvar poslije 18 h.'],
      helpful: false,
      comment: 'Nije išlo, navečer sam ionako mrtav.',
      suggestionAccepted: true,
    },
  ],
} as const;

/** Primjer za prompt `llm-month-v1` (korak 31d): mjesec s padom četvrtkom i boljom drugom polovicom. */
export const EXAMPLE_MONTH_THURSDAYS = {
  period: 'month',
  start: '2026-11-01',
  locale: 'hr',
  trend: 'better',
  month: {
    start: '2026-11-01',
    end: '2026-11-30',
    recorded: 24,
    average: 71,
    best: { date: '2026-11-22', score: 94 },
    worst: { date: '2026-11-05', score: 38 },
    plan: { total: 110, done: 78, partial: 9, missed: 23, moved: 11 },
    rules: {
      active: 48,
      kept: 43,
      broken: 5,
      byRule: [{ title: 'Bez mobitela u krevetu', weight: 2, broken: 4, triggers: ['stres', 'dosada'] }],
    },
    sleep: { nights: 24, averageMinutes: 420, shortNights: 6, onTarget: 15, withTarget: 24 },
    xp: 1340,
    rating: 3.6,
    gaveUpDays: 1,
    misses: { morning: 5, afternoon: 6, evening: 21 },
    repeatedMisses: [{ title: 'Trening', count: 6 }],
    calories: null,
    money: { days: 18, spentCents: 31200, budgetCents: 30000, overDays: 5 },
  },
  previousMonth: null,
  days: [
    { date: '2026-11-05', score: 38, rating: 2, comments: [{ title: 'Trening', outcome: 'not', comment: 'četvrtkom kasno s faksa' }], broken: [] },
    { date: '2026-11-12', score: 52, rating: 2, comments: [], broken: [] },
    { date: '2026-11-22', score: 94, rating: 5, comments: [], broken: [] },
  ],
  ideas: ['Četvrtkom planiraj lakše — jedna stvar manje.', 'Trening prebaci s večeri na jutro vikendom.'],
  changes: { accepted: 2, rejected: 1 },
  previous: [],
} as const;
