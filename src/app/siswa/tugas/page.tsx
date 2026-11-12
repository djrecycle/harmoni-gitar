import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardList, Mic, Music } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { listStudentAssignments } from "@/lib/assignments";
import { formatDay } from "@/lib/dates";
import { ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_TONE } from "@/lib/rubric";
import { requireStudent } from "@/lib/session";
import { cn, shortLabel, today, plainText } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Assignments") };
}

export default async function StudentAssignmentsPage() {
  const student = await requireStudent();
  const t = await getT();
  const list = await listStudentAssignments(student.id);
  const now = today();
  const open = list.filter((a) => a.status !== "done");
  const done = list.filter((a) => a.status === "done");

  const card = (a: (typeof list)[number]) => {
    const late = a.status === "assigned" && a.dueDate && a.dueDate < now;
    return (
      <li key={a.id}>
        <Link href={`/siswa/tugas/${a.id}`} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-primary/50">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{a.pieceTitle ? <Music className="size-5" /> : <ClipboardList className="size-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{a.pieceTitle ?? a.lesson?.title ?? shortLabel(plainText(a.instructions ?? ""), 60)}</p>
            {a.instructions && (a.pieceTitle || a.lesson) && <p className="truncate text-sm text-muted-foreground">{plainText(a.instructions)}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <Badge tone={ASSIGNMENT_STATUS_TONE[a.status]}>{t(ASSIGNMENT_STATUS_LABEL[a.status])}</Badge>
              {a.dueDate && (
                <span className={cn("inline-flex items-center gap-1", late ? "font-semibold text-danger" : "text-muted-foreground")}>
                  <CalendarClock className="size-3.5" /> {t("Due {0}", formatDay(a.dueDate))}
                </span>
              )}
              {a.recordings > 0 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Mic className="size-3.5" /> {a.recordings}
                </span>
              )}
            </div>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader title={t("Assignments")} description={t("Practise what your teacher gave you, record yourself playing it, and send it. Your teacher listens and scores it.")} />
      {!list.length ? (
        <EmptyState icon={<ClipboardList />} title={t("No assignments yet")}>
          {t("When your teacher gives you an assignment, it appears here.")}
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          <section className="grid gap-2">
            <h2 className="font-bold">{t("To do ({0})", open.length)}</h2>
            {open.length ? <ul className="grid gap-2 sm:grid-cols-2">{open.map(card)}</ul> : <p className="text-sm text-muted-foreground">{t("All done. Great work!")}</p>}
          </section>
          {done.length > 0 && (
            <section className="grid gap-2">
              <h2 className="font-bold">{t("Done ({0})", done.length)}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">{done.map(card)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
