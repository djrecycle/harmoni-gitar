"use server";

import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { getAvailablePieces } from "@/lib/pieces";
import { MIN_CHECK_NOTES, pitchScore } from "@/lib/pitch-score";
import { requireStudent } from "@/lib/session";
import { getT } from "@/i18n/server";

const bar = z.number().int().min(1).max(2000).nullable();
const runSchema = z
  .object({
    /** Made by the client when a run starts: pausing and continuing updates the same run. */
    id: z.uuid(),
    pieceId: z.uuid(),
    bpm: z.number().int().min(20).max(400),
    right: z.number().int().min(0).max(10_000),
    total: z.number().int().min(MIN_CHECK_NOTES).max(10_000),
    loopFrom: bar,
    loopTo: bar,
  })
  .refine((v) => v.right <= v.total, "right <= total");

export type PitchCheckInput = z.input<typeof runSchema>;

/** Save (or update) a "Check my notes" run of the student. Returns its score and the student's best on this piece. */
export async function savePitchCheck(input: PitchCheckInput): Promise<ActionResult<{ score: number; best: number }>> {
  const t = await getT();
  const student = await requireStudent();
  const p = runSchema.safeParse(input);
  if (!p.success) return fail(t("The score could not be saved."));
  const v = p.data;
  if (!(await getAvailablePieces(student.id)).some((x) => x.id === v.pieceId)) return fail(t("Piece not found."));

  const R = schema.pitchCheckRun;
  const score = pitchScore(v.right, v.total);
  const fields = { bpm: v.bpm, notesRight: v.right, notesTotal: v.total, score, loopFrom: v.loopFrom, loopTo: v.loopTo };
  // The id comes from the browser: only the student's own run may be updated.
  await db
    .insert(R)
    .values({ id: v.id, studentId: student.id, pieceId: v.pieceId, ...fields })
    .onConflictDoUpdate({ target: R.id, set: fields, setWhere: and(eq(R.studentId, student.id), eq(R.pieceId, v.pieceId)) });
  const [b] = await db
    .select({ best: max(R.score) })
    .from(R)
    .where(and(eq(R.studentId, student.id), eq(R.pieceId, v.pieceId)));
  return succeed(undefined, { score, best: b?.best ?? score });
}
