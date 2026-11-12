import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardList, Mic, Music } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { assignmentFormOptions, listTeacherAssignments } from "@/lib/assignments";
import { formatDayShort } from "@/lib/dates";
import { ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_TONE } from "@/lib/rubric";
import { requireTeacher } from "@/lib/session";
import { cn, shortLabel, today, plainText } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { CreateAssignmentForm } from "./create-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Assignments") };
}

type Props = { searchParams: Promise<{ siswa?: string; semua?: string }> };

export default async function TeacherAssignmentsPage({ searchParams }: Props) {
  const teacher = await requireTeacher();
  const t = await getT();
  const sp = await searchParams;
  const [options, list] = await Promise.all([assignmentFormOptions(teacher.id), listTeacherAssignments(teacher.id)]);
  const now = today();
  const open = list.filter((a) => a.status !== "done");
  const done = list.filter((a) => a.status === "done");
  const shownDone = sp.semua ? done : done.slice(0, 10);

  const row = (a: (typeof list)[number]) => {
    const late = a.status === "assigned" && a.dueDate && a.dueDate < now;
    return (
      <li key={a.id}>
        <Link href={`/guru/tugas/${a.id}`} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/50">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{a.pieceTitle ? <Music className="size-4.5" /> : <ClipboardList className="size-4.5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {a.studentName} · {a.pieceTitle ?? a.lesson?.title ?? shortLabel(plainText(a.instructions ?? ""), 50)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <Badge tone={ASSIGNMENT_STATUS_TONE[a.status]}>{t(ASSIGNMENT_STATUS_LABEL[a.status])}</Badge>
              {a.dueDate && (
                <span className={cn("inline-flex items-center gap-1", late ? "font-semibold text-danger" : "text-muted-foreground")}>
                  <CalendarClock className="size-3.5" /> {formatDayShort(a.dueDate)}
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
      <PageHeader title={t("Assignments")} description={t("Give students something to practise and record. Their recordings come to Reviews.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{t("Give an assignment")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAssignmentForm options={options} preselect={sp.siswa} />
          </CardContent>
        </Card>
        <div className="grid gap-6">
          <section className="grid gap-2">
            <h2 className="font-bold">{t("Open ({0})", open.length)}</h2>
            {open.length ? <ul className="grid gap-2">{open.map(row)}</ul> : <p className="text-sm text-muted-foreground">{t("No open assignments.")}</p>}
          </section>
          {done.length > 0 && (
            <section className="grid gap-2">
              <h2 className="font-bold">{t("Done ({0})", done.length)}</h2>
              <ul className="grid gap-2">{shownDone.map(row)}</ul>
              {shownDone.length < done.length && (
                <Link href="/guru/tugas?semua=1" className="text-sm font-semibold text-primary hover:underline">
                  {t("Show all")}
                </Link>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
