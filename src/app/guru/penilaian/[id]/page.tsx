import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardList, Gauge } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { RecordingList } from "@/components/recording/recording-list";
import { Badge } from "@/components/ui/misc";
import { isUuid } from "@/lib/access";
import { getRecordingForTeacher, reviewQueue } from "@/lib/assignments";
import { formatDay } from "@/lib/dates";
import { markReadByLink } from "@/lib/notifications";
import { requireTeacher } from "@/lib/session";
import { formatDateTime, formatSeconds } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { ReviewForm } from "./review-form";

type Props = { params: Promise<{ id: string }> };

async function load(teacherId: string, id: string) {
  return isUuid(id) ? getRecordingForTeacher(teacherId, id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const teacher = await requireTeacher();
  const t = await getT();
  const r = await load(teacher.id, (await params).id);
  return { title: r ? `${t("Review")}: ${r.assignment.studentName}` : "-" };
}

export default async function ReviewPage({ params }: Props) {
  const teacher = await requireTeacher();
  const t = await getT();
  const id = (await params).id;
  const [found, queue] = await Promise.all([load(teacher.id, id), reviewQueue(teacher.id)]);
  if (!found) notFound();
  await markReadByLink(teacher.id, `/guru/penilaian/${id}`);
  const { assignment: a, recording: r, others } = found;
  const next = queue.find((q) => q.id !== r.id);
  const left = queue.filter((q) => q.id !== r.id).length;

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/guru/penilaian" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Reviews")}
        </Link>
        {left > 0 && <span className="text-sm text-muted-foreground">{t("{0} more waiting", left)}</span>}
      </div>
      <header className="grid gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {a.studentName} · {a.pieceTitle ?? a.lesson?.title ?? t("Assignment")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("Sent {0}", formatDateTime(r.createdAt))}
          {r.durationSeconds ? ` · ${formatSeconds(r.durationSeconds)}` : ""}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4 lg:sticky lg:top-4">
          <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs">
            <audio controls src={`/api/files/${r.fileKey}`} className="w-full" />
            {r.note && <p className="rounded-lg bg-muted p-2.5 text-sm">“{r.note}”</p>}
          </section>
          <section className="grid gap-2 rounded-2xl border bg-card p-4 text-sm shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/guru/tugas/${a.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                <ClipboardList className="size-4" /> {t("Assignment")}
              </Link>
              {a.dueDate && (
                <Badge>
                  <CalendarClock className="size-3" /> {formatDay(a.dueDate)}
                </Badge>
              )}
              {(a.targetStage || a.targetBpm) && (
                <Badge tone="primary">
                  <Gauge className="size-3" /> {[a.targetStage ? t("Stage {0}", a.targetStage) : null, a.targetBpm ? `${a.targetBpm} bpm` : null].filter(Boolean).join(" · ")}
                </Badge>
              )}
              {a.pieceSlug && (
                <Link href={`/guru/materi/partitur/${a.pieceSlug}`} target="_blank" className="font-semibold text-primary hover:underline">
                  {t("Open the score")}
                </Link>
              )}
            </div>
            {a.instructions && <Markdown className="text-sm">{a.instructions}</Markdown>}
          </section>
          {others.length > 0 && (
            <details className="rounded-2xl border bg-card p-4 shadow-xs">
              <summary className="cursor-pointer text-sm font-bold">{t("Earlier recordings of this assignment ({0})", others.length)}</summary>
              <div className="mt-3">
                <RecordingList recordings={others} />
              </div>
            </details>
          )}
        </div>
        <section className="grid gap-3">
          <h2 className="text-lg font-extrabold">{r.review ? t("Change review") : t("Review")}</h2>
          <ReviewForm
            recordingId={r.id}
            studentId={a.studentId}
            targetStage={a.pieceId && a.targetStage ? a.targetStage : null}
            nextHref={next ? `/guru/penilaian/${next.id}` : "/guru/penilaian"}
            initial={
              r.review
                ? {
                    scores: { posture: r.review.posture, accuracy: r.review.accuracy, rhythm: r.review.rhythm, technique: r.review.technique, expression: r.review.expression },
                    comment: r.review.comment ?? "",
                    audioKey: r.review.audioCommentFileKey,
                    done: a.status === "done",
                  }
                : null
            }
          />
        </section>
      </div>
    </div>
  );
}
