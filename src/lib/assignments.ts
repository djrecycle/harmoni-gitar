import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { EXTRA_SEGMENT } from "./curriculum";
import { VISIBLE_STATUSES, getPieceBySlug, listAllPieces, type PieceView } from "./pieces";
import type { RubricScores } from "./rubric";

/*
 * Assignments (tugas), recordings and reviews (RENCANA_TEKNIS 5.5).
 * Status: assigned → submitted (the student sent a recording) → reviewed (the teacher scored it) → done.
 * After a review the student may send a new recording (back to submitted) until the teacher marks it done.
 */

export type AssignmentStatus = (typeof schema.assignmentStatusEnum.enumValues)[number];

const A = schema.assignment;
const R = schema.recording;
const V = schema.review;

export type ReviewView = RubricScores & { id: string; comment: string | null; audioCommentFileKey: string | null; createdAt: Date };
export type RecordingView = {
  id: string;
  fileKey: string;
  mimeType: string;
  durationSeconds: number | null;
  note: string | null;
  createdAt: Date;
  review: ReviewView | null;
};

/** Link to a lesson for a student: in its unit, or as extra material. */
async function lessonLinks(lessonIds: string[]) {
  if (!lessonIds.length) return new Map<string, { id: string; title: string; href: string }>();
  const rows = await db
    .select({ id: schema.lesson.id, title: schema.lesson.title, slug: schema.lesson.slug, unitSlug: schema.unit.slug })
    .from(schema.lesson)
    .leftJoin(schema.unit, eq(schema.unit.id, schema.lesson.unitId))
    .where(inArray(schema.lesson.id, lessonIds));
  return new Map(rows.map((l) => [l.id, { id: l.id, title: l.title, href: `/siswa/belajar/${l.unitSlug ?? EXTRA_SEGMENT}/${l.slug}` }]));
}

function baseSelect() {
  return {
    id: A.id,
    studentId: A.studentId,
    teacherId: A.teacherId,
    status: A.status,
    instructions: A.instructions,
    dueDate: A.dueDate,
    targetStage: A.targetStage,
    targetBpm: A.targetBpm,
    lessonId: A.lessonId,
    pieceId: A.pieceId,
    createdAt: A.createdAt,
    updatedAt: A.updatedAt,
    pieceTitle: schema.piece.title,
    pieceSlug: schema.piece.slug,
    studentName: schema.user.name,
  };
}

/** Open assignments first (nearest due date first), then finished ones (newest first). */
function sortAssignments<T extends { status: string; dueDate: string | null; updatedAt: Date }>(rows: T[]) {
  const open = rows.filter((r) => r.status !== "done").sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const done = rows.filter((r) => r.status === "done").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return [...open, ...done];
}

async function withCounts<T extends { id: string; lessonId: string | null }>(rows: T[]) {
  const ids = rows.map((r) => r.id);
  const [counts, links] = await Promise.all([
    ids.length ? db.select({ id: R.assignmentId, n: count() }).from(R).where(inArray(R.assignmentId, ids)).groupBy(R.assignmentId) : [],
    lessonLinks([...new Set(rows.map((r) => r.lessonId).filter((x): x is string => Boolean(x)))]),
  ]);
  const by = new Map(counts.map((c) => [c.id, c.n]));
  return rows.map((r) => ({ ...r, recordings: by.get(r.id) ?? 0, lesson: r.lessonId ? (links.get(r.lessonId) ?? null) : null }));
}

