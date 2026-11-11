"use server";

import { and, asc, eq, gt, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { isTeacherOfStudent } from "@/lib/access";
import { parseBlock } from "@/lib/blocks";
import { getUnitCheck, getUnitMap } from "@/lib/curriculum";
import { CHECK_LEVELS } from "@/lib/labels";
import { requireStudent, requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

const uuid = z.uuid();

/** The lesson and its state for this student, or null when it is not published / not theirs to open. */
async function lessonFor(studentId: string, lessonId: string) {
  if (!uuid.safeParse(lessonId).success) return null;
  const map = await getUnitMap(studentId);
  for (const unit of map) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { unit, lesson, map };
  }
  return null;
}

/* ------------------------------ Student ------------------------------ */

/** Tick or untick one checklist item. */
export async function toggleChecklistItem(blockId: string, index: number, checked: boolean): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  if (!uuid.safeParse(blockId).success || !Number.isInteger(index) || index < 0) return fail(t("Invalid data"));
  const [block] = await db.select().from(schema.lessonBlock).where(eq(schema.lessonBlock.id, blockId)).limit(1);
  const data = block?.type === "checklist" ? parseBlock("checklist", block.data) : null;
  if (!block || !data || index >= data.items.length) return fail(t("Invalid data"));
  const found = await lessonFor(student.id, block.lessonId);
  if (!found || found.lesson.state === "locked") return fail(t("This lesson is still locked."));

  const S = schema.checklistState;
  const [row] = await db.select().from(S).where(and(eq(S.studentId, student.id), eq(S.lessonBlockId, blockId))).limit(1);
  const set = new Set(row?.checkedItems ?? []);
  if (checked) set.add(index);
  else set.delete(index);
  const checkedItems = [...set].filter((i) => i < data.items.length).sort((a, b) => a - b);
  await db
    .insert(S)
    .values({ studentId: student.id, lessonBlockId: blockId, checkedItems })
    .onConflictDoUpdate({ target: [S.studentId, S.lessonBlockId], set: { checkedItems } });
  return succeed();
}

/** Save the student's own level for one Cek Unit item. */
export async function setSelfLevel(itemId: string, level: string): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  const lv = z.enum(CHECK_LEVELS).safeParse(level);
  if (!uuid.safeParse(itemId).success || !lv.success) return fail(t("Invalid data"));
  const [item] = await db.select().from(schema.unitCheckItem).where(eq(schema.unitCheckItem.id, itemId)).limit(1);
  if (!item) return fail(t("Invalid data"));
  const map = await getUnitMap(student.id);
  const unit = map.find((u) => u.id === item.unitId);
  const checkLesson = unit?.lessons.find((l) => l.kind === "check");
  if (!unit?.unlocked || !checkLesson || checkLesson.state === "locked") return fail(t("This lesson is still locked."));

  const U = schema.unitCheck;
  await db
    .insert(U)
    .values({ studentId: student.id, unitCheckItemId: itemId, selfLevel: lv.data })
    .onConflictDoUpdate({ target: [U.studentId, U.unitCheckItemId], set: { selfLevel: lv.data } });
  refresh();
  return succeed();
}

/** Mark an open lesson as done. A Cek Unit lesson needs every item filled in first. */
export async function completeLesson(lessonId: string): Promise<ActionResult<{ next: string | null }>> {
  const t = await getT();
  const student = await requireStudent();
  const found = await lessonFor(student.id, lessonId);
  if (!found || found.lesson.state === "locked") return fail(t("This lesson is still locked."));
  const { unit, lesson } = found;

  if (lesson.kind === "check") {
    const items = await getUnitCheck(student.id, unit.id);
    if (items.some((i) => !i.selfLevel)) return fail(t("Fill in every skill first (Not yet / Almost / Got it)."));
  }

  const P = schema.lessonProgress;
  await db
    .insert(P)
    .values({ studentId: student.id, lessonId, status: "done", openedAt: new Date(), doneAt: new Date() })
    .onConflictDoUpdate({ target: [P.studentId, P.lessonId], set: { status: "done", doneAt: sql`coalesce(${P.doneAt}, now())` } });

  const idx = unit.lessons.findIndex((l) => l.id === lessonId);
  const next = unit.lessons[idx + 1];
  refresh();
  return succeed(t("Lesson done!"), { next: next ? `/siswa/belajar/${unit.slug}/${next.slug}` : null });
}

