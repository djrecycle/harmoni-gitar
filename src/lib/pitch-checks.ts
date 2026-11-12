import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export type PitchCheckRow = {
  id: string;
  pieceId: string;
  pieceTitle: string;
  bpm: number;
  notesRight: number;
  notesTotal: number;
  score: number;
  loopFrom: number | null;
  loopTo: number | null;
  at: Date;
};

/** A student's latest "Check my notes" runs, newest first (for the teacher). */
export async function listPitchChecks(studentId: string, limit = 20): Promise<PitchCheckRow[]> {
  const R = schema.pitchCheckRun;
  const rows = await db
    .select({
      id: R.id,
      pieceId: R.pieceId,
      pieceTitle: schema.piece.title,
      bpm: R.bpm,
      notesRight: R.notesRight,
      notesTotal: R.notesTotal,
      score: R.score,
      loopFrom: R.loopFrom,
      loopTo: R.loopTo,
      at: R.updatedAt,
    })
    .from(R)
    .innerJoin(schema.piece, eq(schema.piece.id, R.pieceId))
    .where(eq(R.studentId, studentId))
    .orderBy(desc(R.updatedAt))
    .limit(limit);
  return rows;
}
