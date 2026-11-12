"use server";

import { and, count, eq, inArray, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { isTeacherOfStudent } from "@/lib/access";
import { isDateString } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { currentStage, saveStage } from "@/lib/piece-progress";
import { MAX_RECORDING_SECONDS, MAX_VOICE_COMMENT_SECONDS, RUBRIC } from "@/lib/rubric";
import { requireStudent, requireTeacher } from "@/lib/session";
import { deleteFile } from "@/lib/storage";
import { shortLabel, plainText } from "@/lib/utils";
import { getT } from "@/i18n/server";

/*
 * Assignments, recordings and reviews (Tahap 3). Every action checks the role and who owns the data:
 * a teacher only touches their own assignments (for their own students), a student only their own.
 */

const A = schema.assignment;
const R = schema.recording;
const V = schema.review;
const uuid = z.uuid();
const KEY_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** What a notification says about an assignment: its piece, or the start of its instructions. */
function about(a: { pieceTitle?: string | null; instructions?: string | null }) {
  return a.pieceTitle ?? shortLabel(plainText(a.instructions ?? ""), 80);
}

/* ------------------------------ Teacher ------------------------------ */

const createSchema = z
  .object({
    studentIds: z.array(z.string().min(1).max(64)).min(1, "students").max(100),
    pieceId: uuid.optional(),
    lessonId: uuid.optional(),
    targetStage: z.coerce.number().int().min(1).max(3).optional(),
    targetBpm: z.coerce.number().int().min(20).max(300).optional(),
    instructions: z.string().trim().max(2000).optional(),
    dueDate: z.string().refine(isDateString).optional(),
  })
  .refine((v) => v.pieceId || v.lessonId || v.instructions, { message: "what", path: ["instructions"] });

/** Give one assignment to each chosen student (form: studentIds[], pieceId, lessonId, targetStage, targetBpm, instructions, dueDate). */
export async function createAssignments(_: ActionResult<unknown>, fd: FormData): Promise<ActionResult<{ count: number }>> {
  const t = await getT();
  const teacher = await requireTeacher();
  const opt = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const p = createSchema.safeParse({
    studentIds: fd.getAll("studentIds").map(String),
    pieceId: opt("pieceId"),
    lessonId: opt("lessonId"),
    targetStage: opt("targetStage"),
    targetBpm: opt("targetBpm"),
    instructions: opt("instructions"),
    dueDate: opt("dueDate"),
  });
  if (!p.success) {
    const issue = p.error.issues[0];
    return fail(
      issue?.message === "students" ? t("Choose at least one student.") : issue?.message === "what" ? t("Choose a score or lesson, or write what to practise.") : t("Invalid data"),
      fd,
    );
  }
  const v = p.data;
  const own = await db
    .select({ id: schema.studentProfile.userId })
    .from(schema.studentProfile)
    .where(and(eq(schema.studentProfile.teacherId, teacher.id), inArray(schema.studentProfile.userId, v.studentIds)));
  if (own.length !== new Set(v.studentIds).size) return fail(t("Student not found."), fd);
  let pieceTitle: string | null = null;
  if (v.pieceId) {
    const [pc] = await db.select({ title: schema.piece.title }).from(schema.piece).where(eq(schema.piece.id, v.pieceId)).limit(1);
    if (!pc) return fail(t("Score not found."), fd);
    pieceTitle = pc.title;
  }
  if (v.lessonId) {
    const [l] = await db.select({ id: schema.lesson.id }).from(schema.lesson).where(eq(schema.lesson.id, v.lessonId)).limit(1);
    if (!l) return fail(t("Lesson not found."), fd);
  }

  const rows = await db
    .insert(A)
    .values(
      own.map((s) => ({
        teacherId: teacher.id,
        studentId: s.id,
        pieceId: v.pieceId ?? null,
        lessonId: v.lessonId ?? null,
        targetStage: v.pieceId ? (v.targetStage ?? null) : null,
        targetBpm: v.targetBpm ?? null,
        instructions: v.instructions ?? null,
        dueDate: v.dueDate ?? null,
      })),
    )
    .returning({ id: A.id, studentId: A.studentId });
  for (const r of rows) await notify(r.studentId, { type: "assignment_new", body: about({ pieceTitle, instructions: v.instructions }), link: `/siswa/tugas/${r.id}` });
  refresh();
  return succeed(rows.length === 1 ? t("Assignment given.") : t("Assignment given to {0} students.", rows.length), { count: rows.length });
}

async function ownAssignment(teacherId: string, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [a] = await db.select().from(A).where(and(eq(A.id, id), eq(A.teacherId, teacherId))).limit(1);
  return a ?? null;
}

/** Delete an assignment with its recordings and reviews (files too). */
export async function deleteAssignment(id: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const a = await ownAssignment(teacher.id, id);
  if (!a) return fail(t("Assignment not found."));
  const recs = await db.select({ id: R.id, fileKey: R.fileKey }).from(R).where(eq(R.assignmentId, a.id));
  const reviews = recs.length ? await db.select({ key: V.audioCommentFileKey }).from(V).where(inArray(V.recordingId, recs.map((r) => r.id))) : [];
  await db.transaction(async (tx) => {
    if (recs.length) await tx.delete(R).where(inArray(R.id, recs.map((r) => r.id)));
    await tx.delete(A).where(eq(A.id, a.id));
  });
  for (const key of [...recs.map((r) => r.fileKey), ...reviews.map((r) => r.key)]) if (key) await deleteFile(key);
  return succeed(t("Assignment deleted."));
}

/** Mark an assignment as done, or open it again. */
export async function setAssignmentDone(id: string, done: boolean): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const a = await ownAssignment(teacher.id, id);
  if (!a) return fail(t("Assignment not found."));
  const [{ n }] = await db.select({ n: count() }).from(R).where(eq(R.assignmentId, a.id));
  const status = done ? "done" : n ? "reviewed" : "assigned";
  await db.update(A).set({ status }).where(eq(A.id, a.id));
  if (done) await notify(a.studentId, { type: "assignment_done", body: shortLabel(plainText(a.instructions ?? ""), 80) || undefined, link: `/siswa/tugas/${a.id}` });
  refresh();
  return succeed(done ? t("Assignment marked as done.") : t("Assignment opened again."));
}

