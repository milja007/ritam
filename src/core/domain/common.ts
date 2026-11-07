/**
 * Zajednički primitivi domenskog modela (Zod sheme + tipovi).
 * Čista logika: bez React importa. Ista shema vrijedi za lokalni SQLite i Supabase.
 */
import { z } from 'zod';

import { parseClock } from '../time/clock';

/** Neprazan identifikator (uuid ili lokalni id — generiranje dolazi s bazom). */
export const idSchema = z.string().trim().min(1);

/** Trenutak u vremenu, ISO 8601 (npr. "2026-11-07T19:43:00.000Z" ili s pomakom). */
export const timestampSchema = z.iso.datetime({ offset: true });

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Je li "YYYY-MM-DD" stvaran kalendarski datum (odbija 2026-02-30). */
export function isValidLocalDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** Lokalni kalendarski dan korisnika, "YYYY-MM-DD" (bez vremenske zone). */
export const localDateSchema = z
  .string()
  .refine(isValidLocalDate, { message: 'Expected a calendar date YYYY-MM-DD' });

/** Vrijeme u danu, "HH:MM" (24h). */
export const clockTimeSchema = z
  .string()
  .refine((value) => parseClock(value) !== null && /^\d{2}:\d{2}$/.test(value), {
    message: 'Expected a time HH:MM (00:00–23:59)',
  });

/** Ocjena 1–5 (raspoloženje, ocjena dana). */
export const rating1to5Schema = z.number().int().min(1).max(5);

/** Dan u tjednu, 0 = nedjelja … 6 = subota (kao `Date#getDay`). */
export const weekdaySchema = z.number().int().min(0).max(6);

/** Kratki slobodni tekst korisnika (komentar, napomena). */
export const noteSchema = z.string().trim().max(2000);

/** Polja koja ima svaka tablica (koncept: id, userId, createdAt, updatedAt). */
export const baseEntityShape = {
  id: idSchema,
  userId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
};

export const baseEntitySchema = z.object(baseEntityShape);

export type Id = z.infer<typeof idSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
export type LocalDate = z.infer<typeof localDateSchema>;
export type ClockTime = z.infer<typeof clockTimeSchema>;
export type Rating1to5 = z.infer<typeof rating1to5Schema>;
export type Weekday = z.infer<typeof weekdaySchema>;
export type BaseEntity = z.infer<typeof baseEntitySchema>;
