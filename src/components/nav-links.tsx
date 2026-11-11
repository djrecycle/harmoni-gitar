"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Library, Music, Ellipsis, House, LayoutDashboard, LogOut, NotebookPen, Settings, Timer, Users, Waves, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Item = { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean };

/*
 * Only pages that exist are listed. Later stages add their items here; anything behind a feature flag
 * (e.g. /guru/pembayaran) must only be added when isFeatureEnabled() is true (pass it in from AppShell).
 */
const NAV: Record<"teacher" | "student", Item[]> = {
  teacher: [
    { href: "/guru", label: "Dashboard", Icon: LayoutDashboard, exact: true },
    { href: "/guru/siswa", label: "Students", Icon: Users },
    { href: "/guru/jadwal", label: "Schedule", Icon: CalendarDays },
    { href: "/guru/materi", label: "Materials", Icon: Library },
    { href: "/guru/pengaturan", label: "Settings", Icon: Settings },
  ],
  student: [
    { href: "/siswa", label: "Home", Icon: House, exact: true },
    { href: "/siswa/belajar", label: "Learn", Icon: BookOpen },
    { href: "/siswa/latihan", label: "Practice", Icon: Timer },
    { href: "/siswa/karya", label: "Pieces", Icon: Music },
    { href: "/siswa/jurnal", label: "Journal", Icon: NotebookPen },
    { href: "/siswa/jadwal", label: "Schedule", Icon: CalendarDays },
    { href: "/siswa/metronom", label: "Metronome", Icon: Waves },
  ],
};

/** Bottom bar on phones: up to this many items, the rest go into "Menu". */
const BOTTOM_MAX = 4;

function active(path: string, i: Item) {
  return i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
}

export function SidebarNav({ role }: { role: "teacher" | "student" }) {
  const t = useT();
  const path = usePathname();
  return (
    <nav aria-label={t("Main menu")} className="flex flex-col gap-1">
      {NAV[role].map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(path, i) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
            active(path, i) ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <i.Icon className="size-[1.1rem]" />
          {t(i.label)}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom navigation for phones: the main items + "Menu" holding the rest and Sign out. */
export function BottomNav({ role }: { role: "teacher" | "student" }) {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const all = NAV[role];
  const main = all.slice(0, BOTTOM_MAX);
  const remaining = all.slice(BOTTOM_MAX);
  const remainingActive = remaining.some((i) => active(path, i));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-label={t("More menu")}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t bg-card p-4 pb-24 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">{t("More menu")}</p>
              <button className="grid size-9 place-items-center rounded-lg hover:bg-muted" onClick={() => setOpen(false)} aria-label={t("Close")}>
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-1">
              {remaining.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold", active(path, i) ? "bg-primary-soft text-primary" : "hover:bg-muted")}
                >
                  <i.Icon className="size-5" />
                  {t(i.label)}
                </Link>
              ))}
              <form action={signOut}>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-danger hover:bg-danger-soft">
                  <LogOut className="size-5" /> {t("Sign out")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <nav
        aria-label={t("Bottom menu")}
        className="fixed inset-x-0 bottom-0 z-50 grid border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}
      >
        {main.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active(path, i) ? "page" : undefined}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[0.65rem] font-semibold", active(path, i) ? "text-primary" : "text-muted-foreground")}
          >
            <i.Icon className="size-5" />
            {t(i.label).split(" ")[0]}
          </Link>
        ))}
        <button
          onClick={() => setOpen((b) => !b)}
          className={cn("flex flex-col items-center gap-0.5 py-2 text-[0.65rem] font-semibold", remainingActive || open ? "text-primary" : "text-muted-foreground")}
        >
          <Ellipsis className="size-5" />
          {t("Menu")}
        </button>
      </nav>
    </>
  );
}