const reviewSchema = z.object({
  scores: z.object(Object.fromEntries(RUBRIC.map((r) => [r.key, z.number().int().min(1).max(4)])) as Record<(typeof RUBRIC)[number]["key"], z.ZodNumber>),
  comment: z.string().trim().max(3000).optional(),
  /** A new voice comment (from /api/upload/recording), or null to remove the old one; undefined keeps it. */
  audioKey: z.string().max(200).nullable().optional(),
  audioSeconds: z.number().int().min(0).max(MAX_VOICE_COMMENT_SECONDS + 5).optional(),
  markDone: z.boolean(),
  /** Also record the assignment's target stage as reached and checked. */
  confirmStage: z.boolean(),
});

export type ReviewInput = z.input<typeof reviewSchema>;

/** Score a recording with the rubric (a second save updates the same review). */
export async function saveReview(recordingId: string, input: ReviewInput): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = reviewSchema.safeParse(input);
  if (!uuid.safeParse(recordingId).success || !p.success) return fail(t("Give every aspect a score from 1 to 4."));
  const v = p.data;
  const [row] = await db
    .select({ r: R, a: A, pieceTitle: schema.piece.title })
    .from(R)
    .innerJoin(A, eq(A.id, R.assignmentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(and(eq(R.id, recordingId), eq(A.teacherId, teacher.id)))
    .limit(1);
  if (!row || !(await isTeacherOfStudent(teacher.id, row.r.studentId))) return fail(t("Recording not found."));
  if (v.audioKey && !new RegExp(`^recording/${row.r.studentId}/comment-${KEY_ID}\\.[a-z0-9]{2,5}$`).test(v.audioKey)) return fail(t("Invalid data"));

  const [old] = await db.select().from(V).where(eq(V.recordingId, recordingId)).limit(1);
  const audioCommentFileKey = v.audioKey === undefined ? (old?.audioCommentFileKey ?? null) : v.audioKey;
  const fields = { ...v.scores, comment: v.comment || null, audioCommentFileKey, teacherId: teacher.id };
  if (old) await db.update(V).set(fields).where(eq(V.id, old.id));
  else await db.insert(V).values({ recordingId, ...fields });
  if (old?.audioCommentFileKey && old.audioCommentFileKey !== audioCommentFileKey) await deleteFile(old.audioCommentFileKey);

  await db.update(A).set({ status: v.markDone ? "done" : "reviewed" }).where(eq(A.id, row.a.id));
  if (v.markDone && v.confirmStage && row.a.pieceId && row.a.targetStage) {
    const stage = Math.max(row.a.targetStage, await currentStage(row.r.studentId, row.a.pieceId));
    await saveStage(row.r.studentId, row.a.pieceId, stage, true);
  }
  if (!old) await notify(row.r.studentId, { type: "recording_reviewed", body: about({ pieceTitle: row.pieceTitle, instructions: row.a.instructions }), link: `/siswa/tugas/${row.a.id}` });
  refresh();
  return succeed(t("Review saved."));
}

/* ------------------------------ Student ------------------------------ */

const submitSchema = z.object({
  assignmentId: uuid,
  fileKey: z.string().max(200),
  mimeType: z.string().max(60),
  durationSeconds: z.number().int().min(1).max(MAX_RECORDING_SECONDS + 5),
  note: z.string().trim().max(1000).optional(),
});

/** Send a recording (already uploaded to /api/upload/recording) for an assignment. */
export async function submitRecording(input: z.input<typeof submitSchema>): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  const p = submitSchema.safeParse(input);
  if (!p.success) return fail(t("Invalid data"));
  const v = p.data;
  // Only a file in this student's own folder, as named by the upload route.
  if (!new RegExp(`^recording/${student.id}/${KEY_ID}\\.[a-z0-9]{2,5}$`).test(v.fileKey)) return fail(t("Invalid data"));
  const [a] = await db
    .select({ a: A, pieceTitle: schema.piece.title })
    .from(A)
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(and(eq(A.id, v.assignmentId), eq(A.studentId, student.id)))
    .limit(1);
  if (!a) return fail(t("Assignment not found."));
  if (a.a.status === "done") return fail(t("This assignment is already done."));
  const [rec] = await db
    .insert(R)
    .values({ studentId: student.id, assignmentId: a.a.id, pieceId: a.a.pieceId, fileKey: v.fileKey, mimeType: v.mimeType, durationSeconds: v.durationSeconds, note: v.note || null })
    .returning({ id: R.id });
  await db.update(A).set({ status: "submitted" }).where(eq(A.id, a.a.id));
  await notify(a.a.teacherId, { type: "recording_submitted", body: `${student.name} · ${about({ pieceTitle: a.pieceTitle, instructions: a.a.instructions })}`, link: `/guru/penilaian/${rec.id}` });
  refresh();
  return succeed(t("Recording sent to your teacher."));
}

