import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ScoreEditor } from "@/components/score/editor/score-editor";
import { UploadScoreForm } from "@/components/score/upload-form";
import { db, schema } from "@/db";
import { stagesOf } from "@/lib/pieces";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ slug: string }> };

/** A piece this teacher made in the app (pieces from content/pieces are changed in the repository). */
async function ownPiece(teacherId: string, slug: string) {
  const [p] = await db
    .select()
    .from(schema.piece)
    .where(and(eq(schema.piece.slug, slug), eq(schema.piece.createdBy, teacherId)))
    .limit(1);
  return p ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const teacher = await requireTeacher();
  const t = await getT();
  const p = await ownPiece(teacher.id, (await params).slug);
  return { title: p ? `${t("Edit")}: ${p.title}` : "-" };
}

export default async function EditScorePage({ params }: Props) {
  const teacher = await requireTeacher();
  const p = await ownPiece(teacher.id, (await params).slug);
  if (!p) notFound();
  const { defaultBpm, stageBpm } = stagesOf(p);
  const meta = {
    title: p.title,
    composer: p.composer ?? "",
    stage1: stageBpm["1"],
    stage2: stageBpm["2"],
    stage3: stageBpm["3"],
    copyrightStatus: p.copyrightStatus,
    sourceNote: p.sourceNote ?? "",
  };
  if (p.scoreDoc) return <ScoreEditor pieceId={p.id} initialDoc={p.scoreDoc} initialMeta={meta} />;
  return <UploadScoreForm piece={{ id: p.id, slug: p.slug, defaultBpm, timeSignature: p.timeSignature ?? "", ...meta }} />;
}
