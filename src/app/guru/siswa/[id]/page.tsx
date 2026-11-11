import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, CircleCheck, Gift, Lock, LockOpen, Plus } from "lucide-react";
import { approveUnit, setUnitOpen } from "@/app/actions/learning";
import { setActive } from "@/app/actions/students";
import { ActionButton } from "@/components/action-button";
import { JournalList, PracticeStatCards, WeekTracker } from "@/components/practice-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Badge, PageHeader, Progress } from "@/components/ui/misc";
import { getExtraLessons, getUnitCheck, getUnitMap } from "@/lib/curriculum";
import { dayName, formatDay, shortTime } from "@/lib/dates";
import { LOCATION_LABEL, MEETING_STATUS_LABEL, MEETING_STATUS_TONE } from "@/lib/labels";
import { getAvailablePieces } from "@/lib/pieces";
import { getJournal, getPracticeStats } from "@/lib/practice";
import { ROUTINE_KEYS } from "@/lib/routine";
import { listSlots, studentMeetings } from "@/lib/schedule";
import { requireTeacher } from "@/lib/session";
import { getStudentOfTeacher, routineFor } from "@/lib/students";
import { formatDate, today } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { ProfileForm, ResetPasswordButton, TeacherCheckForm } from "./forms";
import { PieceRows } from "./piece-rows";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const teacher = await requireTeacher();
  const s = await getStudentOfTeacher(teacher.id, (await params).id);
  return { title: s?.user.name ?? "-" };
}