/** Delete one of the student's own recordings that has not been reviewed yet. */
export async function deleteRecording(id: string): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  if (!uuid.safeParse(id).success) return fail(t("Recording not found."));
  const [r] = await db.select().from(R).where(and(eq(R.id, id), eq(R.studentId, student.id))).limit(1);
  if (!r) return fail(t("Recording not found."));
  const [reviewed] = await db.select({ id: V.id }).from(V).where(eq(V.recordingId, r.id)).limit(1);
  if (reviewed) return fail(t("Your teacher already reviewed this recording, so it stays."));
  await db.delete(R).where(eq(R.id, r.id));
  await deleteFile(r.fileKey);
  if (r.assignmentId) {
    // Back to "to do" when nothing is left to review.
    const left = await db.select({ id: R.id }).from(R).where(eq(R.assignmentId, r.assignmentId));
    const reviews = left.length ? await db.select({ id: V.id }).from(V).where(inArray(V.recordingId, left.map((x) => x.id))) : [];
    const status = !left.length ? "assigned" : reviews.length === left.length ? "reviewed" : "submitted";
    await db.update(A).set({ status }).where(and(eq(A.id, r.assignmentId), eq(A.studentId, student.id), ne(A.status, "done")));
  }
  refresh();
  return succeed(t("Recording deleted."));
}
