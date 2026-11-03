import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Settings } from "lucide-react";
import { PasswordChangedNotice } from "@/components/password-changed-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireTeacher } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Dashboard") };
}

export default async function TeacherDashboard({ searchParams }: { searchParams: Promise<{ sandi?: string }> }) {
  const [user, { studioName }, t, { sandi }] = await Promise.all([requireTeacher(), getSettings(), getT(), searchParams]);
  return (
    <>
      <PasswordChangedNotice show={sandi === "diganti"} />
      <PageHeader title={t("Welcome, {0}!", user.name)} description={t("This is the dashboard of {0}.", studioName)} />
      <Card>
        <CardHeader>
          <CardTitle>{t("The foundation is ready")}</CardTitle>
          <CardDescription>
            {t("Today's meetings, recordings waiting for review, and students who have not practised will appear here in the next stages.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/guru/pengaturan">
              <Settings /> {t("Studio settings")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/ganti-sandi">
              <KeyRound /> {t("Change password")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
