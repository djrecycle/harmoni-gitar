import { CalendarCheck, Clock, Flame } from "lucide-react";
import { StatCard } from "@/components/ui/misc";
import { DAY_SHORT, formatDayShort } from "@/lib/dates";
import type { JournalEntry, PracticeStats } from "@/lib/practice";
import { GENERAL_BPM_KEY } from "@/lib/practice";
import { SEGMENT_LABEL } from "@/lib/labels";
import { ROUTINE_KEYS } from "@/lib/routine";
import { cn, formatDateTime, today } from "@/lib/utils";
import { getT } from "@/i18n/server";

/** Streak, minutes this week, and days this week. */
export async function PracticeStatCards({ stats, goalMinutes }: { stats: PracticeStats; goalMinutes: number }) {
  const t = await getT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label={t("Streak")} value={t("{0} days", stats.streak)} icon={<Flame />} keterangan={stats.streak ? t("Keep it going today!") : t("Practise today to start one.")} />
      <StatCard label={t("This week")} value={t("{0} min", stats.weekMinutes)} icon={<Clock />} keterangan={t("Goal: {0} min a day", goalMinutes)} />
      <StatCard label={t("Days practised")} value={`${stats.daysThisWeek}/7`} icon={<CalendarCheck />} keterangan={t("Monday to Sunday")} />
    </div>
  );
}

/** Mon–Sun bars for the current week; a day reaches full height at the daily goal. */
export async function WeekTracker({ stats, goalMinutes }: { stats: PracticeStats; goalMinutes: number }) {
  const t = await getT();
  const now = today();
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="mb-3 text-sm font-bold">{t("This week")}</p>
      <div className="grid grid-cols-7 items-end gap-1.5 sm:gap-3">
        {stats.week.map((d, i) => {
          const pct = goalMinutes ? Math.min(100, (d.minutes / goalMinutes) * 100) : d.minutes ? 100 : 0;
          const future = d.date > now;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-[0.65rem] font-semibold tabular-nums text-muted-foreground">{d.minutes ? `${d.minutes}′` : ""}</span>
              <div className={cn("relative h-24 w-full max-w-10 overflow-hidden rounded-lg bg-muted", future && "opacity-50")}>
                <div
                  className={cn("absolute inset-x-0 bottom-0 rounded-lg", pct >= 100 ? "bg-success" : "bg-gradient-to-t from-primary to-accent")}
                  style={{ height: `${d.minutes ? Math.max(8, pct) : 0}%` }}
                />
              </div>
              <span className={cn("text-xs font-semibold", d.date === now ? "text-primary" : "text-muted-foreground")}>{t(DAY_SHORT[i])}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t pt-3">
        {stats.lastWeeks.map((w, i) => (
          <div key={w.start} className="text-center">
            <p className="text-[0.65rem] text-muted-foreground">{i === 3 ? t("This week") : formatDayShort(w.start)}</p>
            <p className="text-sm font-bold tabular-nums">{w.minutes}′</p>
            <p className="text-[0.65rem] text-muted-foreground">{t("{0} days", w.days)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOODS = ["😫", "😕", "😐", "🙂", "😄"];

/** Journal entries (newest first). `renderDelete` adds a delete control for the student's own recent entries. */
export async function JournalList({ entries, renderDelete }: { entries: JournalEntry[]; renderDelete?: (e: JournalEntry) => React.ReactNode }) {
  const t = await getT();
  if (!entries.length) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("No practice recorded yet.")}</p>;
  return (
    <ul className="grid gap-2">
      {entries.map((e) => {
        const bpm = e.maxBpm?.[GENERAL_BPM_KEY];
        const segs = ROUTINE_KEYS.filter((k) => (e.segments?.[k] ?? 0) > 0);
        return (
          <li key={e.id} className="rounded-xl border bg-card p-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {formatDateTime(e.startedAt)} · {Math.round(e.totalSeconds / 60)} {t("min")}
                  {e.mood ? <span className="ml-1.5" title={t("Mood {0} of 5", e.mood)}>{MOODS[e.mood - 1]}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {segs.length ? segs.map((k) => `${t(SEGMENT_LABEL[k])} ${Math.round(e.segments[k]!)}′`).join(" · ") : t("Recorded by hand")}
                  {bpm ? ` · ${t("metronome up to {0} bpm", bpm)}` : ""}
                  {e.difficulty ? ` · ${t("difficulty {0}/5", e.difficulty)}` : ""}
                </p>
              </div>
              {renderDelete?.(e)}
            </div>
            {e.studentNote && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line">{e.studentNote}</p>}
          </li>
        );
      })}
    </ul>
  );
}
