import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { PieceCard } from "@/components/score/piece-card";
import { getPieceForStudent } from "@/lib/pieces";
import { requireStudent } from "@/lib/session";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const student = await requireStudent();
  const p = await getPieceForStudent(student.id, (await params).slug);
  return { title: p?.title ?? "-" };
}

export default async function PiecePage({ params }: Props) {
  const student = await requireStudent();
  const t = await getT();
  const piece = await getPieceForStudent(student.id, (await params).slug);
  if (!piece) notFound();
  return (
    <div className="mx-auto grid max-w-4xl gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/siswa/karya" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Pieces")}
        </Link>
        {piece.lesson && (
          <Link href={`/siswa/belajar/${piece.lesson.unitSlug}/${piece.lesson.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <BookOpen className="size-4" /> {piece.lesson.title}
          </Link>
        )}
      </div>
      <PieceCard piece={piece} />
    </div>
  );
}
