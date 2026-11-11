import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, isNotNull } from "drizzle-orm";
import { Eye, EyeOff, FilePlus2, Gift, Music, Pencil, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { LESSON_KIND_LABEL } from "@/lib/labels";
import { listAllPieces } from "@/lib/pieces";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Materials") };
}

const STATUS: Record<string, { label: string; tone: "success" | "primary" | "warning" | "danger" }> = {
  public_domain: { label: "Public domain", tone: "success" },
  own_work: { label: "Own work", tone: "primary" },
  licensed: { label: "Licensed", tone: "warning" },
  unknown: { label: "Unknown", tone: "danger" },
};

export default async function MaterialsPage() {
  const teacher = await requireTeacher();
  const t = await getT();
  const [units, lessons, pieces, assigned] = await Promise.all([
    db.select().from(schema.unit).orderBy(asc(schema.unit.order)),
    db.select().from(schema.lesson).orderBy(asc(schema.lesson.order)),
    listAllPieces(),
    db
      .select({ lessonId: schema.lessonStudent.lessonId, name: schema.user.name })
      .from(schema.lessonStudent)
      .innerJoin(schema.user, eq(schema.user.id, schema.lessonStudent.studentId))
      .where(isNotNull(schema.lessonStudent.lessonId))
      .orderBy(asc(schema.user.name)),
  ]);
  const extras = lessons.filter((l) => !l.unitId).reverse();
  const own = (l: { createdBy: string | null }) => l.createdBy === teacher.id;
  const lessonHref = (l: (typeof lessons)[number]) => (own(l) && l.kind !== "check" ? `/guru/materi/pelajaran/${l.id}` : `/guru/materi/pelajaran/${l.id}/pratinjau`);
  const myPieces = pieces.filter((p) => p.createdBy === teacher.id);
  const modulePieces = pieces.filter((p) => !p.createdBy);

  return (
    <>
      <PageHeader
        title={t("Materials")}
        description={t("Lessons and scores for your students. Material from the module comes from the content files; material you make here is yours to change.")}
        action={
          <>
            <Button asChild size="sm">
              <Link href="/guru/materi/pelajaran/baru">
                <FilePlus2 /> {t("New material")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/guru/materi/partitur/baru">
                <Music /> {t("Write a score")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/guru/materi/partitur/unggah">
                <Upload /> {t("Upload MusicXML")}
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-6">
          <section className="grid gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Gift className="size-4 text-accent" /> {t("Extra material ({0})", extras.length)}
            </h2>
            {!extras.length ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {t("Material for chosen students, outside the units: an extra exercise, a song they asked for…")}{" "}
                <Link href="/guru/materi/pelajaran/baru" className="font-semibold text-primary hover:underline">
                  {t("Make one")}
                </Link>
              </p>
            ) : (
              <ul className="grid gap-2">
                {extras.map((l) => {
                  const names = assigned.filter((a) => a.lessonId === l.id).map((a) => a.name);
                  return (
                    <li key={l.id}>
                      <Link href={lessonHref(l)} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/50">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{l.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{names.length ? names.join(", ") : t("Not given to any student yet")}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {t(LESSON_KIND_LABEL[l.kind])}
                          {l.published ? <Eye className="size-3.5 text-success" aria-label={t("Published")} /> : <EyeOff className="size-3.5" aria-label={t("Not published")} />}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="font-bold">{t("Units & lessons")}</h2>
            {units.map((u) => {
              const ls = lessons
                .filter((l) => l.unitId === u.id)
                .sort((a, b) => Number(a.kind === "check") - Number(b.kind === "check") || a.order - b.order);
              const published = ls.filter((l) => l.published).length;
              const mine = ls.filter(own).length;
              return (
                <Card key={u.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: u.color ?? "var(--primary)" }} />
                      {t("Unit {0}", u.order)} · {u.title}
                    </CardTitle>
                    <CardDescription>
                      {t("{0} of {1} lessons published", published, ls.length)}
                      {mine > 0 && ` · ${t("{0} made by you", mine)}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-primary">{t("Show lessons")}</summary>
                      <ol className="mt-2 grid gap-1 text-sm">
                        {ls.map((l) => (
                          <li key={l.id}>
                            <Link href={lessonHref(l)} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 odd:bg-muted hover:text-primary">
                              <span className="flex min-w-0 items-center gap-1.5">
                                {own(l) && <Pencil className="size-3.5 shrink-0 text-primary" aria-label={t("Made by you")} />}
                                <span className="truncate">{l.title}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                {t(LESSON_KIND_LABEL[l.kind])}
                                {l.published ? <Eye className="size-3.5 text-success" aria-label={t("Published")} /> : <EyeOff className="size-3.5" aria-label={t("Not published")} />}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </details>
                    <Link href={`/guru/materi/pelajaran/baru?unit=${u.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      <Plus className="size-4" /> {t("Add a lesson to this unit")}
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </div>

        <section id="partitur" className="grid scroll-mt-20 gap-3">
          <h2 className="font-bold">{t("Scores ({0})", pieces.length)}</h2>
          <p className="text-sm text-muted-foreground">{t("Only rewritten notation with a clear copyright status is shown to students. “Unknown” is always hidden.")}</p>
          {[
            { title: t("My scores"), list: myPieces, empty: t("Write a score in the editor or upload one from MuseScore.") },
            { title: t("From the module"), list: modulePieces, empty: "" },
          ].map((g) =>
            g.list.length || g.empty ? (
              <div key={g.title} className="grid gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{g.title}</h3>
                {!g.list.length ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{g.empty}</p>
                ) : (
                  <ul className="grid gap-2">
                    {g.list.map((p) => {
                      const s = STATUS[p.copyrightStatus] ?? STATUS.unknown;
                      return (
                        <li key={p.id}>
                          <Link href={`/guru/materi/partitur/${p.slug}`} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/50">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{p.title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {[p.composer, p.timeSignature, p.stageBpm ? `${p.stageBpm["1"]}/${p.stageBpm["2"]}/${p.stageBpm["3"]} bpm` : null, p.createdBy ? (p.scoreDoc ? t("Editor") : "MusicXML") : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <Badge tone={s.tone}>{t(s.label)}</Badge>
                              {!p.visible ? <Badge>{t("Hidden from students")}</Badge> : !p.usedIn ? <Badge>{t("Not in a lesson")}</Badge> : null}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null,
          )}
        </section>
      </div>
    </>
  );
}
