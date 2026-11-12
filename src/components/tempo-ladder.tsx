"use client";

import { useState } from "react";
import { Check, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** Module rule: "Start slow. After 3 times in a row without mistakes, go up 4 bpm." */
export const LADDER_STEP = 4;
const LADDER_CLEAN_RUNS = 3;

/** Tempo ladder: tick "No mistakes" after each clean run; three in a row raises the tempo by 4 bpm. */
export function TempoLadder({ bpm, onBpm, max = 220, best }: { bpm: number; onBpm: (bpm: number) => void; max?: number; best?: number }) {
  const t = useT();
  const [clean, setClean] = useState(0);

  function cleanRun() {
    const n = clean + 1;
    if (n >= LADDER_CLEAN_RUNS) {
      const next = Math.min(max, bpm + LADDER_STEP);
      onBpm(next);
      setClean(0);
      toast.success(t("3 times without mistakes: tempo up to {0} bpm!", next));
    } else setClean(n);
  }

  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <TrendingUp className="size-4 text-primary" /> {t("Tempo ladder")}
        </p>
        <Button variant="secondary" size="sm" onClick={() => onBpm(Math.min(max, bpm + LADDER_STEP))}>
          +{LADDER_STEP} bpm
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("Play the passage. 3 times in a row without mistakes = up 4 bpm.")}</p>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={cleanRun}>
          <Check className="text-success" /> {t("No mistakes")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setClean(0)}>
          <X className="text-danger" /> {t("Mistake")}
        </Button>
        <div className="ml-auto flex gap-1" aria-label={t("{0} of 3 clean runs", clean)}>
          {Array.from({ length: LADDER_CLEAN_RUNS }, (_, i) => (
            <span key={i} className={cn("size-3 rounded-full", i < clean ? "bg-success" : "bg-card ring-1 ring-input")} />
          ))}
        </div>
      </div>
      {best ? <p className="mt-2 text-xs text-muted-foreground">{t("Highest tempo this time: {0} bpm", best)}</p> : null}
    </div>
  );
}
