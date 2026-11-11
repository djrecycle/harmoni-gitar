"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { zodError } from "@/lib/action-result-server";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { getAvailablePieces } from "@/lib/pieces";
import { GENERAL_BPM_KEY } from "@/lib/practice";
import { ROUTINE_KEYS } from "@/lib/routine";
import { requireStudent } from "@/lib/session";
import { today } from "@/lib/utils";
import { getT } from "@/i18n/server";

const MAX_SECONDS = 6 * 60 * 60;
const rating = z.number().int().min(1).max(5).nullable();
const note = z.string().trim().max(1000, "Note is too long");

const timerSchema = z.object({
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  /** Seconds actually spent per segment. */
  seconds: z.object(Object.fromEntries(ROUTINE_KEYS.map((k) => [k, z.number().int().min(0).max(MAX_SECONDS)])) as Record<(typeof ROUTINE_KEYS)[number], z.ZodNumber>),
  /** Highest metronome tempo per piece id, or under "general" when no piece was picked. */
  maxBpm: z.record(z.string().max(40), z.number().int().min(20).max(300)).default({}),
  mood: rating,
  difficulty: rating,
  note,
});

export type TimerSession = z.input<typeof timerSchema>;

/** Save a session from the practice timer. */
export async function savePracticeSession(input: TimerSession): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  const p = timerSchema.safeParse(input);
  if (!p.success) return zodError(p.error);
  const v = p.data;
  const startedAt = new Date(v.startedAt);
  const endedAt = new Date(v.endedAt);
  const total = ROUTINE_KEYS.reduce((n, k) => n + v.seconds[k], 0);
  const now = Date.now();
  if (total < 60) return fail(t("Practise at least 1 minute before saving."));
  if (total > MAX_SECONDS) return fail(t("A session can be at most 6 hours."));
  // The timer runs on the student's device: only accept sensible times (started in the last 24 hours, not in the future).
  if (startedAt.getTime() < now - 86_400_000 || endedAt.getTime() > now + 5 * 60_000 || endedAt < startedAt) return fail(t("The practice time looks wrong. Check your device's clock."));

  // Ignore a double tap on "Save": the same start time is saved once.
  const P = schema.practiceSession;
  const [dup] = await db.select({ id: P.id }).from(P).where(and(eq(P.studentId, student.id), eq(P.startedAt, startedAt))).limit(1);
  if (dup) return succeed(t("Practice saved to your journal."));

  // Only pieces this student may open count; anything else is dropped.
  const available = new Set((await getAvailablePieces(student.id)).map((p) => p.id));
  const maxBpm = Object.fromEntries(Object.entries(v.maxBpm).filter(([k]) => k === GENERAL_BPM_KEY || available.has(k)));
  const pieceIds = Object.keys(maxBpm).filter((k) => k !== GENERAL_BPM_KEY);

  await db.insert(P).values({
    studentId: student.id,
    startedAt,
    endedAt,
    totalSeconds: total,
    segments: Object.fromEntries(ROUTINE_KEYS.filter((k) => v.seconds[k] > 0).map((k) => [k, Math.round((v.seconds[k] / 60) * 10) / 10])),
    pieceIds,
    maxBpm,
    mood: v.mood,
    difficulty: v.difficulty,
    studentNote: v.note || null,
  });
  // Best tempo per piece: keep the highest ever.
  const PP = schema.pieceProgress;
  for (const pieceId of pieceIds) {
    const bpm = maxBpm[pieceId];
    await db
      .insert(PP)
      .values({ studentId: student.id, pieceId, bestBpm: bpm })
      .onConflictDoUpdate({ target: [PP.studentId, PP.pieceId], set: { bestBpm: sql`greatest(coalesce(${PP.bestBpm}, 0), ${bpm})` } });
  }
  refresh();
  return succeed(t("Practice saved to your journal."));
}

const manualSchema = z.object({
  date: z.iso.date("Invalid date"),
  minutes: z.coerce.number().int("Minutes must be a whole number").min(1, "At least 1 minute").max(360, "At most 360 minutes"),
  note,
});

/** Record practice done without the timer (e.g. yesterday, or on paper). Up to 7 days back. */
export async function addManualPractice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  const p = manualSchema.safeParse({ date: fd.get("date"), minutes: fd.get("minutes"), note: fd.get("note") ?? "" });
  if (!p.success) return zodError(p.error, fd);
  const now = today();
  const d = p.data.date;
  const earliest = new Date(`${now}T00:00:00+07:00`).getTime() - 7 * 86_400_000;
  const startedAt = new Date(`${d}T${d === now ? "00:00:00" : "18:00:00"}+07:00`);
  if (d > now || startedAt.getTime() < earliest) return fail(t("Pick a date in the last 7 days."), fd);
  // Today's entry starts "minutes ago" so it never lands in the future.
  const start = d === now ? new Date(Math.max(startedAt.getTime(), Date.now() - p.data.minutes * 60_000)) : startedAt;
  await db.insert(schema.practiceSession).values({
    studentId: student.id,
    startedAt: start,
    endedAt: new Date(start.getTime() + p.data.minutes * 60_000),
    totalSeconds: p.data.minutes * 60,
    segments: {},
    studentNote: p.data.note || null,
  });
  refresh();
  return succeed(t("Practice saved to your journal."));
}

/** A student may delete their own entry from the last 7 days (a mistake), not older ones. */
export async function deletePracticeSession(id: string): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  if (!z.uuid().safeParse(id).success) return fail(t("Invalid data"));
  const P = schema.practiceSession;
  const r = await db
    .delete(P)
    .where(and(eq(P.id, id), eq(P.studentId, student.id), gte(P.createdAt, new Date(Date.now() - 7 * 86_400_000))))
    .returning({ id: P.id });
  if (!r.length) return fail(t("Only entries from the last 7 days can be deleted."));
  refresh();
  return succeed(t("Entry deleted."));
}
