import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, CircleCheck, Clock, Lock, Timer } from "lucide-react";
import { LessonBlocks } from "@/components/lesson/blocks";
import { CompleteLessonButton } from "@/components/lesson/complete-button";
import { SelfCheck } from "@/components/lesson/self-check";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { checklistStates, getUnitCheck, getUnitMap, markLessonOpened } from "@/lib/curriculum";
import { LESSON_KIND_LABEL } from "@/lib/labels";
import { requireStudent } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ unit: string; pelajaran: string }> };

async function find(studentId: string, unitSlug: string, lessonSlug: string) {
  const map = await getUnitMap(studentId);
  const unit = map.find((u) => u.slug === unitSlug);
  const idx = unit?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!unit || idx < 0) return null;
  return { map, unit, lesson: unit.lessons[idx], prev: unit.lessons[idx - 1], next: unit.lessons[idx + 1] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const student = await requireStudent();
  const { unit, pelajaran } = await params;
  const f = await find(student.id, unit, pelajaran);
  return { title: f?.lesson.title ?? "-" };
}

export default async function LessonPage({ params }: Props) {
  const student = await requireStudent();
  const t = await getT();
  const { unit: unitSlug, pelajaran } = await params;
  const f = await find(student.id, unitSlug, pelajaran);
  if (!f) notFound();
  const { unit, lesson, prev, next } = f;

  if (lesson.state === "locked") {
    return (
      <EmptyState
        icon={<Lock />}
        title={t("This lesson is still locked")}
        action={
          <Button asChild variant="outline">
            <Link href="/siswa/belajar">{t("Back to the learning map")}</Link>
          </Button>
        }
      >
        {unit.unlocked ? t("Finish the lesson before it first.") : t("This unit opens after your teacher approves the unit check of the unit before.")}
      </EmptyState>
    );
  }

  await markLessonOpened(student.id, lesson.id);
  const blocks = await db.select().from(schema.lessonBlock).where(eq(schema.lessonBlock.lessonId, lesson.id)).orderBy(asc(schema.lessonBlock.order));
  const checklists = await checklistStates(
    student.id,
    blocks.filter((b) => b.type === "checklist").map((b) => b.id),
  );
  const checkItems = lesson.kind === "check" ? await getUnitCheck(student.id, unit.id) : [];
  const nextUnit = f.map.find((u) => u.order > unit.order);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/siswa/belajar" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("Unit {0}", unit.order)} · {unit.title}
      </Link>
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="primary">{t(LESSON_KIND_LABEL[lesson.kind])}</Badge>
          {lesson.estimatedMinutes && (
            <Badge>
              <Clock className="size-3" /> {lesson.estimatedMinutes} {t("min")}
            </Badge>
          )}
          {lesson.state === "done" && (
            <Badge tone="success">
              <CircleCheck className="size-3" /> {t("Done {0}", formatDate(lesson.doneAt))}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{lesson.title}</h1>
        {lesson.summary && <p className="mt-2 text-muted-foreground">{lesson.summary}</p>}
      </header>

      <LessonBlocks blocks={blocks} checklists={checklists} />

      {lesson.kind === "check" && (
        <section className="mt-6 grid gap-3">
          <h2 className="text-lg font-extrabold">{t("How ready are you?")}</h2>
          <p className="text-sm text-muted-foreground">{t("Be honest: pick Not yet, Almost, or Got it for each skill. Your teacher checks it with you and then opens the next unit.")}</p>
          <SelfCheck items={checkItems} />
          {lesson.state === "done" && nextUnit && !nextUnit.unlocked && <Alert kind="info">{t("Sent! Your teacher will check it with you and open {0}.", nextUnit.title)}</Alert>}
        </section>
      )}

      <footer className="mt-8 grid gap-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CompleteLessonButton lessonId={lesson.id} done={lesson.state === "done"} />
          <Button asChild variant="outline">
            <Link href="/siswa/latihan">
              <Timer /> {t("Practise now")}
            </Link>
          </Button>
        </div>
        <div className="flex justify-between gap-2 text-sm font-semibold">
          {prev ? (
            <Link href={`/siswa/belajar/${unit.slug}/${prev.slug}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && next.state !== "locked" && (
            <Link href={`/siswa/belajar/${unit.slug}/${next.slug}`} className="inline-flex items-center gap-1 text-right text-primary hover:underline">
              {next.title} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </footer>
    </article>
  );
}
