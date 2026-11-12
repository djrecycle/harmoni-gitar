import type { Metadata } from "next";
import { RoutineTimer } from "@/components/routine-timer";
import { PageHeader } from "@/components/ui/misc";
import { getUnitMap, nextLesson } from "@/lib/curriculum";
import { getAvailablePieces, nextTargetBpm } from "@/lib/pieces";
import { ROUTINE_KEYS, segmentForLessonKind } from "@/lib/routine";
import { requireStudent } from "@/lib/session";
import { routineFor } from "@/lib/students";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Practice") };
}

export default async function PracticePage() {
  const student = await requireStudent();
  const t = await getT();
  const [{ routine }, map] = await Promise.all([routineFor(student.id), getUnitMap(student.id)]);
  const pieces = (await getAvailablePieces(student.id, map)).map((p) => ({
    id: p.id,
    title: p.title,
    stage: p.progress.stage,
    targetBpm: nextTargetBpm(p, p.progress.stage),
    fileUrl: p.fileUrl,
    defaultBpm: p.defaultBpm,
    stageBpm: p.stageBpm,
    segment: segmentForLessonKind(p.lesson?.kind),
  }));
  const total = ROUTINE_KEYS.reduce((n, k) => n + routine[k], 0);
  const n = nextLesson(map);
  return (
    <>
      <PageHeader title={t("Practice session")} description={t("About {0} minutes: warm-up & technique, etude, and a piece. Better a little every day than a lot once a week.", total)} />
      <RoutineTimer userId={student.id} routine={routine} learning={n ? { title: n.lesson.title, href: `/siswa/belajar/${n.unit.slug}/${n.lesson.slug}` } : null} pieces={pieces} />
    </>
  );
}
