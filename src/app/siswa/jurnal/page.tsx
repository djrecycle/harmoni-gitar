import type { Metadata } from "next";
import Link from "next/link";
import { Timer, Trash2 } from "lucide-react";
import { deletePracticeSession } from "@/app/actions/practice";
import { ActionButton } from "@/components/action-button";
import { JournalList, PracticeStatCards, WeekTracker } from "@/components/practice-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { getJournal, getPracticeStats } from "@/lib/practice";
import { ROUTINE_KEYS } from "@/lib/routine";
import { requireStudent } from "@/lib/session";
import { routineFor } from "@/lib/students";
import { addDays, today } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { ManualPracticeForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Journal") };
}

export default async function JournalPage() {
  const student = await requireStudent();
  const t = await getT();
  const [stats, entries, { routine }] = await Promise.all([getPracticeStats(student.id), getJournal(student.id, 50), routineFor(student.id)]);
  const goal = ROUTINE_KEYS.reduce((n, k) => n + routine[k], 0);
  const deletableAfter = Date.now() - 7 * 86_400_000;
  const now = today();

  return (
    <>
      <PageHeader
        title={t("Practice journal")}
        description={t("Every practice session, with your streak and this week's tracker.")}
        action={
          <Button asChild>
            <Link href="/siswa/latihan">
              <Timer /> {t("Start practising")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4">
        <PracticeStatCards stats={stats} goalMinutes={goal} />
        <WeekTracker stats={stats} goalMinutes={goal} />
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
          <section className="grid gap-2">
            <h2 className="font-bold">{t("History")}</h2>
            <JournalList
              entries={entries}
              renderDelete={(e) =>
                e.createdAt.getTime() > deletableAfter && (
                  <ActionButton action={deletePracticeSession.bind(null, e.id)} confirm={t("Delete this journal entry?")} variant="ghost" size="icon" aria-label={t("Delete")} className="size-8 shrink-0">
                    <Trash2 />
                  </ActionButton>
                )
              }
            />
          </section>
          <Card>
            <CardHeader>
              <CardTitle>{t("Practised without the timer?")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ManualPracticeForm min={addDays(now, -7)} max={now} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
