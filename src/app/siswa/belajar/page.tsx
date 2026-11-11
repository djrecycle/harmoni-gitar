import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock, Lock, PlayCircle } from "lucide-react";
import { Badge, PageHeader, Progress } from "@/components/ui/misc";
import { getUnitMap } from "@/lib/curriculum";
import { LESSON_KIND_LABEL } from "@/lib/labels";
import { requireStudent } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Learn") };
}

export default async function LearnMapPage() {
  const student = await requireStudent();
  const t = await getT();
  const map = await getUnitMap(student.id);

  return (
    <>
      <PageHeader title={t("Learning map")} description={t("Work through the lessons in order. The next lesson opens when you finish the one before.")} />
      <div className="grid gap-6">
        {map.map((u) => (
          <section key={u.id} className={cn("rounded-2xl border bg-card p-4 shadow-xs sm:p-5", !u.unlocked && "opacity-75")}>
            <div className="mb-3 flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white" style={{ background: u.color ?? "var(--primary)" }}>
                {u.unlocked ? u.order : <Lock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold">
                  {t("Unit {0}", u.order)} · {u.title}
                </h2>
                {u.description && <p className="text-sm text-muted-foreground">{u.description}</p>}
              </div>
            </div>
            {!u.unlocked ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("Locked. It opens after your teacher approves the unit check of the unit before.")}</p>
            ) : !u.lessons.length ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("The lessons of this unit are being prepared.")}</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <Progress value={(u.done / u.lessons.length) * 100} />
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {u.done}/{u.lessons.length}
                  </span>
                </div>
                <ol className="grid gap-1.5">
                  {u.lessons.map((l, i) => {
                    const inner = (
                      <>
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                            l.state === "done" ? "bg-success text-white" : l.state === "open" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {l.state === "done" ? <CircleCheck className="size-5" /> : l.state === "locked" ? <Lock className="size-4" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{l.title}</span>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            {t(LESSON_KIND_LABEL[l.kind])}
                            {l.estimatedMinutes && (
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="size-3" /> {l.estimatedMinutes}′
                              </span>
                            )}
                          </span>
                        </span>
                        {l.state === "open" && (
                          <Badge tone="primary" className="shrink-0">
                            <PlayCircle className="size-3.5" /> {t("Now")}
                          </Badge>
                        )}
                      </>
                    );
                    return (
                      <li key={l.id}>
                        {l.state === "locked" ? (
                          <div className="flex items-center gap-3 rounded-xl px-2 py-2 text-muted-foreground">{inner}</div>
                        ) : (
                          <Link
                            href={`/siswa/belajar/${u.slug}/${l.slug}`}
                            className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted", l.state === "open" && "bg-primary-soft hover:bg-primary-soft")}
                          >
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
