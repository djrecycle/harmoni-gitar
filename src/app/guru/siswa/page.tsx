import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { ChevronRight, MailPlus, UserPlus, Users } from "lucide-react";
import { revokeInvitation } from "@/app/actions/students";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { daysSince, getPracticeStatsMany } from "@/lib/practice";
import { requireTeacher } from "@/lib/session";
import { listStudents } from "@/lib/students";
import { formatDate } from "@/lib/utils";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Students") };
}

export default async function StudentsPage() {
  const teacher = await requireTeacher();
  const t = await getT();
  const I = schema.invitation;
  const [students, invitations] = await Promise.all([
    listStudents(teacher.id),
    db
      .select()
      .from(I)
      .where(and(eq(I.createdBy, teacher.id), isNull(I.usedAt), isNull(I.revokedAt), gt(I.expiresAt, new Date())))
      .orderBy(desc(I.createdAt)),
  ]);
  const stats = await getPracticeStatsMany(students.map((s) => s.id));
  const active = students.filter((s) => s.status === "active");
  const inactive = students.filter((s) => s.status === "inactive");

  return (
    <>
      <PageHeader
        title={t("Students")}
        description={t("{0} active, {1} inactive.", active.length, inactive.length)}
        action={
          <>
            <Button asChild>
              <Link href="/guru/siswa/undang">
                <MailPlus /> {t("Invite")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/guru/siswa/baru">
                <UserPlus /> {t("Create account")}
              </Link>
            </Button>
          </>
        }
      />

      {invitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("Invitations not used yet")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{inv.name}</p>
                  <p className="text-xs text-muted-foreground">{t("Valid until {0}", formatDate(inv.expiresAt))}</p>
                </div>
                <ActionButton action={revokeInvitation.bind(null, inv.id)} confirm={t("Cancel the invitation for {0}? The link will stop working.", inv.name)} variant="ghost" size="sm">
                  {t("Cancel invitation")}
                </ActionButton>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("For safety a link is shown only once. Lost it? Cancel it and make a new one.")}</p>
          </CardContent>
        </Card>
      )}

      {students.length === 0 ? (
        <EmptyState icon={<Users />} title={t("No students yet")} action={<Button asChild><Link href="/guru/siswa/undang">{t("Invite the first student")}</Link></Button>}>
          {t("Send an invitation link over WhatsApp, or create an account with an initial password.")}
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {[
            { title: t("Active"), rows: active },
            { title: t("Inactive"), rows: inactive },
          ]
            .filter((g) => g.rows.length)
            .map((g) => (
              <section key={g.title}>
                <h2 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">{g.title}</h2>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {g.rows.map((s) => {
                    const st = stats.get(s.id)!;
                    const since = daysSince(st.lastPractice);
                    return (
                      <li key={s.id}>
                        <Link href={`/guru/siswa/${s.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/50">
                          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary">{s.name.trim().slice(0, 1).toUpperCase()}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{s.username} · {s.currentUnitTitle ?? "-"}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {s.status === "inactive" ? (
                                <Badge>{t("Inactive")}</Badge>
                              ) : since === null ? (
                                <Badge tone="warning">{t("Never practised")}</Badge>
                              ) : since >= 3 ? (
                                <Badge tone="danger">{t("No practice for {0} days", since)}</Badge>
                              ) : (
                                <Badge tone="success">{t("{0} min this week", st.weekMinutes)}</Badge>
                              )}
                              {s.mustChangePassword && <Badge tone="neutral">{t("Not signed in yet")}</Badge>}
                            </div>
                          </div>
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
