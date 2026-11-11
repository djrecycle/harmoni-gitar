import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { deleteSlot } from "@/app/actions/schedule";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { DAY_NAMES, dayName, formatDay, formatDayShort, isDateString, shortTime, startOfWeek } from "@/lib/dates";
import { LOCATION_LABEL, MEETING_STATUS_LABEL, MEETING_STATUS_TONE } from "@/lib/labels";
import { ensureMeetings, listSlots, teacherMeetings } from "@/lib/schedule";
import { requireTeacher } from "@/lib/session";
import { listStudents } from "@/lib/students";
import { addDays, cn, today } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { MeetingForm, SlotForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Schedule") };
}

type Props = { searchParams: Promise<{ minggu?: string; siswa?: string }> };

export default async function SchedulePage({ searchParams }: Props) {
  const teacher = await requireTeacher();
  const t = await getT();
  const sp = await searchParams;
  const now = today();
  const monday = startOfWeek(isDateString(sp.minggu) ? sp.minggu : now);
  const sunday = addDays(monday, 6);

  await ensureMeetings(teacher.id);
  const [meetings, slots, students] = await Promise.all([teacherMeetings(teacher.id, monday, sunday), listSlots(teacher.id), listStudents(teacher.id)]);
  const active = students.filter((s) => s.status === "active").map((s) => ({ id: s.id, name: s.name }));
  const preselect = active.some((s) => s.id === sp.siswa) ? sp.siswa : undefined;

  return (
    <>
      <PageHeader title={t("Schedule")} description={t("Weekly lessons, attendance, and notes. Meetings are made automatically from each student's weekly lesson time.")} />

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon" aria-label={t("Previous week")}>
          <Link href={`/guru/jadwal?minggu=${addDays(monday, -7)}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <div className="text-center">
          <p className="font-bold">
            {formatDay(monday)} – {formatDay(sunday)}
          </p>
          {monday !== startOfWeek(now) && (
            <Link href="/guru/jadwal" className="text-xs font-semibold text-primary hover:underline">
              {t("Back to this week")}
            </Link>
          )}
        </div>
        <Button asChild variant="outline" size="icon" aria-label={t("Next week")}>
          <Link href={`/guru/jadwal?minggu=${addDays(monday, 7)}`}>
            <ChevronRight />
          </Link>
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-7">
        {DAY_NAMES.map((d, i) => {
          const date = addDays(monday, i);
          const rows = meetings.filter((m) => m.date === date);
          return (
            <div key={d} className={cn("rounded-xl border bg-card p-2.5 md:min-h-40", date === now && "border-primary ring-1 ring-primary/40")}>
              <p className={cn("mb-2 text-xs font-bold", date === now ? "text-primary" : "text-muted-foreground")}>
                {t(d)} · {formatDayShort(date)}
              </p>
              {rows.length ? (
                <ul className="grid gap-1.5">
                  {rows.map((m) => (
                    <li key={m.id}>
                      <Link href={`/guru/jadwal/${m.id}`} className="block rounded-lg bg-muted px-2 py-1.5 text-sm hover:brightness-95">
                        <span className="font-bold tabular-nums">{shortTime(m.startTime) || "--:--"}</span> <span className="break-words">{m.studentName}</span>
                        <Badge tone={MEETING_STATUS_TONE[m.status]} className="mt-1 flex w-fit">
                          {t(MEETING_STATUS_LABEL[m.status])}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hidden text-xs text-muted-foreground md:block">-</p>
              )}
            </div>
          );
        })}
      </div>

      <div id="tambah" className="mt-8 grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Weekly lesson times")}</CardTitle>
            <CardDescription>{t("Each one makes a meeting every week, 8 weeks ahead.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {slots.length ? (
              <ul className="grid gap-1.5">
                {slots.map(({ slot, studentName, studentStatus }) => (
                  <li key={slot.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold">
                        {studentName} {studentStatus === "inactive" && <Badge className="ml-1">{t("Inactive")}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(dayName(slot.dayOfWeek))} {shortTime(slot.startTime)} · {slot.durationMinutes} {t("min")} · {t(LOCATION_LABEL[slot.location])} · {t("from {0}", formatDay(slot.activeFrom))}
                      </p>
                    </div>
                    <ActionButton
                      action={deleteSlot.bind(null, slot.id)}
                      confirm={t("Remove this weekly lesson time? Its future meetings are removed; past meetings and attendance are kept.")}
                      variant="ghost"
                      size="icon"
                      aria-label={t("Remove")}
                    >
                      <Trash2 />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("No weekly lesson time yet.")}</p>
            )}
            <SlotForm students={active} preselect={preselect} defaultFrom={now} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("Extra or make-up meeting")}</CardTitle>
            <CardDescription>{t("A one-off meeting outside the weekly lesson time.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <MeetingForm students={active} preselect={preselect} defaultDate={now} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
