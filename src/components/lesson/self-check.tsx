"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setSelfLevel } from "@/app/actions/learning";
import { Badge } from "@/components/ui/misc";
import { CHECK_LEVEL_LABEL, CHECK_LEVELS, type CheckLevel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Item = { id: string; text: string; selfLevel: CheckLevel | null; teacherLevel: CheckLevel | null };

const LEVEL_STYLE: Record<CheckLevel, string> = {
  belum: "border-danger bg-danger-soft text-danger",
  hampir: "border-accent bg-warning-soft",
  sudah: "border-success bg-success-soft text-success",
};

/** Cek Unit: the student rates each skill Not yet / Almost / Got it. The teacher's level shows next to it once given. */
export function SelfCheck({ items, readOnly }: { items: Item[]; readOnly?: boolean }) {
  const t = useT();
  const [, start] = useTransition();
  const [levels, setLevels] = useOptimistic(
    new Map(items.map((i) => [i.id, i.selfLevel])),
    (m: Map<string, CheckLevel | null>, c: { id: string; level: CheckLevel }) => new Map(m).set(c.id, c.level),
  );

  const choose = (id: string, level: CheckLevel) =>
    start(async () => {
      setLevels({ id, level });
      const r = await setSelfLevel(id, level);
      if (!r.ok) toast.error(r.error);
    });

  return (
    <ol className="grid gap-2">
      {items.map((item, n) => (
        <li key={item.id} className="rounded-xl border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">
              <span className="mr-1.5 text-muted-foreground">{n + 1}.</span>
              {item.text}
            </p>
            {item.teacherLevel && (
              <Badge tone={item.teacherLevel === "sudah" ? "success" : item.teacherLevel === "hampir" ? "warning" : "danger"} className="shrink-0">
                {t("Teacher: {0}", t(CHECK_LEVEL_LABEL[item.teacherLevel]))}
              </Badge>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={item.text}>
            {CHECK_LEVELS.map((lv) => {
              const on = levels.get(item.id) === lv;
              return (
                <button
                  key={lv}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={readOnly}
                  onClick={() => choose(item.id, lv)}
                  className={cn("h-10 rounded-lg border text-sm font-semibold transition-colors", on ? LEVEL_STYLE[lv] : "hover:bg-muted", readOnly && "cursor-default")}
                >
                  {t(CHECK_LEVEL_LABEL[lv])}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
