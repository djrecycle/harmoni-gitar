import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "./utils";

type Stage = "1" | "2" | "3";

/**
 * Stage dates after reaching (or un-reaching) a stage. Reaching stage n also fills in any lower stage without a
 * date; un-reaching stage n removes n and everything above it.
 */
function nextDates(dates: Partial<Record<Stage, string>>, stage: number) {
  const out: Partial<Record<Stage, string>> = {};
  for (const k of ["1", "2", "3"] as Stage[]) if (Number(k) <= stage) out[k] = dates[k] ?? today();
  return out;
}

/**
 * Save a student's stage (0–3) for a piece. `verified` = the teacher set it (and checked it); without it a new
 * stage needs the teacher's check again.
 */
export async function saveStage(studentId: string, pieceId: string, stage: number, verified?: boolean) {
  const P = schema.pieceProgress;
  const [row] = await db.select().from(P).where(and(eq(P.studentId, studentId), eq(P.pieceId, pieceId))).limit(1);
  const stageDates = nextDates(row?.stageDates ?? {}, stage);
  const teacherVerified = verified ?? (row && row.stage === stage ? row.teacherVerified : false);
  await db
    .insert(P)
    .values({ studentId, pieceId, stage, stageDates, teacherVerified })
    .onConflictDoUpdate({ target: [P.studentId, P.pieceId], set: { stage, stageDates, teacherVerified } });
}

/** The current stage of a student for a piece (0 when not started). */
export async function currentStage(studentId: string, pieceId: string) {
  const P = schema.pieceProgress;
  const [row] = await db.select({ stage: P.stage }).from(P).where(and(eq(P.studentId, studentId), eq(P.pieceId, pieceId))).limit(1);
  return row?.stage ?? 0;
}
