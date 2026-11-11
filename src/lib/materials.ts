import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { listAllPieces } from "./pieces";

/** What the lesson editor offers: units to place a lesson in, the teacher's students, and every score. */
export async function lessonEditorOptions(teacherId: string) {
  const [units, students, pieces] = await Promise.all([
    db.select({ id: schema.unit.id, order: schema.unit.order, title: schema.unit.title }).from(schema.unit).orderBy(asc(schema.unit.order)),
    db
      .select({ id: schema.user.id, name: schema.user.name, status: schema.studentProfile.status })
      .from(schema.studentProfile)
      .innerJoin(schema.user, eq(schema.user.id, schema.studentProfile.userId))
      .where(eq(schema.studentProfile.teacherId, teacherId))
      .orderBy(asc(schema.user.name)),
    listAllPieces(),
  ]);
  return {
    units,
    students: students.map((s) => ({ id: s.id, name: s.name, active: s.status === "active" })),
    pieces: pieces.map((p) => ({ slug: p.slug, title: p.title, visible: p.visible, own: p.createdBy === teacherId })),
  };
}

/** A lesson this teacher made, with its blocks and students. */
export async function getOwnLesson(teacherId: string, id: string) {
  const [l] = await db
    .select()
    .from(schema.lesson)
    .where(and(eq(schema.lesson.id, id), eq(schema.lesson.createdBy, teacherId)))
    .limit(1);
  if (!l) return null;
  const [blocks, students] = await Promise.all([
    db.select().from(schema.lessonBlock).where(eq(schema.lessonBlock.lessonId, l.id)).orderBy(asc(schema.lessonBlock.order)),
    db.select({ id: schema.lessonStudent.studentId }).from(schema.lessonStudent).where(eq(schema.lessonStudent.lessonId, l.id)),
  ]);
  return { ...l, blocks, studentIds: students.map((s) => s.id) };
}
