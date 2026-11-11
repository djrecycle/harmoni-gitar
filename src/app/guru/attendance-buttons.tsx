"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setAttendance } from "@/app/actions/schedule";
import { MEETING_STATUS_LABEL, type MeetingStatus } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const QUICK: MeetingStatus[] = ["hadir", "izin", "sakit", "alpa"];

/** One-tap attendance for today's meetings. */
export function AttendanceButtons({ id, status }: { id: string; status: MeetingStatus }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-wrap gap-1", pending && "opacity-60")}>
      {QUICK.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          aria-pressed={status === s}
          onClick={() =>
            start(async () => {
              const r = await setAttendance(id, status === s ? "scheduled" : s);
              if (!r.ok) toast.error(r.error);
            })
          }
          className={cn(
            "h-8 rounded-lg border px-2.5 text-xs font-semibold",
            status === s ? (s === "hadir" ? "border-success bg-success text-white" : s === "alpa" ? "border-danger bg-danger text-white" : "border-accent bg-accent text-accent-foreground") : "bg-card hover:bg-muted",
          )}
        >
          {t(MEETING_STATUS_LABEL[s])}
        </button>
      ))}
    </div>
  );
}
