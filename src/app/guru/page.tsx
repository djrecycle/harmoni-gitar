import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CircleAlert, ClipboardCheck, MailPlus, Users } from "lucide-react";
import { PasswordChangedNotice } from "@/components/password-changed-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { getUnitMap } from "@/lib/curriculum";
import { shortTime } from "@/lib/dates";
import { daysSince, getPracticeStatsMany } from "@/lib/practice";
import { ensureMeetings, teacherMeetings } from "@/lib/schedule";
import { requireTeacher } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { listStudents } from "@/lib/students";
import { today } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { AttendanceButtons } from "./attendance-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Dashboard") };
}

export default async function TeacherDashboard({ searchParams }: { searchParams: Promise<{ sandi?: string }> }) {
  const [user, { studioName }, t, { sandi }] = await Promise.all([requireTeacher(), getSettings(), getT(), searchParams]);
  const now = today();
  await ensureMeetings(user.id);
  const [students, todays] = await Promise.all([listStudents(user.id), teacherMeetings(user.id, now, now)]);
  const active = students.filter((s) => s.status === "active");
  const stats = await getPracticeStatsMany(active.map((s) => s.id));

  // Students who have not practised for 3+ days (or never), longest first.
  const idle = active
    .map((s) => ({ s, since: daysSince(stats.get(s.id)!.lastPractice) }))
    .filter((x) => x.since === null || x.since >= 3)
    .sort((a, b) => (b.since ?? 9999) - (a.since ?? 9999));

  // Unit checks waiting for approval: check lesson done, next unit still locked.
  const maps = await Promise.all(active.map(async (s) => ({ s, map: await getUnitMap(s.id) })));
  const waiting = maps.flatMap(({ s, map }) =>
    map
      .filter((u, i) => u.unlocked && u.lessons.some((l) => l.kind === "check" && l.state === "done") && map[i + 1] && !map[i + 1].unlocked)
      .map((u) => ({ s, unit: u })),
  );

  const weekTotal = active.reduce((n, s) => n + stats.get(s.id)!.weekMinutes, 0);

  return (
    <>
      <PasswordChangedNotice show={sandi === "diganti"} />
      <PageHeader title={t("Welcome, {0}!", user.name.split(" ")[0])} description={t("This is the dashboard of {0}.", studioName)} />

      {students.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={t("No students yet")}
          action={
            <Button asChild>
              <Link href="/guru/siswa/undang">
                <MailPlus /> {t("Invite the first student")}
              </Link>
            </Button>
          }
        >
          {t("Send an invitation link over WhatsApp, or create an account with an initial password.")}
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={t("Active students")} value={active.length} icon={<Users />} />
            <StatCard label={t("Meetings today")} value={todays.length} icon={<CalendarDays />} />
            <StatCard label={t("Practice this week (all students)")} value={t("{0} min", weekTotal)} icon={<ClipboardCheck />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("Today's meetings")}</CardTitle>
              </CardHeader>
              <CardContent>
                {todays.length ? (
                  <ul className="grid gap-2">
                    {todays.map((m) => (
                      <li key={m.id} className="grid gap-2 rounded-lg bg-muted p-3">
                        <Link href={`/guru/jadwal/${m.id}`} className="flex items-center justify-between gap-2 hover:underline">
                          <span className="font-semibold">
                            <span className="tabular-nums">{shortTime(m.startTime)}</span> {m.studentName}
                          </span>
                          <span className="text-xs text-muted-foreground">{t("Notes")} →</span>
                        </Link>
                        <AttendanceButtons id={m.id} status={m.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("No meetings today.")}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleAlert className="size-4.5 text-danger" /> {t("Not practising (3+ days)")}
                </CardTitle>
                <CardDescription>{t("Maybe send them a short reminder.")}</CardDescription>
              </CardHeader>
              <CardContent>
                {idle.length ? (
                  <ul className="grid gap-1.5">
                    {idle.map(({ s, since }) => (
                      <li key={s.id}>
                        <Link href={`/guru/siswa/${s.id}#latihan`} className="flex justify-between gap-2 rounded-lg px-3 py-2 text-sm odd:bg-muted hover:underline">
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-muted-foreground">{since === null ? t("never") : t("{0} days", since)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-success">{t("Everyone practised in the last 3 days.")}</p>
                )}
              </CardContent>
            </Card>

            {waiting.length > 0 && (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle>{t("Unit checks to approve")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-1.5">
                    {waiting.map(({ s, unit }) => (
                      <li key={`${s.id}-${unit.id}`}>
                        <Link href={`/guru/siswa/${s.id}#kemajuan`} className="flex justify-between gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm hover:underline">
                          <span className="font-semibold">{s.name}</span>
                          <span>{unit.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{t("Practice this week")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1.5">
                  {active.map((s) => {
                    const st = stats.get(s.id)!;
                    return (
                      <li key={s.id}>
                        <Link href={`/guru/siswa/${s.id}`} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-3 py-2 text-sm odd:bg-muted hover:underline">
                          <span className="truncate font-semibold">{s.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {t("{0} min", st.weekMinutes)} · {st.daysThisWeek}/7 · 🔥{st.streak}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
