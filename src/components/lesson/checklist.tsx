"use client";

import { useState } from "react";
import { Check, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { toggleChecklistItem } from "@/app/actions/learning";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** A checklist the student ticks; each tick is saved right away. `readOnly` for the teacher's view. */
export function Checklist({ blockId, title, items, checked, readOnly }: { blockId: string; title?: string; items: string[]; checked: number[]; readOnly?: boolean }) {
  const t = useT();
  // Local state (not useOptimistic): the page is not re-rendered after a tick, so an optimistic value would snap back.
  const [ticks, setTicks] = useState(() => new Set(checked));

  const flip = (i: number, on: boolean) =>
    setTicks((s) => {
      const n = new Set(s);
      if (on) n.add(i);
      else n.delete(i);
      return n;
    });

  const toggle = async (i: number) => {
    if (readOnly) return;
    const on = !ticks.has(i);
    flip(i, on);
    const r = await toggleChecklistItem(blockId, i, on);
    if (!r.ok) {
      flip(i, !on);
      toast.error(r.error);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold">
          <ListChecks className="size-5 text-primary" /> {title ?? t("Checklist")}
        </p>
        <span className="text-xs font-semibold text-muted-foreground">
          {ticks.size}/{items.length}
        </span>
      </div>
      <ul className="grid gap-1.5">
        {items.map((item, i) => {
          const on = ticks.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={readOnly}
                onClick={() => toggle(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  on ? "bg-success-soft" : "bg-muted hover:brightness-[0.98]",
                  readOnly && "cursor-default",
                )}
              >
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2", on ? "border-success bg-success text-white" : "border-input bg-card")}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className={cn(on && "text-muted-foreground")}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
