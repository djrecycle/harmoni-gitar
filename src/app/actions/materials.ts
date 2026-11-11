"use server";

import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { blockDataSchemas, type BlockType } from "@/lib/blocks";
import { requireTeacher } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { ALLOWED_MIME, saveFile } from "@/lib/storage";
import { getT } from "@/i18n/server";

/*
 * Lessons the teacher writes in the app (Materi). Placed in a unit (for every student, in the step-by-step order,
 * after the unit's lessons from the content files) or, without a unit, as extra material for chosen students.
 * Only the teacher who made a lesson can change it; lessons from content/units are changed in the repository.
 */

/** Block types the teacher can add in the app ("check" lessons with Cek Unit stay in the content files). */
export type EditableBlock = { type: BlockType; data: Record<string, unknown> };

const KINDS = ["theory", "technique", "etude", "piece"] as const;

const lessonSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).optional().transform((v) => v || null),
  kind: z.enum(KINDS),
  estimatedMinutes: z.number().int().min(1).max(240).nullable(),
  published: z.boolean(),
  unitId: z.uuid().nullable(),
  blocks: z.array(z.object({ type: z.string(), data: z.record(z.string(), z.unknown()) })).max(60),
  studentIds: z.array(z.string().min(1).max(64)).max(200),
});

export type LessonInput = z.input<typeof lessonSchema>;

async function ownLesson(teacherId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [l] = await db
    .select()
    .from(schema.lesson)
    .where(and(eq(schema.lesson.id, id), eq(schema.lesson.createdBy, teacherId)))
    .limit(1);
  return l ?? null;
}

/** Create (id = null) or update a lesson with its blocks and (for extra material) its students. */
export async function saveLesson(id: string | null, input: LessonInput): Promise<ActionResult<{ id: string }>> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = lessonSchema.safeParse(input);
  if (!p.success) return fail(t("Fill in the title and check the blocks."));
  const v = p.data;

  // Every block must match its type (the same check as the content files).
  const blocks: EditableBlock[] = [];
  for (const [i, b] of v.blocks.entries()) {
    const type = b.type as BlockType;
    const schemaFor = blockDataSchemas[type];
    const r = schemaFor?.safeParse(b.data);
    if (!r?.success) return fail(t("Block {0} is not complete yet.", i + 1));
    blocks.push({ type, data: r.data as Record<string, unknown> });
  }
  // Score blocks must point at an existing piece.
  const slugs = [...new Set(blocks.filter((b) => b.type === "score").map((b) => String(b.data.piece)))];
  if (slugs.length) {
    const found = await db.select({ slug: schema.piece.slug }).from(schema.piece).where(inArray(schema.piece.slug, slugs));
    if (found.length !== slugs.length) return fail(t("A score block points at a score that does not exist."));
  }
  if (v.unitId) {
    const [u] = await db.select({ id: schema.unit.id }).from(schema.unit).where(eq(schema.unit.id, v.unitId)).limit(1);
    if (!u) return fail(t("Unit not found."));
  }
  // Extra material goes only to this teacher's own students.
  const studentIds = v.unitId ? [] : [...new Set(v.studentIds)];
  if (studentIds.length) {
    const own = await db
      .select({ id: schema.studentProfile.userId })
      .from(schema.studentProfile)
      .where(and(eq(schema.studentProfile.teacherId, teacher.id), inArray(schema.studentProfile.userId, studentIds)));
    if (own.length !== studentIds.length) return fail(t("Student not found."));
  }

  const old = id ? await ownLesson(teacher.id, id) : null;
  if (id && !old) return fail(t("Lesson not found."));

  const L = schema.lesson;
  const lessonId = await db.transaction(async (tx) => {
    const sameUnit = old && old.unitId === v.unitId;
    let order = old?.order ?? 0;
    if (!sameUnit) {
      // New place: after everything already in that unit (or among the extra material).
      const [m] = await tx
        .select({ n: max(L.order) })
        .from(L)
        .where(v.unitId ? eq(L.unitId, v.unitId) : isNull(L.unitId));
      order = (m?.n ?? 0) + 1;
    }
    const fields = {
      unitId: v.unitId,
      order,
      title: v.title,
      summary: v.summary,
      kind: v.kind,
      estimatedMinutes: v.estimatedMinutes,
      published: v.published,
    };
    let lid: string;
    if (old) {
      await tx.update(L).set(fields).where(eq(L.id, old.id));
      lid = old.id;
    } else {
      const slug = `${slugify(v.title).slice(0, 40) || "materi"}-${randomBytes(2).toString("hex")}`;
      [{ id: lid }] = await tx.insert(L).values({ ...fields, slug, createdBy: teacher.id }).returning({ id: L.id });
    }
    // Blocks by position, like the seed: a checklist keeps its id (and the students' ticks) while it stays in place.
    const B = schema.lessonBlock;
    for (const [j, b] of blocks.entries()) {
      await tx
        .insert(B)
        .values({ lessonId: lid, order: j + 1, type: b.type, data: b.data })
        .onConflictDoUpdate({ target: [B.lessonId, B.order], set: { type: b.type, data: b.data } });
    }
    await tx.delete(B).where(and(eq(B.lessonId, lid), gt(B.order, blocks.length)));

    const S = schema.lessonStudent;
    const current = await tx.select({ studentId: S.studentId }).from(S).where(eq(S.lessonId, lid));
    const gone = current.map((c) => c.studentId).filter((s) => !studentIds.includes(s));
    if (gone.length) await tx.delete(S).where(and(eq(S.lessonId, lid), inArray(S.studentId, gone)));
    const added = studentIds.filter((s) => !current.some((c) => c.studentId === s));
    if (added.length) await tx.insert(S).values(added.map((studentId) => ({ lessonId: lid, studentId })));
    return lid;
  });
  refresh();
  return succeed(t("Material saved."), { id: lessonId });
}

/** Delete a lesson the teacher made (students' progress on it goes with it). */
export async function deleteLesson(id: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const l = await ownLesson(teacher.id, id);
  if (!l) return fail(t("Lesson not found."));
  await db.delete(schema.lesson).where(eq(schema.lesson.id, l.id));
  return succeed(t("Material deleted."));
}

/** Upload a picture for an image block. Returns its file key. */
export async function uploadLessonImage(fd: FormData): Promise<ActionResult<{ fileKey: string }>> {
  const t = await getT();
  await requireTeacher();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return fail(t("Choose a picture."));
  if (file.size > 3 * 1024 * 1024) return fail(t("The file is too big (max {0} MB).", 3));
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = ALLOWED_MIME[ext];
  if (!mime?.startsWith("image/")) return fail(t("Use a JPG, PNG or WebP picture."));
  const fileKey = `media/lesson/${randomBytes(8).toString("hex")}.${ext}`;
  await saveFile(fileKey, Buffer.from(await file.arrayBuffer()), mime);
  return succeed(undefined, { fileKey });
}
