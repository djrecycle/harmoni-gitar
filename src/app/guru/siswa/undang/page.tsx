import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { INVITATION_DAYS } from "@/lib/invitation";
import { requireTeacher } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { InviteForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Invite a student") };
}

export default async function InvitePage() {
  await requireTeacher();
  const [t, { studioName }] = await Promise.all([getT(), getSettings()]);
  const local = (process.env.BETTER_AUTH_URL ?? "").includes("localhost");
  return (
    <>
      <Link href="/guru/siswa" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("Students")}
      </Link>
      <PageHeader title={t("Invite a student")} description={t("The link works once and is valid for {0} days. The student picks their own username and password.", INVITATION_DAYS)} />
      <InviteForm studioName={studioName} localOnly={local} />
    </>
  );
}
