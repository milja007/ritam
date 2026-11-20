import type { WidgetProps } from '../core/widget';

/**
 * Početni sadržaj widgeta prije prve snimke iz appa. Doslovna vrijednost, jer se datoteka
 * widgeta pakira zasebno (početni izgled) i ne smije povući `core` (zod i ostalo); test drži
 * vrijednost jednakom `widgetPlaceholder()` iz `core/widget`.
 */
export const RITAM_DAY_PLACEHOLDER: WidgetProps = {
  date: '',
  stale: true,
  score: null,
  ember: 'unlit',
  streak: 0,
  done: 0,
  total: 0,
  current: null,
  next: null,
  labels: {
    now: 'Sada · Now',
    next: 'Sljedeće · Next',
    free: '',
    dayDone: '',
    noPlan: '',
    openApp: 'Otvori Ritam · Open Ritam',
    streakUnit: '',
  },
  light: { background: '#FFFFFF', text: '#0B0B10', muted: '#5C5C6E', accent: '#C25E00', ember: null, emberOn: '#8A8A9C' },
  dark: { background: '#0B0B10', text: '#F5F5F9', muted: '#8A8A9C', accent: '#E88A2E', ember: null, emberOn: '#5C5C6E' },
};