export default async function StudentProfilePage({ params }: Props) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const s = await getStudentOfTeacher(teacher.id, id);
  if (!s) notFound();
  const t = await getT();
  const now = today();

  const [map, extras, stats, journal, { routine, custom }, slots, upcoming, past] = await Promise.all([
    getUnitMap(id),
    getExtraLessons(id),
    getPracticeStats(id),
    getJournal(id, 10),
    routineFor(id),
    listSlots(teacher.id, id),
    studentMeetings(id, { from: now, limit: 4 }),
    studentMeetings(id, { to: now, limit: 5, order: "desc" }),
  ]);
  const goal = ROUTINE_KEYS.reduce((n, k) => n + routine[k], 0);
  const pieces = await getAvailablePieces(id, map, extras);
  const active = s.profile.status === "active";

  // Cek Unit of every open unit that has check items, newest unit first.
  const checks = (
    await Promise.all(
      map
        .filter((u) => u.unlocked)
        .map(async (u, i, open) => {
          const items = await getUnitCheck(id, u.id);
          const nextUnit = map.find((m) => m.order > u.order);
          const checkLesson = u.lessons.find((l) => l.kind === "check");
          return { unit: u, items, nextUnit, checkDone: checkLesson?.state === "done", isLatest: i === open.length - 1 };
        }),
    )
  )
    .filter((c) => c.items.length)
    .reverse();

  return (
    <>
      <Link href="/guru/siswa" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("Students")}
      </Link>
      <PageHeader
        title={s.user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>@{s.user.username}</span>
            <Badge tone={active ? "success" : "neutral"}>{active ? t("Active") : t("Inactive")}</Badge>
            {s.user.mustChangePassword && <Badge>{t("Has not changed the initial password")}</Badge>}
          </span>
        }
        action={
          <>
            <ResetPasswordButton studentId={id} name={s.user.name} />
            {active ? (
              <ActionButton
                action={setActive.bind(null, id, false)}
                confirm={t("Make {0} inactive? They are signed out at once and cannot sign in until you activate them again. Their data is kept.", s.user.name)}
                variant="danger-soft"
              >
                {t("Deactivate")}
              </ActionButton>
            ) : (
              <ActionButton action={setActive.bind(null, id, true)} variant="secondary">
                {t("Activate again")}
              </ActionButton>
            )}
          </>
        }
      />
      {!active && (
        <Alert kind="warning" className="mb-6">
          {t("This student is inactive: they cannot sign in and are left out of the schedule. Nothing has been deleted.")}
        </Alert>
      )}

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 text-sm font-semibold">
        {[
          ["#kemajuan", t("Progress")],
          ["#karya", t("Pieces")],
          ["#latihan", t("Practice")],
          ["#jadwal", t("Schedule")],
          ["#profil", t("Profile")],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border bg-card px-3 py-1.5 hover:bg-muted">
            {label}
          </a>
        ))}
      </nav>

      <section id="kemajuan" className="grid scroll-mt-20 gap-4">
        <h2 className="text-xl font-extrabold">{t("Progress")}</h2>
        {checks.map(({ unit, items, nextUnit, checkDone, isLatest }) => {
          const nextOpen = nextUnit ? map.find((m) => m.id === nextUnit.id)?.unlocked : true;
          return (
            <Card key={unit.id}>
              <CardHeader>
                <CardTitle>{t("Unit check: {0}", unit.title)}</CardTitle>
                <CardDescription>
                  {checkDone ? t("The student has filled in the unit check.") : t("The student has not finished the unit check yet.")}{" "}
                  {t("Compare their own rating with yours, then approve to open the next unit.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {/* key: remount with the saved levels after a save (React resets a form to its old default values) */}
                <TeacherCheckForm key={items.map((i) => i.teacherLevel ?? "-").join()} studentId={id} unitId={unit.id} items={items} />
                {nextUnit && !nextOpen && isLatest && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-soft p-3">
                    <p className="text-sm">{t("Ready for {0}?", nextUnit.title)}</p>
                    <ActionButton action={approveUnit.bind(null, id, unit.id)} confirm={t("Approve the unit check and open {0} for {1}?", nextUnit.title, s.user.name)}>
                      <CircleCheck /> {t("Approve & open {0}", nextUnit.title)}
                    </ActionButton>
                  </div>
                )}
                {nextUnit && nextOpen && <p className="text-sm text-success">{t("Approved: {0} is open.", nextUnit.title)}</p>}
              </CardContent>
            </Card>
          );
        })}

        <div className="grid gap-3 md:grid-cols-2">
          {map.map((u) => (
            <Card key={u.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: u.color ?? "var(--primary)" }} />
                      {t("Unit {0}", u.order)} · {u.title}
                    </CardTitle>
                    <CardDescription>
                      {u.unlocked ? t("{0} of {1} lessons done", u.done, u.lessons.length) : t("Locked")}
                      {u.unlockedAt && ` · ${t("opened {0}", formatDate(u.unlockedAt))}`}
                    </CardDescription>
                  </div>
                  {!u.openByDefault &&
                    (u.unlocked ? (
                      <ActionButton action={setUnitOpen.bind(null, id, u.id, false)} confirm={t("Close {0} again for this student? Their progress is kept.", u.title)} variant="ghost" size="sm">
                        <Lock /> {t("Close")}
                      </ActionButton>
                    ) : (
                      <ActionButton action={setUnitOpen.bind(null, id, u.id, true)} confirm={t("Open {0} for this student now (without the unit check)?", u.title)} variant="outline" size="sm">
                        <LockOpen /> {t("Open")}
                      </ActionButton>
                    ))}
                </div>
              </CardHeader>
              <CardContent>
                {u.lessons.length ? (
                  <>
                    <Progress value={(u.done / u.lessons.length) * 100} className="mb-3" />
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-primary">{t("Show lessons")}</summary>
                      <ol className="mt-2 grid gap-1 text-sm">
                        {u.lessons.map((l) => (
                          <li key={l.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 odd:bg-muted">
                            <span className="min-w-0 truncate">{l.title}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {l.state === "done" ? `✓ ${formatDate(l.doneAt)}` : l.state === "open" ? t("Open") : t("Locked")}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("No lessons published yet.")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="tambahan" className="mt-10 grid scroll-mt-20 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Gift className="size-5 text-accent" /> {t("Extra material")}
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href={`/guru/materi/pelajaran/baru?siswa=${id}`}>
              <Plus /> {t("Give extra material")}
            </Link>
          </Button>
        </div>
        {extras.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {extras.map((l) => (
              <li key={l.id}>
                <Link href={`/guru/materi/pelajaran/${l.id}/pratinjau`} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/50">
                  <span className="min-w-0 truncate font-semibold">{l.title}</span>
                  {l.state === "done" ? (
                    <Badge tone="success">
                      <CircleCheck className="size-3" /> {t("Done {0}", formatDate(l.doneAt))}
                    </Badge>
                  ) : (
                    <Badge>{t("Not done yet")}</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No extra material for this student yet.")}</p>
        )}
      </section>

      <section id="karya" className="mt-10 grid scroll-mt-20 gap-4">
        <h2 className="text-xl font-extrabold">{t("Pieces")}</h2>
        <p className="text-sm text-muted-foreground">{t("Stages 1–3 (slow, medium, full tempo). The student ticks them; you can correct a stage and mark it as checked after hearing it.")}</p>
        {pieces.length ? (
          <PieceRows
            studentId={id}
            rows={pieces.map((p) => ({
              id: p.id,
              title: p.title,
              stage: p.progress.stage,
              verified: p.progress.teacherVerified,
              bestBpm: p.progress.bestBpm,
              stageBpm: p.stageBpm,
              dates: p.progress.stageDates,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("No pieces opened yet.")}</p>
        )}
      </section>

      <section id="latihan" className="mt-10 grid scroll-mt-20 gap-4">
        <h2 className="text-xl font-extrabold">{t("Practice")}</h2>
        <PracticeStatCards stats={stats} goalMinutes={goal} />
        <WeekTracker stats={stats} goalMinutes={goal} />
        <h3 className="font-bold">{t("Latest journal entries")}</h3>
        <JournalList entries={journal} />
      </section>

      <section id="jadwal" className="mt-10 grid scroll-mt-20 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{t("Schedule")}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/guru/jadwal?siswa=${id}#tambah`}>
              <CalendarPlus /> {t("Manage schedule")}
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-bold">{t("Weekly lesson time")}</p>
              {slots.length ? (
                <ul className="grid gap-1 text-sm">
                  {slots.map(({ slot }) => (
                    <li key={slot.id}>
                      {t(dayName(slot.dayOfWeek))} {shortTime(slot.startTime)} · {slot.durationMinutes} {t("min")} · {t(LOCATION_LABEL[slot.location])}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("No weekly lesson time yet.")}</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">{t("Next meetings")}</p>
              <MeetingLines rows={upcoming} />
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">{t("Recent meetings")}</p>
              <MeetingLines rows={past} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="profil" className="mt-10 grid scroll-mt-20 gap-4">
        <h2 className="text-xl font-extrabold">{t("Profile")}</h2>
        <ProfileForm
          key={JSON.stringify([s.user.name, s.profile, routine, custom])}
          studentId={id}
          values={{
            name: s.user.name,
            birthYear: s.profile.birthYear?.toString() ?? "",
            startedAt: s.profile.startedAt ?? "",
            guitarNotes: s.profile.guitarNotes ?? "",
            teacherNotes: s.profile.teacherNotes ?? "",
          }}
          routine={routine}
          customRoutine={custom}
        />
      </section>
    </>
  );
}

async function MeetingLines({ rows }: { rows: Awaited<ReturnType<typeof studentMeetings>> }) {
  const t = await getT();
  if (!rows.length) return <p className="text-sm text-muted-foreground">-</p>;
  return (
    <ul className="grid gap-1 text-sm">
      {rows.map((m) => (
        <li key={m.id}>
          <Link href={`/guru/jadwal/${m.id}`} className="flex flex-wrap items-center gap-1.5 hover:underline">
            {formatDay(m.date)} {shortTime(m.startTime)}
            <Badge tone={MEETING_STATUS_TONE[m.status]}>{t(MEETING_STATUS_LABEL[m.status])}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
