import type { Metadata } from "next";
import Link from "next/link";
import { MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Invitation") };
}

/** Placeholder: accepting invitations arrives in stage 1. The token is not read or checked yet. */
export default async function InvitationPage() {
  const t = await getT();
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <MailOpen className="size-7" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("Coming soon")}</h1>
      <p className="text-sm text-muted-foreground">{t("Signing up through an invitation link is not available yet. Please contact your teacher.")}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">{t("Back to home")}</Link>
      </Button>
    </div>
  );
}
