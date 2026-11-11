import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { BookOpen, CalendarDays, Flame, MessageSquareQuote, PartyPopper, Timer } from "lucide-react";
import { PasswordChangedNotice } from "@/components/password-changed-notice";
import { WeekTracker } from "@/components/practice-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, Progress } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { getUnitMap, nextLesson } from "@/lib/curriculum";
import { dayName, formatDay, isoDayOfWeek, shortTime } from "@/lib/dates";
import { getPracticeStats } from "@/lib/practice";
import { ROUTINE_KEYS } from "@/lib/routine";
import { studentMeetings } from "@/lib/schedule";
import { requireStudent } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { routineFor } from "@/lib/students";
import { today } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Home") };
}

export default async function StudentHome({ searchParams }: { searchParams: Promise<{ sandi?: string; baru?: string }> }) {
  const [user, { studioName }, t, sp] = await Promise.all([requireStudent(), getSettings(), getT(), searchParams]);
  const now = today();
  const M = schema.meeting;
  const [map, stats, { routine }, [nextMeeting], [lastNote]] = await Promise.all([
    getUnitMap(user.id),
    getPracticeStats(user.id),
    routineFor(user.id),
    studentMeetings(user.id, { from: now, limit: 1 }),
    db
      .select({ date: M.date, teacherNote: M.teacherNote })
      .from(M)
      .where(and(eq(M.studentId, user.id), isNotNull(M.teacherNote)))
      .orderBy(desc(M.date))
      .limit(1),
  ]);
  const goal = ROUTINE_KEYS.reduce((n, k) => n + routine[k], 0);
  const practisedToday = stats.week.find((d) => d.date === now)?.minutes ?? 0;
  const next = nextLesson(map);
  const current = next?.unit ?? [...map].reverse().find((u) => u.unlocked);

  return (
    <>
      <PasswordChangedNotice show={sp.sandi === "diganti"} />
      {sp.baru === "1" && (
        <Alert kind="success" title={t("Your account is ready!")} className="mb-6">
          {t("Start with the first lesson, then practise with the timer every day.")}
        </Alert>
      )}
      <PageHeader title={t("Hello, {0}!", user.name.split(" ")[0])} description={t("Welcome to {0}.", studioName)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft to-card">
          <CardContent className="grid gap-4 pt-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-accent to-orange-500 text-white">
                <Flame className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-extrabold">{t("{0} days in a row", stats.streak)}</p>
                <p className="text-sm text-muted-foreground">
                  {practisedToday ? t("You practised {0} minutes today. Nice!", practisedToday) : t("You have not practised today yet.")}
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="w-full sm:w-fit">
              <Link href="/siswa/latihan">
                <Timer /> {t("Start practising")} ({goal}′)
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4.5 text-primary" /> {t("Continue learning")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {next ? (
              <>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("Unit {0}", next.unit.order)} · {next.unit.title}
                  </p>
                  <p className="text-lg font-bold">{next.lesson.title}</p>
                </div>
                <Progress value={(next.unit.done / Math.max(1, next.unit.lessons.length)) * 100} label={t("Unit progress")} />
                <Button asChild variant="secondary" className="w-fit">
                  <Link href={`/siswa/belajar/${next.unit.slug}/${next.lesson.slug}`}>{t("Open lesson")}</Link>
                </Button>
              </>
            ) : (
              <div className="flex items-start gap-3">
                <PartyPopper className="size-6 shrink-0 text-accent" />
                <p className="text-sm">
                  {!current
                    ? t("No lessons yet.")
                    : current.lessons.length === 0
                      ? t("{0} is open. Its lessons are being prepared by your teacher.", current.title)
                      : t("You finished every open lesson of {0}. Your teacher will check your unit check and open the next unit.", current.title)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4.5 text-primary" /> {t("Next lesson with your teacher")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextMeeting ? (
              <p className="text-lg font-bold">
                {nextMeeting.date === now ? t("Today") : t(dayName(isoDayOfWeek(nextMeeting.date)))}, {formatDay(nextMeeting.date)} · {shortTime(nextMeeting.startTime)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("No meeting scheduled yet.")}</p>
            )}
            <Link href="/siswa/jadwal" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
              {t("See schedule")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="size-4.5 text-primary" /> {t("Latest note from your teacher")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastNote?.teacherNote ? (
              <>
                <p className="whitespace-pre-line">{lastNote.teacherNote}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDay(lastNote.date)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("No notes yet.")}</p>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <WeekTracker stats={stats} goalMinutes={goal} />
        </div>
      </div>
    </>
  );
}
