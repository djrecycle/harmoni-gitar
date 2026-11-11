/*
 * Calendar-date helpers. Dates are "YYYY-MM-DD" strings in WIB (UTC+7, no DST), which is how they are stored
 * in `date` columns. Safe to import from client components.
 */

import { addDays } from "./utils";

/** ISO day of week for a "YYYY-MM-DD" date: 1 = Monday … 7 = Sunday. */
export function isoDayOfWeek(date: string): number {
  const js = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/** The Monday of the week that contains `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoDayOfWeek(date));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** The WIB calendar date of a moment. */
export function wibDate(d: Date | string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date(d));
}

export const isDateString = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** English day names (translated through i18n), index = ISO day - 1. */
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const dayName = (isoDay: number) => DAY_NAMES[(isoDay - 1 + 7) % 7];

/** "HH:MM:SS" or "HH:MM" -> "HH:MM". */
export const shortTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

/** "YYYY-MM-DD" -> "DD/MM/YYYY". */
export function formatDay(date: string | null | undefined): string {
  if (!date) return "-";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD" -> "DD/MM" (for compact lists). */
export function formatDayShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}