export async function listStudentAssignments(studentId: string) {
  const rows = await db
    .select(baseSelect())
    .from(A)
    .innerJoin(schema.user, eq(schema.user.id, A.studentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(eq(A.studentId, studentId));
  return withCounts(sortAssignments(rows));
}

/** The teacher's assignments (optionally of one student), with the number of recordings. */
export async function listTeacherAssignments(teacherId: string, studentId?: string) {
  const rows = await db
    .select(baseSelect())
    .from(A)
    .innerJoin(schema.user, eq(schema.user.id, A.studentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(and(eq(A.teacherId, teacherId), studentId ? eq(A.studentId, studentId) : undefined));
  return withCounts(sortAssignments(rows));
}

/** Recordings of an assignment (newest first) with their review. */
export async function recordingsOf(assignmentId: string): Promise<RecordingView[]> {
  const rows = await db
    .select({ r: R, v: V })
    .from(R)
    .leftJoin(V, eq(V.recordingId, R.id))
    .where(eq(R.assignmentId, assignmentId))
    .orderBy(desc(R.createdAt), desc(V.createdAt));
  const seen = new Set<string>();
  const out: RecordingView[] = [];
  for (const { r, v } of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      fileKey: r.fileKey,
      mimeType: r.mimeType,
      durationSeconds: r.durationSeconds,
      note: r.note,
      createdAt: r.createdAt,
      review: v ? { id: v.id, posture: v.posture, accuracy: v.accuracy, rhythm: v.rhythm, technique: v.technique, expression: v.expression, comment: v.comment, audioCommentFileKey: v.audioCommentFileKey, createdAt: v.createdAt } : null,
    });
  }
  return out;
}

/** The piece of an assignment as a student may see it (never one with an unclear copyright status). */
async function pieceFor(slug: string | null): Promise<PieceView | null> {
  if (!slug) return null;
  const p = await getPieceBySlug(slug);
  return p && (VISIBLE_STATUSES as readonly string[]).includes(p.copyrightStatus) ? p : null;
}

/** One assignment of this student, with its piece, lesson link and recordings. */
export async function getStudentAssignment(studentId: string, id: string) {
  const [a] = await db
    .select(baseSelect())
    .from(A)
    .innerJoin(schema.user, eq(schema.user.id, A.studentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(and(eq(A.id, id), eq(A.studentId, studentId)))
    .limit(1);
  if (!a) return null;
  const [piece, links, recordings] = await Promise.all([pieceFor(a.pieceSlug), lessonLinks(a.lessonId ? [a.lessonId] : []), recordingsOf(a.id)]);
  return { ...a, piece, lesson: a.lessonId ? (links.get(a.lessonId) ?? null) : null, recordings };
}

/** One assignment of this teacher (any student of theirs), with its recordings. */
export async function getTeacherAssignment(teacherId: string, id: string) {
  const [a] = await db
    .select(baseSelect())
    .from(A)
    .innerJoin(schema.user, eq(schema.user.id, A.studentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(and(eq(A.id, id), eq(A.teacherId, teacherId)))
    .limit(1);
  if (!a) return null;
  const [piece, links, recordings] = await Promise.all([a.pieceSlug ? getPieceBySlug(a.pieceSlug) : null, lessonLinks(a.lessonId ? [a.lessonId] : []), recordingsOf(a.id)]);
  return { ...a, piece, lesson: a.lessonId ? (links.get(a.lessonId) ?? null) : null, recordings };
}

/** Recordings of this teacher's students that have no review yet, oldest first (first come, first served). */
export async function reviewQueue(teacherId: string) {
  return db
    .select({
      id: R.id,
      createdAt: R.createdAt,
      durationSeconds: R.durationSeconds,
      studentId: R.studentId,
      studentName: schema.user.name,
      assignmentId: R.assignmentId,
      pieceTitle: schema.piece.title,
      instructions: A.instructions,
    })
    .from(R)
    .innerJoin(A, eq(A.id, R.assignmentId))
    .innerJoin(schema.user, eq(schema.user.id, R.studentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .leftJoin(V, eq(V.recordingId, R.id))
    .where(and(eq(A.teacherId, teacherId), isNull(V.id)))
    .orderBy(asc(R.createdAt));
}

/** The teacher's latest reviews. */
export async function recentReviews(teacherId: string, limit = 10) {
  return db
    .select({
      recordingId: R.id,
      reviewedAt: V.createdAt,
      studentName: schema.user.name,
      pieceTitle: schema.piece.title,
      instructions: A.instructions,
      average: sql<number>`round((${V.posture} + ${V.accuracy} + ${V.rhythm} + ${V.technique} + ${V.expression}) / 5.0, 1)`.mapWith(Number),
    })
    .from(V)
    .innerJoin(R, eq(R.id, V.recordingId))
    .innerJoin(A, eq(A.id, R.assignmentId))
    .innerJoin(schema.user, eq(schema.user.id, R.studentId))
    .leftJoin(schema.piece, eq(schema.piece.id, A.pieceId))
    .where(eq(V.teacherId, teacherId))
    .orderBy(desc(V.createdAt))
    .limit(limit);
}

/** One recording for the teacher's review page (only of their own assignments). */
export async function getRecordingForTeacher(teacherId: string, recordingId: string) {
  const [row] = await db
    .select({ r: R, assignmentId: A.id })
    .from(R)
    .innerJoin(A, eq(A.id, R.assignmentId))
    .where(and(eq(R.id, recordingId), eq(A.teacherId, teacherId)))
    .limit(1);
  if (!row) return null;
  const assignment = await getTeacherAssignment(teacherId, row.assignmentId);
  if (!assignment) return null;
  const recording = assignment.recordings.find((x) => x.id === recordingId)!;
  return { assignment, recording, others: assignment.recordings.filter((x) => x.id !== recordingId) };
}

/** What the "give an assignment" form offers: the teacher's active students, every score and published lesson. */
export async function assignmentFormOptions(teacherId: string) {
  const [students, pieces, lessons] = await Promise.all([
    db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.studentProfile)
      .innerJoin(schema.user, eq(schema.user.id, schema.studentProfile.userId))
      .where(and(eq(schema.studentProfile.teacherId, teacherId), eq(schema.studentProfile.status, "active")))
      .orderBy(asc(schema.user.name)),
    listAllPieces(),
    db
      .select({ id: schema.lesson.id, title: schema.lesson.title, kind: schema.lesson.kind, order: schema.lesson.order, unitOrder: schema.unit.order })
      .from(schema.lesson)
      .leftJoin(schema.unit, eq(schema.unit.id, schema.lesson.unitId))
      .where(eq(schema.lesson.published, true))
      .orderBy(asc(schema.unit.order), asc(schema.lesson.order)),
  ]);
  return {
    students,
    pieces: pieces.map((p) => ({ id: p.id, title: p.title, own: p.createdBy === teacherId, visible: p.visible, stageBpm: p.stageBpm })),
    lessons: lessons.filter((l) => l.kind !== "check").map((l) => ({ id: l.id, label: l.unitOrder ? `${l.unitOrder}.${l.order} ${l.title}` : `★ ${l.title}` })),
  };
}
