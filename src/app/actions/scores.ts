"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { docToMusicXml, scoreDocSchema, type ScoreDoc } from "@/lib/score/doc";
import { ScoreError } from "@/lib/score/musicxml";
import { requireTeacher } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { deleteFile, saveFile } from "@/lib/storage";
import { getT } from "@/i18n/server";

/*
 * Pieces the teacher makes in the app (Materi → Partitur): written in the score editor (piece.scoreDoc, the
 * MusicXML is always rebuilt here on the server) or uploaded from MuseScore. Pieces from content/pieces
 * (createdBy = null) cannot be changed here; only the teacher who made a piece can change or delete it.
 */

const MAX_UPLOAD = 3 * 1024 * 1024;
const bpm = z.coerce.number().int().min(20).max(300);

const metaSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    composer: z.string().trim().max(120).optional().transform((v) => v || null),
    stage1: bpm,
    stage2: bpm,
    stage3: bpm,
    copyrightStatus: z.enum(schema.copyrightStatusEnum.enumValues),
    sourceNote: z.string().trim().max(500).optional().transform((v) => v || null),
  })
  .refine((m) => m.stage1 <= m.stage2 && m.stage2 <= m.stage3, { path: ["stage2"], message: "stages" });

export type PieceMeta = z.input<typeof metaSchema>;

async function newSlug(title: string) {
  const base = slugify(title).slice(0, 40) || "partitur";
  for (;;) {
    const slug = `${base}-${randomBytes(2).toString("hex")}`;
    const [taken] = await db.select({ id: schema.piece.id }).from(schema.piece).where(eq(schema.piece.slug, slug)).limit(1);
    if (!taken) return slug;
  }
}

/** A teacher-made piece of this teacher, or null. */
async function ownPiece(teacherId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [p] = await db
    .select()
    .from(schema.piece)
    .where(and(eq(schema.piece.id, id), eq(schema.piece.createdBy, teacherId)))
    .limit(1);
  return p ?? null;
}

async function storeXml(slug: string, data: Buffer, ext: "musicxml" | "mxl") {
  const key = `score/${slug}-${createHash("sha256").update(data).digest("hex").slice(0, 10)}.${ext}`;
  await saveFile(key, data, ext === "mxl" ? "application/vnd.recordare.musicxml" : "application/vnd.recordare.musicxml+xml");
  return key;
}

/** Save a score from the editor (new when id is null). Returns the piece's slug. */
export async function saveScoreDoc(id: string | null, doc: ScoreDoc, meta: PieceMeta): Promise<ActionResult<{ id: string; slug: string }>> {
  const t = await getT();
  const teacher = await requireTeacher();
  const d = scoreDocSchema.safeParse(doc);
  const m = metaSchema.safeParse(meta);
  if (!d.success) return fail(t("The score could not be saved: the notation is not valid."));
  if (!m.success) return fail(m.error.issues.some((i) => i.message === "stages") ? t("Stage tempos must go up: stage 1 ≤ stage 2 ≤ stage 3.") : t("Fill in the title and the tempos."));
  const old = id ? await ownPiece(teacher.id, id) : null;
  if (id && !old) return fail(t("Score not found."));

  let xml: string;
  try {
    xml = docToMusicXml(d.data, { title: m.data.title, composer: m.data.composer, sourceNote: m.data.sourceNote });
  } catch (e) {
    return fail(e instanceof ScoreError ? e.message : t("The score could not be saved: the notation is not valid."));
  }
  const slug = old?.slug ?? (await newSlug(m.data.title));
  const key = await storeXml(slug, Buffer.from(xml), "musicxml");
  const fields = {
    title: m.data.title,
    composer: m.data.composer,
    musicXmlFileKey: key,
    defaultBpm: d.data.tempo,
    stageBpm: { "1": m.data.stage1, "2": m.data.stage2, "3": m.data.stage3 },
    timeSignature: d.data.measures[0]?.time ?? d.data.time,
    copyrightStatus: m.data.copyrightStatus,
    sourceNote: m.data.sourceNote,
    scoreDoc: d.data,
  };
  let pieceId = old?.id;
  if (old) {
    await db.update(schema.piece).set(fields).where(eq(schema.piece.id, old.id));
    if (old.musicXmlFileKey && old.musicXmlFileKey !== key) await deleteFile(old.musicXmlFileKey);
  } else {
    [{ id: pieceId }] = await db.insert(schema.piece).values({ slug, createdBy: teacher.id, ...fields }).returning({ id: schema.piece.id });
  }
  refresh();
  return succeed(t("Score saved."), { id: pieceId!, slug });
}

