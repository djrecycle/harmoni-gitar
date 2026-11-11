"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { isTeacherOfStudent } from "@/lib/access";
import { getAvailablePieces } from "@/lib/pieces";
import { requireStudent, requireTeacher } from "@/lib/session";
import { today } from "@/lib/utils";
import { getT } from "@/i18n/server";

type Stage = "1" | "2" | "3";
const stageNum = z.number().int().min(0).max(3);

/**
 * Stage dates after reaching (or un-reaching) a stage. Reaching stage n also fills in any lower stage without a
 * date; un-reaching stage n removes n and everything above it.
 */
function nextDates(dates: Partial<Record<Stage, string>>, stage: number) {
  const out: Partial<Record<Stage, string>> = {};
  for (const k of ["1", "2", "3"] as Stage[]) if (Number(k) <= stage) out[k] = dates[k] ?? today();
  return out;
}

async function saveStage(studentId: string, pieceId: string, stage: number, verified?: boolean) {
  const P = schema.pieceProgress;
  const [row] = await db.select().from(P).where(and(eq(P.studentId, studentId), eq(P.pieceId, pieceId))).limit(1);
  const stageDates = nextDates(row?.stageDates ?? {}, stage);
  // A new stage needs the teacher's check again, unless the teacher is the one setting it.
  const teacherVerified = verified ?? (row && row.stage === stage ? row.teacherVerified : false);
  await db
    .insert(P)
    .values({ studentId, pieceId, stage, stageDates, teacherVerified })
    .onConflictDoUpdate({ target: [P.studentId, P.pieceId], set: { stage, stageDates, teacherVerified } });
}

/** Student ticks (or unticks) "Tahap n reached" for a piece they may open. */
export async function setPieceStage(pieceId: string, stage: number, reached: boolean): Promise<ActionResult> {
  const t = await getT();
  const student = await requireStudent();
  if (!z.uuid().safeParse(pieceId).success || !stageNum.safeParse(stage).success || stage < 1) return fail(t("Invalid data"));
  const piece = (await getAvailablePieces(student.id)).find((p) => p.id === pieceId);
  if (!piece) return fail(t("This lesson is still locked."));
  await saveStage(student.id, pieceId, reached ? Math.max(stage, piece.progress.stage) : stage - 1);
  refresh();
  return succeed(reached ? t("Stage {0} reached. Well done!", stage) : undefined);
}

/** Teacher sets a student's stage for a piece and whether they checked it. */
export async function setPieceProgressByTeacher(studentId: string, pieceId: string, stage: number, verified: boolean): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  if (!z.string().min(1).max(64).safeParse(studentId).success || !z.uuid().safeParse(pieceId).success || !stageNum.safeParse(stage).success)
    return fail(t("Invalid data"));
  if (!(await isTeacherOfStudent(teacher.id, studentId))) return fail(t("Student not found."));
  const [piece] = await db.select({ id: schema.piece.id }).from(schema.piece).where(eq(schema.piece.id, pieceId)).limit(1);
  if (!piece) return fail(t("Invalid data"));
  await saveStage(studentId, pieceId, stage, stage > 0 && verified);
  refresh();
  return succeed(t("Saved."));
}
