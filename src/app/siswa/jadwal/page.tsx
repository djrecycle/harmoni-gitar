import type { Metadata } from "next";
import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { dayName, formatDay, isoDayOfWeek, shortTime } from "@/lib/dates";
import { LOCATION_LABEL, MEETING_STATUS_LABEL, MEETING_STATUS_TONE } from "@/lib/labels";
import { slotsOfStudent, studentMeetings } from "@/lib/schedule";
import { requireStudent } from "@/lib/session";
import { addDays, today } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Schedule") };
}

export default async function StudentSchedulePage() {
  const student = await requireStudent();
  const t = await getT();
  const now = today();
  const [slots, upcoming, past] = await Promise.all([
    slotsOfStudent(student.id),
    studentMeetings(student.id, { from: now, to: addDays(now, 56), limit: 8 }),
    studentMeetings(student.id, { to: addDays(now, -1), limit: 20, order: "desc" }),
  ]);

  if (!slots.length && !upcoming.length && !past.length) {
    return (
      <>
        <PageHeader title={t("Lesson schedule")} />
        <EmptyState icon={<CalendarDays />} title={t("No schedule yet")}>
          {t("Your teacher has not set your lesson time yet.")}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("Lesson schedule")} description={t("Your lesson times, attendance, and notes from your teacher.")} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          {slots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Every week")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {slots.map((s) => (
                  <p key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold">
                    <span>
                      {t(dayName(s.dayOfWeek))}, {shortTime(s.startTime)} ({s.durationMinutes} {t("min")})
                    </span>
                    <span className="inline-flex items-center gap-1 font-normal text-muted-foreground">
                      <MapPin className="size-3.5" /> {t(LOCATION_LABEL[s.location])}
                    </span>
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("Next meetings")}</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ul className="grid gap-1.5">
                  {upcoming.map((m) => (
                    <li key={m.id} className="rounded-lg px-3 py-2 text-sm odd:bg-muted">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {m.date === now ? t("Today") : t(dayName(isoDayOfWeek(m.date)))}, {formatDay(m.date)} · {shortTime(m.startTime)}
                        </span>
                        {m.status !== "scheduled" && <Badge tone={MEETING_STATUS_TONE[m.status]}>{t(MEETING_STATUS_LABEL[m.status])}</Badge>}
                      </div>
                      {m.material && (
                        <p className="mt-1.5">
                          <span className="text-muted-foreground">{t("Studied:")}</span> {m.material}
                        </p>
                      )}
                      {m.teacherNote && <p className="mt-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 whitespace-pre-line">{m.teacherNote}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("Past meetings")}</CardTitle>
          </CardHeader>
          <CardContent>
            {past.length ? (
              <ul className="grid gap-2">
                {past.map((m) => (
                  <li key={m.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {formatDay(m.date)} · {shortTime(m.startTime)}
                      </span>
                      <Badge tone={MEETING_STATUS_TONE[m.status]}>{t(MEETING_STATUS_LABEL[m.status])}</Badge>
                    </div>
                    {m.material && (
                      <p className="mt-1.5">
                        <span className="text-muted-foreground">{t("Studied:")}</span> {m.material}
                      </p>
                    )}
                    {m.teacherNote && <p className="mt-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 whitespace-pre-line">{m.teacherNote}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
