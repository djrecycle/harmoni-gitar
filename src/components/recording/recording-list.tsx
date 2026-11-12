import { Clock, MessageSquareText, Star } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/misc";
import type { RecordingView, ReviewView } from "@/lib/assignments";
import { RUBRIC, levelLabel, rubricAverage } from "@/lib/rubric";
import { cn, formatDateTime, formatSeconds } from "@/lib/utils";
import { getT } from "@/i18n/server";

/** The teacher's rubric scores, comment and voice comment for one recording. */
export async function ReviewCard({ review }: { review: ReviewView }) {
  const t = await getT();
  const avg = rubricAverage(review);
  return (
    <div className="grid gap-3 rounded-xl border border-success/30 bg-success-soft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Star className="size-4 text-accent" /> {t("Teacher's review")}
        </p>
        <Badge tone="success">
          {t("Average {0}", avg.toFixed(1))} · {t(levelLabel(Math.round(avg)))}
        </Badge>
      </div>
      <ul className="grid gap-1.5">
        {RUBRIC.map((r) => (
          <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{t(r.label)}</span>
              <span className="block text-xs text-muted-foreground">{t(r.hint)}</span>
            </span>
            <span className="flex items-center gap-1" aria-label={`${review[r.key]} / 4`}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={cn("size-2.5 rounded-full", n <= review[r.key] ? "bg-success" : "bg-muted-foreground/25")} />
              ))}
              <span className="ml-1 w-24 text-right text-xs text-muted-foreground">{t(levelLabel(review[r.key]))}</span>
            </span>
          </li>
        ))}
      </ul>
      {review.comment && (
        <div className="rounded-lg bg-card p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <MessageSquareText className="size-3.5" /> {t("Comment")}
          </p>
          <Markdown className="text-sm">{review.comment}</Markdown>
        </div>
      )}
      {review.audioCommentFileKey && (
        <div>
          <p className="mb-1 text-xs font-bold text-muted-foreground">{t("Voice comment")}</p>
          <audio controls preload="none" src={`/api/files/${review.audioCommentFileKey}`} className="w-full" />
        </div>
      )}
    </div>
  );
}

/** Recordings of an assignment, newest first, each with its review (or "waiting"). `actions` adds buttons per recording. */
export async function RecordingList({ recordings, actions }: { recordings: RecordingView[]; actions?: (r: RecordingView) => React.ReactNode }) {
  const t = await getT();
  return (
    <ol className="grid gap-3">
      {recordings.map((r, i) => (
        <li key={r.id} className="grid gap-3 rounded-2xl border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {t("Recording {0}", recordings.length - i)}
              <span className="ml-2 font-normal text-muted-foreground">
                {formatDateTime(r.createdAt)}
                {r.durationSeconds ? ` · ${formatSeconds(r.durationSeconds)}` : ""}
              </span>
            </p>
            <div className="flex items-center gap-2">
              {!r.review && (
                <Badge tone="warning">
                  <Clock className="size-3" /> {t("Waiting for review")}
                </Badge>
              )}
              {actions?.(r)}
            </div>
          </div>
          <audio controls preload="none" src={`/api/files/${r.fileKey}`} className="w-full" />
          {r.note && <p className="rounded-lg bg-muted p-2.5 text-sm">{r.note}</p>}
          {r.review && <ReviewCard review={r.review} />}
        </li>
      ))}
    </ol>
  );
}
