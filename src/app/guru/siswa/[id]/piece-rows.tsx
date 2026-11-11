"use client";

import { useState, useTransition } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { setPieceProgressByTeacher } from "@/app/actions/pieces";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Row = { id: string; title: string; stage: number; verified: boolean; bestBpm: number | null; stageBpm: Record<"1" | "2" | "3", number>; dates: Partial<Record<"1" | "2" | "3", string>> };

/** Teacher sets the stage a student reached on each piece, and marks it as checked. */
export function PieceRows({ studentId, rows }: { studentId: string; rows: Row[] }) {
  const t = useT();
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <PieceRow key={r.id} studentId={studentId} row={r} t={t} />
      ))}
    </ul>
  );
}

function PieceRow({ studentId, row, t }: { studentId: string; row: Row; t: ReturnType<typeof useT> }) {
  const [stage, setStage] = useState(row.stage);
  const [verified, setVerified] = useState(row.verified);
  const [pending, start] = useTransition();

  const save = (s: number, v: boolean) => {
    const before = { stage, verified };
    setStage(s);
    setVerified(v && s > 0);
    start(async () => {
      const r = await setPieceProgressByTeacher(studentId, row.id, s, v && s > 0);
      if (!r.ok) {
        setStage(before.stage);
        setVerified(before.verified);
        toast.error(r.error);
      }
    });
  };

  const latest = stage > 0 ? row.dates[String(stage) as "1" | "2" | "3"] : undefined;
  return (
    <li className={cn("grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-[1fr_auto] sm:items-center", pending && "opacity-70")}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{row.title}</p>
        <p className="text-xs text-muted-foreground">
          {[
            row.bestBpm ? t("best {0} bpm", row.bestBpm) : null,
            t("targets {0}/{1}/{2} bpm", row.stageBpm["1"], row.stageBpm["2"], row.stageBpm["3"]),
            latest ? t("stage {0} on {1}", stage, formatDay(latest)) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border bg-card" role="radiogroup" aria-label={t("Stage for {0}", row.title)}>
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stage === n}
              disabled={pending}
              onClick={() => save(n, n === stage ? verified : false)}
              className={cn("h-8 w-8 text-xs font-bold", stage === n ? (n === 0 ? "bg-muted-foreground/20" : "bg-success text-white") : "hover:bg-muted")}
              title={n === 0 ? t("Not started") : t("Stage {0}", n)}
            >
              {n === 0 ? "–" : n}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending || stage === 0}
          aria-pressed={verified}
          onClick={() => save(stage, !verified)}
          className={cn("inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold disabled:opacity-40", verified ? "border-success bg-success-soft text-success" : "bg-card hover:bg-muted")}
        >
          <BadgeCheck className="size-3.5" /> {verified ? t("Checked") : t("Check")}
        </button>
      </div>
    </li>
  );
}
