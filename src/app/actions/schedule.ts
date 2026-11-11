"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { zodError } from "@/lib/action-result-server";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { isTeacherOfStudent } from "@/lib/access";
import { LOCATIONS, MEETING_STATUSES } from "@/lib/labels";
import { dropFutureMeetings, ensureMeetings } from "@/lib/schedule";
import { requireTeacher } from "@/lib/session";
import { today } from "@/lib/utils";
import { getT } from "@/i18n/server";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must look like 16:00");
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(max, "Text is too long").nullable());

async function activeStudentOf(teacherId: string, studentId: string) {
  if (!z.string().min(1).max(64).safeParse(studentId).success) return false;
  if (!(await isTeacherOfStudent(teacherId, studentId))) return false;
  const [p] = await db.select({ status: schema.studentProfile.status }).from(schema.studentProfile).where(eq(schema.studentProfile.userId, studentId)).limit(1);
  return p?.status === "active";
}

/* ------------------------------ Weekly slots ------------------------------ */

const slotSchema = z.object({
  studentId: z.string().min(1, "Pick a student"),
  dayOfWeek: z.coerce.number().int().min(1, "Pick a day").max(7, "Pick a day"),
  startTime: time,
  durationMinutes: z.coerce.number().int("Minutes must be a whole number").min(15, "At least 15 minutes").max(240, "At most 240 minutes"),
  location: z.enum(LOCATIONS),
  activeFrom: z.iso.date("Invalid date"),
});

export async function createSlot(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = slotSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return zodError(p.error, fd);
  if (!(await activeStudentOf(teacher.id, p.data.studentId))) return fail(t("Pick one of your active students."), fd);
  const [slot] = await db.insert(schema.lessonSlot).values({ ...p.data, teacherId: teacher.id }).returning({ id: schema.lessonSlot.id });
  await ensureMeetings(teacher.id, slot.id);
  refresh();
  return succeed(t("Weekly lesson time added. Meetings for the next 8 weeks were created."));
}

/** Remove a weekly slot: its future, still-scheduled meetings go too; past meetings keep their attendance. */
export async function deleteSlot(id: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  if (!z.uuid().safeParse(id).success) return fail(t("Not found"));
  const [slot] = await db.select().from(schema.lessonSlot).where(and(eq(schema.lessonSlot.id, id), eq(schema.lessonSlot.teacherId, teacher.id))).limit(1);
  if (!slot) return fail(t("Not found"));
  await dropFutureMeetings(id);
  await db.delete(schema.lessonSlot).where(eq(schema.lessonSlot.id, id));
  refresh();
  return succeed(t("Weekly lesson time removed."));
}

/* -------------------------------- Meetings -------------------------------- */

const extraSchema = z.object({
  studentId: z.string().min(1, "Pick a student"),
  date: z.iso.date("Invalid date"),
  startTime: time,
});

/** A one-off meeting (make-up lesson or extra lesson). */
export async function createMeeting(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = extraSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return zodError(p.error, fd);
  if (!(await activeStudentOf(teacher.id, p.data.studentId))) return fail(t("Pick one of your active students."), fd);
  await db.insert(schema.meeting).values({ ...p.data, teacherId: teacher.id, status: "scheduled" });
  refresh();
  return succeed(t("Meeting added."));
}

const updateSchema = z.object({
  date: z.iso.date("Invalid date"),
  startTime: z.preprocess((v) => (v === "" ? null : v), time.nullable()),
  status: z.enum(MEETING_STATUSES),
  material: optionalText(1000),
  teacherNote: optionalText(2000),
  privateNote: optionalText(2000),
});

async function ownMeeting(teacherId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [m] = await db.select().from(schema.meeting).where(and(eq(schema.meeting.id, id), eq(schema.meeting.teacherId, teacherId))).limit(1);
  return m ?? null;
}

/** Attendance, notes, and moving a meeting to another date/time. */
export async function updateMeeting(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const m = await ownMeeting(teacher.id, id);
  if (!m) return fail(t("Not found"));
  const p = updateSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return zodError(p.error, fd);
  if (p.data.status !== "scheduled" && p.data.status !== "batal_guru" && p.data.status !== "pengganti" && p.data.date > today())
    return fail(t("Attendance can only be filled in on or after the meeting day."), fd);
  await db.update(schema.meeting).set(p.data).where(eq(schema.meeting.id, id));
  refresh();
  return succeed(t("Meeting saved."));
}

/** Quick attendance from a list (dashboard / schedule). */
export async function setAttendance(id: string, status: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const s = z.enum(MEETING_STATUSES).safeParse(status);
  const m = await ownMeeting(teacher.id, id);
  if (!m || !s.success) return fail(t("Not found"));
  if (s.data !== "scheduled" && s.data !== "batal_guru" && m.date > today()) return fail(t("Attendance can only be filled in on or after the meeting day."));
  await db.update(schema.meeting).set({ status: s.data }).where(eq(schema.meeting.id, id));
  refresh();
  return succeed();
}

/** Only one-off meetings can be deleted; a meeting from a weekly slot is cancelled instead (it would come back). */
export async function deleteMeeting(id: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const m = await ownMeeting(teacher.id, id);
  if (!m) return fail(t("Not found"));
  if (m.slotId) return fail(t("A meeting from a weekly lesson time cannot be deleted. Set it to “Cancelled by teacher” instead."));
  await db.delete(schema.meeting).where(eq(schema.meeting.id, id));
  redirect("/guru/jadwal");
}
