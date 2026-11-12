import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { EXTRA_SEGMENT, getExtraLessons, getUnitMap, type MapLesson, type MapUnit } from "./curriculum";

/*
 * Pieces (notation) for students. A student may open a piece when a lesson that is open (or done) for them (in a
 * unit, or extra material given to them) has a `score` block pointing at it, and the piece has a clear copyright status (never "unknown", see content/pieces/README.md).
 * Stages: 1 = Pelan, 2 = Sedang, 3 = Tempo asli. piece_progress.stage is the highest stage reached.
 */

export const VISIBLE_STATUSES = ["public_domain", "own_work", "licensed"] as const;
const isVisible = (s: string) => (VISIBLE_STATUSES as readonly string[]).includes(s);

export type StageBpm = Record<"1" | "2" | "3", number>;

export type PieceProgressView = {
  stage: number;
  bestBpm: number | null;
  stageDates: Partial<Record<"1" | "2" | "3", string>>;
  teacherVerified: boolean;
};

export type PieceView = {
  id: string;
  slug: string;
  title: string;
  composer: string | null;
  fileUrl: string;
  defaultBpm: number;
  stageBpm: StageBpm;
  timeSignature: string | null;
  copyrightStatus: string;
  sourceNote: string | null;
  /** Where it is used first: the lesson the piece belongs to (unitOrder null = extra material, unitSlug "tambahan"). */
  lesson: { unitSlug: string; unitOrder: number | null; slug: string; title: string; kind: MapLesson["kind"] } | null;
  progress: PieceProgressView;
};

const EMPTY_PROGRESS: PieceProgressView = { stage: 0, bestBpm: null, stageDates: {}, teacherVerified: false };

/** Score blocks (piece slugs) per lesson, in block order. */
async function scoreRefs(lessonIds?: string[]) {
  const B = schema.lessonBlock;
  if (lessonIds && !lessonIds.length) return [];
  const rows = await db
    .select({ lessonId: B.lessonId, order: B.order, data: B.data })
    .from(B)
    .where(and(eq(B.type, "score"), lessonIds ? inArray(B.lessonId, lessonIds) : undefined))
    .orderBy(asc(B.order));
  return rows.map((r) => ({ lessonId: r.lessonId, order: r.order, slug: String(r.data?.piece ?? "") })).filter((r) => r.slug);
}

export const pieceFileUrl = (key: string) => `/api/files/${key}`;

/** Bpm targets of a piece, falling back to its default tempo. */
export function stagesOf(p: { stageBpm: StageBpm | null; defaultBpm: number | null }): { defaultBpm: number; stageBpm: StageBpm } {
  const d = p.defaultBpm ?? 80;
  return { defaultBpm: d, stageBpm: p.stageBpm ?? { "1": Math.round(d * 0.6), "2": Math.round(d * 0.8), "3": d } };
}

/** The tempo to aim for now: the next stage not reached yet (stage 3 once everything is reached). */
export function nextTargetBpm(p: { stageBpm: StageBpm }, stage: number) {
  return p.stageBpm[String(Math.min(3, stage + 1)) as "1" | "2" | "3"];
}

function toView(
  p: typeof schema.piece.$inferSelect,
  progress: typeof schema.pieceProgress.$inferSelect | undefined,
  lesson: PieceView["lesson"],
): PieceView {
  const { defaultBpm, stageBpm } = stagesOf(p);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    composer: p.composer,
    fileUrl: pieceFileUrl(p.musicXmlFileKey!),
    defaultBpm,
    stageBpm,
    timeSignature: p.timeSignature,
    copyrightStatus: p.copyrightStatus,
    sourceNote: p.sourceNote,
    lesson,
    progress: progress
      ? { stage: progress.stage, bestBpm: progress.bestBpm, stageDates: progress.stageDates ?? {}, teacherVerified: progress.teacherVerified }
      : EMPTY_PROGRESS,
  };
}

