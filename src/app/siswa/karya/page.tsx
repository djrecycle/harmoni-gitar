import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Music } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { getAvailablePieces, nextTargetBpm } from "@/lib/pieces";
import { requireStudent } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Pieces") };
}

export default async function PiecesPage() {
  const student = await requireStudent();
  const t = await getT();
  const pieces = await getAvailablePieces(student.id);

  return (
    <>
      <PageHeader title={t("Pieces & exercises")} description={t("Every piece from the lessons you have opened. Reach the three stages: slow, medium, full tempo.")} />
      {pieces.length === 0 ? (
        <EmptyState icon={<Music />} title={t("No pieces yet")}>
          {t("Pieces appear here when you open the lessons that use them.")}
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pieces.map((p) => {
            const { stage } = p.progress;
            return (
              <li key={p.id}>
                <Link href={`/siswa/karya/${p.slug}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-primary/50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Music className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {!p.lesson ? t("From an assignment") : p.lesson.unitOrder == null ? `${t("Extra material")} · ${p.lesson.title}` : `${t("Unit {0}", p.lesson.unitOrder)} · ${p.lesson.title}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {[1, 2, 3].map((n) => (
                        <span key={n} className={cn("h-1.5 w-8 rounded-full", stage >= n ? "bg-success" : "bg-muted")} />
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {stage >= 3 ? t("All stages reached") : t("Next: stage {0} · {1} bpm", stage + 1, nextTargetBpm(p, stage))}
                      </span>
                      {p.progress.teacherVerified && stage > 0 && (
                        <Badge tone="success" className="ml-auto">
                          <BadgeCheck className="size-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