/* ------------------------------ Teacher ------------------------------ */

async function teacherOf(studentId: string) {
  const teacher = await requireTeacher();
  if (!z.string().min(1).max(64).safeParse(studentId).success) return null;
  return (await isTeacherOfStudent(teacher.id, studentId)) ? teacher : null;
}

/** Save the teacher's levels for a unit's Cek Unit (form fields `level-<itemId>`). */
export async function saveTeacherLevels(studentId: string, unitId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const teacher = await teacherOf(studentId);
  if (!teacher || !uuid.safeParse(unitId).success) return fail(t("Student not found."));
  const items = await db.select({ id: schema.unitCheckItem.id }).from(schema.unitCheckItem).where(eq(schema.unitCheckItem.unitId, unitId));
  const U = schema.unitCheck;
  await db.transaction(async (tx) => {
    for (const { id } of items) {
      const raw = fd.get(`level-${id}`);
      const lv = raw === "" || raw == null ? null : z.enum(CHECK_LEVELS).safeParse(raw).data ?? null;
      await tx
        .insert(U)
        .values({ studentId, unitCheckItemId: id, teacherLevel: lv })
        .onConflictDoUpdate({ target: [U.studentId, U.unitCheckItemId], set: { teacherLevel: lv } });
    }
  });
  refresh();
  return succeed(t("Teacher assessment saved."));
}

/** Approve a unit's Cek Unit: opens the next unit for the student and makes it their current unit. */
export async function approveUnit(studentId: string, unitId: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await teacherOf(studentId);
  if (!teacher || !uuid.safeParse(unitId).success) return fail(t("Student not found."));
  const [unit] = await db.select().from(schema.unit).where(eq(schema.unit.id, unitId)).limit(1);
  if (!unit) return fail(t("Unit not found."));
  const [next] = await db.select().from(schema.unit).where(gt(schema.unit.order, unit.order)).orderBy(asc(schema.unit.order)).limit(1);
  if (!next) return fail(t("This is the last unit."));
  await openUnit(studentId, next.id, teacher.id);
  refresh();
  return succeed(t("Approved. {0} is now open.", next.title));
}

/** Open (or close again) a unit by hand. The first unit is always open and cannot be closed. */
export async function setUnitOpen(studentId: string, unitId: string, open: boolean): Promise<ActionResult> {
  const t = await getT();
  const teacher = await teacherOf(studentId);
  if (!teacher || !uuid.safeParse(unitId).success) return fail(t("Student not found."));
  if (open) {
    await openUnit(studentId, unitId, teacher.id);
  } else {
    await db.delete(schema.unitUnlock).where(and(eq(schema.unitUnlock.studentId, studentId), eq(schema.unitUnlock.unitId, unitId)));
    // Their current unit goes back to the highest unit that is still open.
    const map = await getUnitMap(studentId);
    const current = [...map].reverse().find((u) => u.unlocked);
    await db.update(schema.studentProfile).set({ currentUnitId: current?.id ?? null }).where(eq(schema.studentProfile.userId, studentId));
  }
  refresh();
  return succeed(open ? t("Unit opened.") : t("Unit closed."));
}

async function openUnit(studentId: string, unitId: string, teacherId: string) {
  await db.insert(schema.unitUnlock).values({ studentId, unitId, unlockedBy: teacherId }).onConflictDoNothing();
  // The current unit is the highest open one.
  const map = await getUnitMap(studentId);
  const current = [...map].reverse().find((u) => u.unlocked);
  await db.update(schema.studentProfile).set({ currentUnitId: current?.id ?? unitId }).where(eq(schema.studentProfile.userId, studentId));
}
