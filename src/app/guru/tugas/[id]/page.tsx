import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarClock, CircleCheck, Gauge, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { deleteAssignment, setAssignmentDone } from "@/app/actions/assignments";
import { ActionButton } from "@/components/action-button";
import { Markdown } from "@/components/markdown";
import { RecordingList } from "@/components/recording/recording-list";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { isUuid } from "@/lib/access";
import { getTeacherAssignment } from "@/lib/assignments";
import { formatDay } from "@/lib/dates";
import { ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_TONE } from "@/lib/rubric";
import { requireTeacher } from "@/lib/session";
import { shortLabel } from "@/lib/utils";
import { getT } from "@/i18n/server";

type Props = { params: Promise<{ id: string }> };

async function load(teacherId: string, id: string) {
  return isUuid(id) ? getTeacherAssignment(teacherId, id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const teacher = await requireTeacher();
  const a = await load(teacher.id, (await params).id);
  return { title: a ? `${a.studentName} · ${a.pieceTitle ?? shortLabel(a.instructions ?? "", 30)}` : "-" };
}

export default async function TeacherAssignmentPage({ params }: Props) {
  const teacher = await requireTeacher();
  const t = await getT();
  const a = await load(teacher.id, (await params).id);
  if (!a) notFound();
  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/guru/tugas" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Assignments")}
        </Link>
        <div className="flex flex-wrap gap-2">
          {a.status === "done" ? (
            <ActionButton size="sm" variant="outline" action={setAssignmentDone.bind(null, a.id, false)}>
              <RotateCcw /> {t("Open again")}
            </ActionButton>
          ) : (
            <ActionButton size="sm" variant="outline" action={setAssignmentDone.bind(null, a.id, true)}>
              <CircleCheck /> {t("Mark as done")}
            </ActionButton>
          )}
          <ActionButton size="sm" variant="danger-soft" action={deleteAssignment.bind(null, a.id)} confirm={t("Delete this assignment with all its recordings and reviews?")} redirectTo="/guru/tugas">
            <Trash2 /> {t("Delete")}
          </ActionButton>
        </div>
      </div>
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ASSIGNMENT_STATUS_TONE[a.status]}>{t(ASSIGNMENT_STATUS_LABEL[a.status])}</Badge>
          {a.dueDate && (
            <Badge>
              <CalendarClock className="size-3" /> {t("Due {0}", formatDay(a.dueDate))}
            </Badge>
          )}
          {(a.targetStage || a.targetBpm) && (
            <Badge tone="primary">
              <Gauge className="size-3" /> {[a.targetStage ? t("Stage {0}", a.targetStage) : null, a.targetBpm ? `${a.targetBpm} bpm` : null].filter(Boolean).join(" · ")}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          <Link href={`/guru/siswa/${a.studentId}`} className="hover:text-primary">
            {a.studentName}
          </Link>{" "}
          · {a.pieceTitle ?? a.lesson?.title ?? t("Assignment")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("Given on {0}", formatDay(a.createdAt.toISOString().slice(0, 10)))}</p>
      </header>
      {a.instructions && (
        <section className="rounded-2xl border bg-card p-4 shadow-xs">
          <Markdown>{a.instructions}</Markdown>
        </section>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        {a.pieceSlug && (
          <Link href={`/guru/materi/partitur/${a.pieceSlug}`} className="font-semibold text-primary hover:underline">
            {t("Open the score")}
          </Link>
        )}
        {a.lesson && (
          <Link href={`/guru/materi/pelajaran/${a.lesson.id}/pratinjau`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <BookOpen className="size-4" /> {a.lesson.title}
          </Link>
        )}
      </div>
      <section className="grid gap-3">
        <h2 className="text-lg font-extrabold">{t("Recordings ({0})", a.recordings.length)}</h2>
        {!a.recordings.length ? (
          <EmptyState title={t("No recording yet")}>{t("The student has not sent a recording for this assignment.")}</EmptyState>
        ) : (
          <RecordingList
            recordings={a.recordings}
            actions={(r) => (
              <Button asChild size="sm" variant={r.review ? "outline" : "default"}>
                <Link href={`/guru/penilaian/${r.id}`}>
                  <PencilLine /> {r.review ? t("Change review") : t("Review")}
                </Link>
              </Button>
            )}
          />
        )}
      </section>
    </article>
  );
}
