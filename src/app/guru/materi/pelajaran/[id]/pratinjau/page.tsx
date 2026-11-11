import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Clock, Pencil } from "lucide-react";
import { LessonBlocks } from "@/components/lesson/blocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { LESSON_KIND_LABEL } from "@/lib/labels";
import { getPieceBySlug, type PieceView } from "@/lib/pieces";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [l] = await db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).limit(1);
  return l ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireTeacher();
  return { title: (await load((await params).id))?.title ?? "-" };
}

/** The teacher's preview of any lesson, as a student sees it (checklists read-only, scores without stages). */
export default async function LessonPreviewPage({ params }: Props) {
  const teacher = await requireTeacher();
  const t = await getT();
  const lesson = await load((await params).id);
  if (!lesson) notFound();
  const blocks = await db.select().from(schema.lessonBlock).where(eq(schema.lessonBlock.lessonId, lesson.id)).orderBy(asc(schema.lessonBlock.order));
  const slugs = [...new Set(blocks.filter((b) => b.type === "score").map((b) => String(b.data.piece ?? "")))];
  const pieces = new Map<string, PieceView>();
  for (const s of slugs) {
    const p = await getPieceBySlug(s);
    if (p) pieces.set(s, p);
  }
  const own = lesson.createdBy === teacher.id;
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/guru/materi" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Materials")}
        </Link>
        {own && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/guru/materi/pelajaran/${lesson.id}`}>
              <Pencil /> {t("Edit")}
            </Link>
          </Button>
        )}
      </div>
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="primary">{t(LESSON_KIND_LABEL[lesson.kind])}</Badge>
          {lesson.estimatedMinutes && (
            <Badge>
              <Clock className="size-3" /> {lesson.estimatedMinutes} {t("min")}
            </Badge>
          )}
          {!lesson.published && <Badge tone="warning">{t("Not published")}</Badge>}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{lesson.title}</h1>
        {lesson.summary && <p className="mt-2 text-muted-foreground">{lesson.summary}</p>}
      </header>
      <LessonBlocks blocks={blocks} checklists={new Map()} pieces={pieces} readOnly />
    </article>
  );
}
