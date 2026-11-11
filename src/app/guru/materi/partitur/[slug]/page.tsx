import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { deletePiece } from "@/app/actions/scores";
import { ActionButton } from "@/components/action-button";
import { PieceCard } from "@/components/score/piece-card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { getPieceBySlug } from "@/lib/pieces";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireTeacher();
  return { title: (await getPieceBySlug((await params).slug))?.title ?? "-" };
}

/** Teacher's preview of a piece (any copyright status), without stages. Teacher-made pieces can be changed here. */
export default async function PiecePreviewPage({ params }: Props) {
  const teacher = await requireTeacher();
  const t = await getT();
  const slug = (await params).slug;
  const [row] = await db.select({ createdBy: schema.piece.createdBy, scoreDoc: schema.piece.scoreDoc }).from(schema.piece).where(eq(schema.piece.slug, slug)).limit(1);
  const piece = await getPieceBySlug(slug);
  if (!piece || !row) notFound();
  const own = row.createdBy === teacher.id;
  return (
    <div className="mx-auto grid max-w-4xl gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/guru/materi#partitur" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Materials")}
        </Link>
        {own && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/guru/materi/partitur/${slug}/ubah`}>
                <Pencil /> {row.scoreDoc ? t("Edit score") : t("Change")}
              </Link>
            </Button>
            <ActionButton size="sm" variant="danger-soft" action={deletePiece.bind(null, piece.id)} confirm={t("Delete this score?")} redirectTo="/guru/materi#partitur">
              <Trash2 /> {t("Delete")}
            </ActionButton>
          </div>
        )}
      </div>
      {!row.createdBy && <Alert kind="info">{t("This piece comes from the content files in the repository (content/pieces). Change it there and run the seed script.")}</Alert>}
      <PieceCard piece={piece} withStages={false} />
    </div>
  );
}
