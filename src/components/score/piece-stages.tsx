"use client";

import { useState } from "react";
import { BadgeCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { setPieceStage } from "@/app/actions/pieces";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Stage = "1" | "2" | "3";

const STAGES: { n: Stage; name: string; how: string }[] = [
  { n: "1", name: "Slow", how: "read & play 2 bars at a time" },
  { n: "2", name: "Medium", how: "join it up without stopping" },
  { n: "3", name: "Full tempo", how: "play it for your teacher or a friend" },
];

export type StageProgress = { stage: number; bestBpm: number | null; stageDates: Partial<Record<Stage, string>>; teacherVerified: boolean };

/** The module's three stage boxes for a piece. The student ticks a stage when it is reached (the date is saved). */
export function PieceStages({ pieceId, stageBpm, progress, readOnly }: { pieceId: string; stageBpm: Record<Stage, number>; progress: StageProgress; readOnly?: boolean }) {
  const t = useT();
  const [stage, setStage] = useState(progress.stage);
  const [pending, setPending] = useState(false);

  async function toggle(n: number) {
    if (readOnly || pending) return;
    const reached = stage < n;
    const before = stage;
    setStage(reached ? n : n - 1);
    setPending(true);
    const r = await setPieceStage(pieceId, n, reached);
    setPending(false);
    if (!r.ok) {
      setStage(before);
      toast.error(r.error);
    } else if (r.message) toast.success(r.message);
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {STAGES.map(({ n, name, how }) => {
          const on = stage >= Number(n);
          const date = on ? progress.stageDates[n] : undefined;
          return (
            <button
              key={n}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={readOnly}
              onClick={() => toggle(Number(n))}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                on ? "border-success/40 bg-success-soft" : "bg-card hover:bg-muted",
                readOnly && "cursor-default",
              )}
            >
              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2", on ? "border-success bg-success text-white" : "border-input")}>
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-bold">
                  {t("Stage {0}", n)} · {t(name)} <span className="font-semibold text-muted-foreground">({stageBpm[n]} bpm)</span>
                </span>
                <span className="block text-xs text-muted-foreground">{t(how)}</span>
                <span className="mt-0.5 block text-xs">{date ? t("Date: {0}", formatDay(date)) : on ? t("Reached") : " "}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {progress.bestBpm ? <span>{t("Best metronome tempo: {0} bpm", progress.bestBpm)}</span> : null}
        {progress.teacherVerified && stage > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-success">
            <BadgeCheck className="size-3.5" /> {t("Checked by your teacher")}
          </span>
        )}
      </p>
    </div>
  );
}