/**
 * Upload a MusicXML file (.musicxml / .xml, or compressed .mxl) with its details, or (with `id`) change the
 * details of an uploaded piece and optionally replace its file.
 */
export async function uploadScore(id: string | null, _: ActionResult<{ slug: string }>, fd: FormData): Promise<ActionResult<{ slug: string }>> {
  const t = await getT();
  const teacher = await requireTeacher();
  const m = metaSchema.safeParse({
    title: fd.get("title"),
    composer: fd.get("composer") || undefined,
    stage1: fd.get("stage1"),
    stage2: fd.get("stage2"),
    stage3: fd.get("stage3"),
    copyrightStatus: fd.get("copyrightStatus"),
    sourceNote: fd.get("sourceNote") || undefined,
  });
  const defaultBpm = bpm.safeParse(fd.get("defaultBpm"));
  const time = z.string().regex(/^\d{1,2}\/\d{1,2}$/).safeParse(fd.get("timeSignature"));
  if (!m.success || !defaultBpm.success)
    return fail(m.error?.issues.some((i) => i.message === "stages") ? t("Stage tempos must go up: stage 1 ≤ stage 2 ≤ stage 3.") : t("Fill in the title and the tempos."), fd);
  const old = id ? await ownPiece(teacher.id, id) : null;
  if (id && (!old || old.scoreDoc)) return fail(t("Score not found."), fd);

  const file = fd.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!old && !hasFile) return fail(t("Choose a MusicXML file."), fd);
  let key = old?.musicXmlFileKey ?? null;
  const slug = old?.slug ?? (await newSlug(m.data.title));
  if (hasFile) {
    if (file.size > MAX_UPLOAD) return fail(t("The file is too big (max {0} MB).", 3), fd);
    const name = file.name.toLowerCase();
    const data = Buffer.from(await file.arrayBuffer());
    const ext = name.endsWith(".mxl") ? "mxl" : name.endsWith(".musicxml") || name.endsWith(".xml") ? "musicxml" : null;
    const head = data.subarray(0, 4000).toString("utf8");
    const valid = ext === "mxl" ? data[0] === 0x50 && data[1] === 0x4b : ext === "musicxml" && /<score-(partwise|timewise)[\s>]/.test(head);
    if (!ext || !valid) return fail(t("This is not a MusicXML file. In MuseScore use File → Export → MusicXML."), fd);
    key = await storeXml(slug, data, ext);
  }
  const fields = {
    title: m.data.title,
    composer: m.data.composer,
    musicXmlFileKey: key,
    defaultBpm: defaultBpm.data,
    stageBpm: { "1": m.data.stage1, "2": m.data.stage2, "3": m.data.stage3 },
    timeSignature: time.success ? time.data : null,
    copyrightStatus: m.data.copyrightStatus,
    sourceNote: m.data.sourceNote,
  };
  if (old) {
    await db.update(schema.piece).set(fields).where(eq(schema.piece.id, old.id));
    if (old.musicXmlFileKey && old.musicXmlFileKey !== key) await deleteFile(old.musicXmlFileKey);
  } else {
    await db.insert(schema.piece).values({ slug, createdBy: teacher.id, ...fields });
  }
  refresh();
  return succeed(t("Score saved."), { slug });
}

/** Delete a teacher-made piece. Not while a lesson still uses it (students' stages would be lost silently). */
export async function deletePiece(id: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = await ownPiece(teacher.id, id);
  if (!p) return fail(t("Score not found."));
  const B = schema.lessonBlock;
  const [used] = await db
    .select({ id: B.id })
    .from(B)
    .where(and(eq(B.type, "score"), isNotNull(B.data), sql`${B.data}->>'piece' = ${p.slug}`))
    .limit(1);
  if (used) return fail(t("This score is still used in a lesson. Remove it from the lesson first."));
  await db.delete(schema.piece).where(eq(schema.piece.id, p.id));
  if (p.musicXmlFileKey) await deleteFile(p.musicXmlFileKey);
  // No refresh(): the page that called this shows the deleted piece; the button goes to the list instead.
  return succeed(t("Score deleted."));
}
