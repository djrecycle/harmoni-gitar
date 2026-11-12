import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarClock, Gauge, Trash2 } from "lucide-react";
import { deleteRecording } from "@/app/actions/assignments";
import { ActionButton } from "@/components/action-button";
import { Markdown } from "@/components/markdown";
import { RecordingList } from "@/components/recording/recording-list";
import { PieceCard } from "@/components/score/piece-card";
import { Alert, Badge } from "@/components/ui/misc";
import { getStudentAssignment } from "@/lib/assignments";
import { isUuid } from "@/lib/access";
import { formatDay } from "@/lib/dates";
import { markReadByLink } from "@/lib/notifications";
import { ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_TONE } from "@/lib/rubric";
import { requireStudent } from "@/lib/session";
import { shortLabel } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { SendRecording } from "./send-recording";

type Props = { params: Promise<{ id: string }> };

async function load(studentId: string, id: string) {
  return isUuid(id) ? getStudentAssignment(studentId, id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const student = await requireStudent();
  const a = await load(student.id, (await params).id);
  return { title: a ? (a.pieceTitle ?? shortLabel(a.instructions ?? "", 40)) : "-" };
}

export default async function StudentAssignmentPage({ params }: Props) {
  const student = await requireStudent();
  const t = await getT();
  const a = await load(student.id, (await params).id);
  if (!a) notFound();
  await markReadByLink(student.id, `/siswa/tugas/${a.id}`);
  const stage = a.targetStage ? String(a.targetStage) as "1" | "2" | "3" : null;

  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <Link href="/siswa/tugas" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("Assignments")}
      </Link>
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ASSIGNMENT_STATUS_TONE[a.status]}>{t(ASSIGNMENT_STATUS_LABEL[a.status])}</Badge>
          {a.dueDate && (
            <Badge>
              <CalendarClock className="size-3" /> {t("Due {0}", formatDay(a.dueDate))}
            </Badge>
          )}
          {stage && a.piece && (
            <Badge tone="primary">
              <Gauge className="size-3" /> {t("Target: stage {0} · {1} bpm", stage, a.targetBpm ?? a.piece.stageBpm[stage])}
            </Badge>
          )}
          {!stage && a.targetBpm && (
            <Badge tone="primary">
              <Gauge className="size-3" /> {t("Target: {0} bpm", a.targetBpm)}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{a.pieceTitle ?? a.lesson?.title ?? t("Assignment")}</h1>
        <p className="text-sm text-muted-foreground">{t("Given on {0}", formatDay(a.createdAt.toISOString().slice(0, 10)))}</p>
      </header>

      {a.instructions && (
        <section className="rounded-2xl border bg-card p-4 shadow-xs">
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">{t("From your teacher")}</h2>
          <Markdown>{a.instructions}</Markdown>
        </section>
      )}
      {a.lesson && (
        <Link href={a.lesson.href} className="inline-flex items-center gap-2 rounded-xl border bg-card p-3 text-sm font-semibold text-primary hover:border-primary/50">
          <BookOpen className="size-4" /> {t("Lesson: {0}", a.lesson.title)}
        </Link>
      )}
      {a.piece && <PieceCard piece={a.piece} withStages={false} />}

      <section className="grid gap-3">
        <h2 className="text-lg font-extrabold">{t("Record and send")}</h2>
        {a.status === "done" ? (
          <Alert kind="success" title={t("This assignment is done")}>
            {t("Your teacher marked it as done. Well played!")}
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("Find a quiet place, put the phone about one metre away, and play the whole piece once. You can listen back before you send it.")}
            </p>
            <SendRecording assignmentId={a.id} />
          </>
        )}
      </section>

      {a.recordings.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-extrabold">{t("Your recordings ({0})", a.recordings.length)}</h2>
          <RecordingList
            recordings={a.recordings}
            actions={(r) =>
              !r.review && (
                <ActionButton size="sm" variant="ghost" action={deleteRecording.bind(null, r.id)} confirm={t("Delete this recording?")} aria-label={t("Delete recording")}>
                  <Trash2 />
                </ActionButton>
              )
            }
          />
        </section>
      )}
    </article>
  );
}
