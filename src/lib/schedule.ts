import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isoDayOfWeek } from "./dates";
import { addDays, today } from "./utils";

/*
 * Private lessons: a lesson_slot is a fixed weekly time; meetings are generated from it up to HORIZON_DAYS ahead
 * (and from a week back, so this week's lesson can still get its attendance). Generating is idempotent:
 * (slotId, originalDate) is unique, and a moved meeting keeps its originalDate.
 * Inactive students get no new meetings and are left out of every schedule list.
 */

export const HORIZON_DAYS = 56; // 8 weeks

/** Create the missing meetings of a teacher's active slots. Cheap enough to call on each schedule page load. */
export async function ensureMeetings(teacherId: string, slotId?: string) {
  const S = schema;
  const now = today();
  const from = addDays(now, -7);
  const until = addDays(now, HORIZON_DAYS);
  const slots = await db
    .select({ slot: S.lessonSlot })
    .from(S.lessonSlot)
    .innerJoin(S.studentProfile, eq(S.studentProfile.userId, S.lessonSlot.studentId))
    .where(
      and(
        eq(S.lessonSlot.teacherId, teacherId),
        eq(S.studentProfile.status, "active"),
        lte(S.lessonSlot.activeFrom, until),
        or(isNull(S.lessonSlot.activeUntil), gte(S.lessonSlot.activeUntil, from)),
        slotId ? eq(S.lessonSlot.id, slotId) : undefined,
      ),
    );

  const values: (typeof S.meeting.$inferInsert)[] = [];
  for (const { slot } of slots) {
    const start = slot.activeFrom > from ? slot.activeFrom : from;
    const end = slot.activeUntil && slot.activeUntil < until ? slot.activeUntil : until;
    // First date on the slot's weekday, then every 7 days.
    let d = addDays(start, (slot.dayOfWeek - isoDayOfWeek(start) + 7) % 7);
    for (; d <= end; d = addDays(d, 7)) {
      values.push({ studentId: slot.studentId, teacherId, slotId: slot.id, originalDate: d, date: d, startTime: slot.startTime, status: "scheduled" });
    }
  }
  if (values.length) await db.insert(S.meeting).values(values).onConflictDoNothing({ target: [S.meeting.slotId, S.meeting.originalDate] });
}

const meetingFields = {
  id: schema.meeting.id,
  studentId: schema.meeting.studentId,
  studentName: schema.user.name,
  slotId: schema.meeting.slotId,
  date: schema.meeting.date,
  startTime: schema.meeting.startTime,
  status: schema.meeting.status,
  material: schema.meeting.material,
  teacherNote: schema.meeting.teacherNote,
  privateNote: schema.meeting.privateNote,
  durationMinutes: schema.lessonSlot.durationMinutes,
  location: schema.lessonSlot.location,
};

/** A teacher's meetings with active students between two dates (inclusive). */
export async function teacherMeetings(teacherId: string, from: string, to: string, studentId?: string) {
  const S = schema;
  return db
    .select(meetingFields)
    .from(S.meeting)
    .innerJoin(S.user, eq(S.user.id, S.meeting.studentId))
    .innerJoin(S.studentProfile, eq(S.studentProfile.userId, S.meeting.studentId))
    .leftJoin(S.lessonSlot, eq(S.lessonSlot.id, S.meeting.slotId))
    .where(
      and(
        eq(S.meeting.teacherId, teacherId),
        eq(S.studentProfile.status, "active"),
        gte(S.meeting.date, from),
        lte(S.meeting.date, to),
        studentId ? eq(S.meeting.studentId, studentId) : undefined,
      ),
    )
    .orderBy(asc(S.meeting.date), asc(S.meeting.startTime));
}

export type MeetingRow = Awaited<ReturnType<typeof teacherMeetings>>[number];

/** One student's meetings (any date range), for their own schedule page or their profile. */
export async function studentMeetings(studentId: string, opts: { from?: string; to?: string; limit?: number; order?: "asc" | "desc" } = {}) {
  const S = schema;
  const q = db
    .select(meetingFields)
    .from(S.meeting)
    .innerJoin(S.user, eq(S.user.id, S.meeting.studentId))
    .leftJoin(S.lessonSlot, eq(S.lessonSlot.id, S.meeting.slotId))
    .where(and(eq(S.meeting.studentId, studentId), opts.from ? gte(S.meeting.date, opts.from) : undefined, opts.to ? lte(S.meeting.date, opts.to) : undefined))
    .orderBy(
      opts.order === "desc" ? sql`${S.meeting.date} desc` : asc(S.meeting.date),
      opts.order === "desc" ? sql`${S.meeting.startTime} desc nulls last` : asc(S.meeting.startTime),
    );
  return opts.limit ? q.limit(opts.limit) : q;
}

/** Fixed weekly slots of a teacher (or of one student), active ones only. */
export async function listSlots(teacherId: string, studentId?: string) {
  const S = schema;
  return db
    .select({ slot: S.lessonSlot, studentName: S.user.name, studentStatus: S.studentProfile.status })
    .from(S.lessonSlot)
    .innerJoin(S.user, eq(S.user.id, S.lessonSlot.studentId))
    .innerJoin(S.studentProfile, eq(S.studentProfile.userId, S.lessonSlot.studentId))
    .where(
      and(
        eq(S.lessonSlot.teacherId, teacherId),
        or(isNull(S.lessonSlot.activeUntil), gte(S.lessonSlot.activeUntil, today())),
        studentId ? eq(S.lessonSlot.studentId, studentId) : undefined,
      ),
    )
    .orderBy(asc(S.lessonSlot.dayOfWeek), asc(S.lessonSlot.startTime));
}

/** Slots of a student, for their own page. */
export async function slotsOfStudent(studentId: string) {
  const S = schema;
  return db
    .select()
    .from(S.lessonSlot)
    .where(and(eq(S.lessonSlot.studentId, studentId), or(isNull(S.lessonSlot.activeUntil), gte(S.lessonSlot.activeUntil, today()))))
    .orderBy(asc(S.lessonSlot.dayOfWeek), asc(S.lessonSlot.startTime));
}

/** Delete future, still-scheduled meetings of a slot (when the slot is removed). Past ones keep their attendance. */
export async function dropFutureMeetings(slotId: string) {
  const S = schema;
  await db.delete(S.meeting).where(and(eq(S.meeting.slotId, slotId), eq(S.meeting.status, "scheduled"), gte(S.meeting.date, today())));
}