/** Pieces of the given lessons that can be shown (clear copyright status, has notation), in lesson order. */
async function piecesForLessons(map: MapUnit[], extras: MapLesson[], lessonFilter: (state: string) => boolean, studentId: string | null) {
  const extraUnit = { slug: EXTRA_SEGMENT, order: null };
  const lessons = [
    ...map.flatMap((u) => u.lessons.filter((l) => lessonFilter(l.state)).map((l) => ({ u: { slug: u.slug, order: u.order as number | null }, l }))),
    ...extras.map((l) => ({ u: extraUnit, l })),
  ];
  const refs = await scoreRefs(lessons.map((x) => x.l.id));
  const slugs = [...new Set(refs.map((r) => r.slug))];
  if (!slugs.length) return [];
  const [pieces, progress] = await Promise.all([
    db.select().from(schema.piece).where(inArray(schema.piece.slug, slugs)),
    studentId ? db.select().from(schema.pieceProgress).where(eq(schema.pieceProgress.studentId, studentId)) : Promise.resolve([]),
  ]);
  const bySlug = new Map(pieces.filter((p) => isVisible(p.copyrightStatus) && p.musicXmlFileKey).map((p) => [p.slug, p]));
  const progressBy = new Map(progress.map((r) => [r.pieceId, r]));
  const seen = new Set<string>();
  const out: PieceView[] = [];
  for (const { u, l } of lessons) {
    for (const r of refs.filter((x) => x.lessonId === l.id)) {
      const p = bySlug.get(r.slug);
      if (!p || seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push(toView(p, progressBy.get(p.id), { unitSlug: u.slug, unitOrder: u.order, slug: l.slug, title: l.title, kind: l.kind }));
    }
  }
  return out;
}

/** Pieces a student may open now (from lessons that are open or done), with their progress. */
export async function getAvailablePieces(studentId: string, map?: MapUnit[], extras?: MapLesson[]): Promise<PieceView[]> {
  const [m, x] = await Promise.all([map ?? getUnitMap(studentId), extras ?? getExtraLessons(studentId)]);
  const fromLessons = await piecesForLessons(m, x, (s) => s !== "locked", studentId);
  // A piece the teacher gave as an assignment is open too, even before its lesson (lesson = null).
  const assigned = await db
    .select({ p: schema.piece })
    .from(schema.assignment)
    .innerJoin(schema.piece, eq(schema.piece.id, schema.assignment.pieceId))
    .where(eq(schema.assignment.studentId, studentId));
  const extra = assigned.map((r) => r.p).filter((p, i, all) => isVisible(p.copyrightStatus) && p.musicXmlFileKey && !fromLessons.some((f) => f.id === p.id) && all.findIndex((q) => q.id === p.id) === i);
  if (!extra.length) return fromLessons;
  const progress = await db
    .select()
    .from(schema.pieceProgress)
    .where(and(eq(schema.pieceProgress.studentId, studentId), inArray(schema.pieceProgress.pieceId, extra.map((p) => p.id))));
  return [...fromLessons, ...extra.map((p) => toView(p, progress.find((r) => r.pieceId === p.id), null))];
}

/** One piece by slug, if this student may open it. */
export async function getPieceForStudent(studentId: string, slug: string) {
  return (await getAvailablePieces(studentId)).find((p) => p.slug === slug) ?? null;
}

/** All pieces with where they are used, for the teacher (including hidden ones, to show why they are hidden). */
export async function listAllPieces() {
  const [pieces, refs] = await Promise.all([db.select().from(schema.piece).orderBy(asc(schema.piece.title)), scoreRefs()]);
  return pieces.map((p) => ({ ...p, visible: isVisible(p.copyrightStatus) && Boolean(p.musicXmlFileKey), usedIn: refs.filter((r) => r.slug === p.slug).length }));
}

/** One piece by slug for the teacher's preview (any copyright status), without student progress. */
export async function getPieceBySlug(slug: string): Promise<PieceView | null> {
  const [p] = await db.select().from(schema.piece).where(eq(schema.piece.slug, slug)).limit(1);
  return p?.musicXmlFileKey ? toView(p, undefined, null) : null;
}
