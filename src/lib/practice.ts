import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysBetween, startOfWeek } from "./dates";
import { addDays, today } from "./utils";

/*
 * Practice journal statistics, always computed from practice_session (nothing is stored separately).
 * Days are WIB calendar days of `startedAt`.
 */

/** Key in practice_session.maxBpm for the metronome tempo when no piece is picked (pieces arrive in stage 2). */
export const GENERAL_BPM_KEY = "general";

const wibDay = sql<string>`to_char(${schema.practiceSession.startedAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

/** Minutes practised per WIB day since `from` (inclusive), for several students at once. */
async function minutesPerDay(studentIds: string[], from: string) {
  if (!studentIds.length) return [];
  return db
    .select({ studentId: schema.practiceSession.studentId, day: wibDay, seconds: sql<number>`sum(${schema.practiceSession.totalSeconds})::int` })
    .from(schema.practiceSession)
    .where(and(inArray(schema.practiceSession.studentId, studentIds), gte(schema.practiceSession.startedAt, new Date(`${from}T00:00:00+07:00`))))
    .groupBy(schema.practiceSession.studentId, wibDay);
}

/** Days in a row with practice, counting back from today (or from yesterday when today has none yet). */
export function streakFrom(days: Set<string>, now = today()): number {
  let d = days.has(now) ? now : addDays(now, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export type WeekDay = { date: string; minutes: number };

export type PracticeStats = {
  streak: number;
  /** Mon–Sun of the current week. */
  week: WeekDay[];
  weekMinutes: number;
  daysThisWeek: number;
  /** Total minutes of each of the last 4 weeks, oldest first (the last one is this week). */
  lastWeeks: { start: string; minutes: number; days: number }[];
  lastPractice: string | null;
};

const LOOKBACK_DAYS = 120;

function statsFrom(rows: { day: string; seconds: number }[], lastPractice: string | null, now = today()): PracticeStats {
  const byDay = new Map(rows.map((r) => [r.day, r.seconds]));
  const monday = startOfWeek(now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, minutes: Math.round((byDay.get(date) ?? 0) / 60) };
  });
  const lastWeeks = Array.from({ length: 4 }, (_, w) => {
    const start = addDays(monday, (w - 3) * 7);
    let seconds = 0;
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const s = byDay.get(addDays(start, i)) ?? 0;
      seconds += s;
      if (s > 0) days++;
    }
    return { start, minutes: Math.round(seconds / 60), days };
  });
  return {
    streak: streakFrom(new Set([...byDay.keys()].filter((d) => (byDay.get(d) ?? 0) > 0)), now),
    week,
    weekMinutes: week.reduce((n, d) => n + d.minutes, 0),
    daysThisWeek: week.filter((d) => d.minutes > 0).length,
    lastWeeks,
    lastPractice,
  };
}

/** Streak, this week and the last 4 weeks for one student. */
export async function getPracticeStats(studentId: string): Promise<PracticeStats> {
  return (await getPracticeStatsMany([studentId])).get(studentId)!;
}

/** The same statistics for many students (teacher dashboard). */
export async function getPracticeStatsMany(studentIds: string[]): Promise<Map<string, PracticeStats>> {
  const now = today();
  const [rows, last] = await Promise.all([
    minutesPerDay(studentIds, addDays(now, -LOOKBACK_DAYS)),
    studentIds.length
      ? db
          .select({ studentId: schema.practiceSession.studentId, last: sql<Date>`max(${schema.practiceSession.startedAt})` })
          .from(schema.practiceSession)
          .where(inArray(schema.practiceSession.studentId, studentIds))
          .groupBy(schema.practiceSession.studentId)
      : Promise.resolve([]),
  ]);
  const lastBy = new Map(last.map((l) => [l.studentId, l.last ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date(l.last)) : null]));
  return new Map(studentIds.map((id) => [id, statsFrom(rows.filter((r) => r.studentId === id), lastBy.get(id) ?? null, now)]));
}

/** Days since the last practice (null = never practised). */
export const daysSince = (lastPractice: string | null, now = today()) => (lastPractice ? daysBetween(lastPractice, now) : null);

/** Journal entries, newest first. */
export async function getJournal(studentId: string, limit = 30) {
  return db
    .select()
    .from(schema.practiceSession)
    .where(eq(schema.practiceSession.studentId, studentId))
    .orderBy(desc(schema.practiceSession.startedAt))
    .limit(limit);
}

export type JournalEntry = Awaited<ReturnType<typeof getJournal>>[number];
