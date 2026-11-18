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
