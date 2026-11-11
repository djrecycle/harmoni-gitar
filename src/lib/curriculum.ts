import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/*
 * Step-by-step unlocking (RENCANA_TEKNIS 5.3):
 *  - The first unit is always open. A later unit opens when the teacher approves the Cek Unit of the unit
 *    before it, or opens it by hand (both = a `unit_unlock` row).
 *  - Inside an open unit, the first published lesson is open; each next lesson opens once the one before is done.
 * Only "done" (and "open" with its openedAt) are stored in lesson_progress; "locked" is always computed.
 */

export type LessonState = "locked" | "open" | "done";

export type MapLesson = {
  id: string;
  slug: string;
  title: string;
  kind: (typeof schema.lessonKindEnum.enumValues)[number];
  summary: string | null;
  estimatedMinutes: number | null;
  order: number;
  state: LessonState;
  doneAt: Date | null;
};

export type MapUnit = {
  id: string;
  slug: string;
  order: number;
  title: string;
  color: string | null;
  description: string | null;
  unlocked: boolean;
  unlockedAt: Date | null;
  /** First unit = open from the start (no unlock row). */
  openByDefault: boolean;
  lessons: MapLesson[];
  done: number;
};

/** All units with each published lesson's state for one student. */
export async function getUnitMap(studentId: string): Promise<MapUnit[]> {
  const S = schema;
  const [units, lessons, progress, unlocks] = await Promise.all([
    db.select().from(S.unit).orderBy(asc(S.unit.order)),
    db
      .select({
        id: S.lesson.id,
        unitId: S.lesson.unitId,
        slug: S.lesson.slug,
        title: S.lesson.title,
        kind: S.lesson.kind,
        summary: S.lesson.summary,
        estimatedMinutes: S.lesson.estimatedMinutes,
        order: S.lesson.order,
      })
      .from(S.lesson)
      .where(eq(S.lesson.published, true))
      .orderBy(asc(S.lesson.order)),
    db.select().from(S.lessonProgress).where(eq(S.lessonProgress.studentId, studentId)),
    db.select().from(S.unitUnlock).where(eq(S.unitUnlock.studentId, studentId)),
  ]);
  const progressBy = new Map(progress.map((p) => [p.lessonId, p]));
  const unlockBy = new Map(unlocks.map((u) => [u.unitId, u]));

  return units.map((u, i) => {
    const openByDefault = i === 0;
    const unlocked = openByDefault || unlockBy.has(u.id);
    let prevDone = true;
    const ls: MapLesson[] = lessons
      .filter((l) => l.unitId === u.id)
      .map((l) => {
        const p = progressBy.get(l.id);
        const state: LessonState = p?.status === "done" ? "done" : unlocked && prevDone ? "open" : "locked";
        prevDone = state === "done";
        return { ...l, state, doneAt: p?.status === "done" ? p.doneAt : null };
      });
    return {
      id: u.id,
      slug: u.slug,
      order: u.order,
      title: u.title,
      color: u.color,
      description: u.description,
      unlocked,
      unlockedAt: unlockBy.get(u.id)?.unlockedAt ?? null,
      openByDefault,
      lessons: ls,
      done: ls.filter((l) => l.state === "done").length,
    };
  });
}

/** The lesson the student should do next (first open lesson in an unlocked unit), if any. */
export function nextLesson(map: MapUnit[]): { unit: MapUnit; lesson: MapLesson } | null {
  for (const unit of map) {
    if (!unit.unlocked) continue;
    const lesson = unit.lessons.find((l) => l.state === "open");
    if (lesson) return { unit, lesson };
  }
  return null;
}

/** Cek Unit items of a unit with this student's self and teacher levels. */
export async function getUnitCheck(studentId: string, unitId: string) {
  const S = schema;
  const items = await db.select().from(S.unitCheckItem).where(eq(S.unitCheckItem.unitId, unitId)).orderBy(asc(S.unitCheckItem.order));
  const checks = items.length
    ? await db
        .select()
        .from(S.unitCheck)
        .where(and(eq(S.unitCheck.studentId, studentId), inArray(S.unitCheck.unitCheckItemId, items.map((i) => i.id))))
    : [];
  const by = new Map(checks.map((c) => [c.unitCheckItemId, c]));
  return items.map((i) => ({
    id: i.id,
    order: i.order,
    text: i.text,
    selfLevel: by.get(i.id)?.selfLevel ?? null,
    teacherLevel: by.get(i.id)?.teacherLevel ?? null,
  }));
}

/** Record the first time a student opens a lesson (called while rendering the lesson page; never an action). */
export async function markLessonOpened(studentId: string, lessonId: string) {
  const P = schema.lessonProgress;
  await db.insert(P).values({ studentId, lessonId, status: "open", openedAt: new Date() }).onConflictDoNothing();
}

/** Ticked checklist items per block, for the lesson page. */
export async function checklistStates(studentId: string, blockIds: string[]) {
  if (!blockIds.length) return new Map<string, number[]>();
  const S = schema.checklistState;
  const rows = await db.select().from(S).where(and(eq(S.studentId, studentId), inArray(S.lessonBlockId, blockIds)));
  return new Map(rows.map((r) => [r.lessonBlockId, r.checkedItems]));
}
