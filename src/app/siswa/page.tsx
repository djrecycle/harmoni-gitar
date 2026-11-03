import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PasswordChangedNotice } from "@/components/password-changed-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireStudent } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Home") };
}

export default async function StudentHome({ searchParams }: { searchParams: Promise<{ sandi?: string }> }) {
  const [user, { studioName }, t, { sandi }] = await Promise.all([requireStudent(), getSettings(), getT(), searchParams]);
  return (
    <>
      <PasswordChangedNotice show={sandi === "diganti"} />
      <PageHeader title={t("Hello, {0}!", user.name.split(" ")[0])} description={t("Welcome to {0}.", studioName)} />
      <Card>
        <CardHeader>
          <CardTitle>{t("Get ready to practise")}</CardTitle>
          <CardDescription>{t("Your lessons, practice timer, and lesson schedule will appear here soon.")}</CardDescription>
        </CardHeader>
        <CardContent>
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
