import Link from "next/link";
import { CalendarCheck, Music, Timer } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { dashboardPathFor, getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";

const FEATURES = [
  { Icon: Music, title: "Step-by-step lessons", content: "Four units: Basics, Technique 1, Etude 1, and Pieces. The next lesson opens when you finish the one before." },
  { Icon: Timer, title: "A daily practice routine", content: "About 35 minutes a day: warm-up, technique, etude, and a piece, with a timer and metronome." },
  { Icon: CalendarCheck, title: "Connected to your lessons", content: "Your schedule, your teacher's notes, and assignments, all in one place." },
];

export default async function Home() {
  const t = await getT();
  const [user, { studioName }] = await Promise.all([getCurrentUser(), getSettings()]);
  const target = user ? dashboardPathFor(user.role) : "/masuk";
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <Brand className="shrink-0" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-40 -right-20 size-[22rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 pt-12 pb-14 text-center sm:px-6 sm:pt-20 sm:pb-20">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">{studioName}</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            {t("Learn classical guitar,")} <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t("one step at a time")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground text-balance sm:text-lg">
            {t("A practice companion for private guitar students. Accounts are only made by invitation from your teacher.")}
          </p>
          <div className="mx-auto mt-8 flex max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={target}>{user ? t("Open dashboard") : t("Sign in")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {FEATURES.map(({ Icon, title, content }) => (
            <div key={title} className="flex gap-4 rounded-xl border bg-card p-4 shadow-xs sm:block sm:p-5">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary sm:mb-3">
                <Icon className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">{t(title)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t(content)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">{studioName}</footer>
    </div>
  );
}
