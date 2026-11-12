import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Mic, Star } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { recentReviews, reviewQueue } from "@/lib/assignments";
import { levelLabel } from "@/lib/rubric";
import { requireTeacher } from "@/lib/session";
import { formatDateTime, formatSeconds, shortLabel, plainText } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reviews") };
}

export default async function ReviewQueuePage() {
  const teacher = await requireTeacher();
  const t = await getT();
  const [queue, recent] = await Promise.all([reviewQueue(teacher.id), recentReviews(teacher.id)]);
  return (
    <>
      <PageHeader title={t("Reviews")} description={t("Recordings your students sent, oldest first. Score them with the module's rubric (5 aspects, 1–4).")} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="grid gap-2">
          <h2 className="font-bold">{t("Waiting ({0})", queue.length)}</h2>
          {!queue.length ? (
            <EmptyState icon={<ClipboardCheck />} title={t("Nothing to review")}>
              {t("New recordings appear here.")}
            </EmptyState>
          ) : (
            <ul className="grid gap-2">
              {queue.map((q) => (
                <li key={q.id}>
                  <Link href={`/guru/penilaian/${q.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning-soft text-accent-foreground dark:text-accent">
                      <Mic className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {q.studentName} · {q.pieceTitle ?? shortLabel(plainText(q.instructions ?? ""), 50)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(q.createdAt)}
                        {q.durationSeconds ? ` · ${formatSeconds(q.durationSeconds)}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="grid gap-2">
          <h2 className="font-bold">{t("Recently reviewed")}</h2>
          {!recent.length ? (
            <p className="text-sm text-muted-foreground">{t("No reviews yet.")}</p>
          ) : (
            <ul className="grid gap-2">
              {recent.map((r) => (
                <li key={r.recordingId}>
                  <Link href={`/guru/penilaian/${r.recordingId}`} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {r.studentName} · {r.pieceTitle ?? shortLabel(plainText(r.instructions ?? ""), 40)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.reviewedAt)}</p>
                    </div>
                    <Badge tone="success">
                      <Star className="size-3" /> {r.average.toFixed(1)} · {t(levelLabel(Math.round(r.average)))}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
