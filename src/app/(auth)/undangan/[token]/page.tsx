import type { Metadata } from "next";
import Link from "next/link";
import { CircleX, MailOpen } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { findInvitation, type InvitationState } from "@/lib/invitation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { AcceptInvitationForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Invitation") };
}

const PROBLEM: Record<Exclude<InvitationState, "valid">, string> = {
  used: "This invitation link has already been used. If it was you, just sign in.",
  expired: "This invitation link has expired. Ask your teacher for a new one.",
  revoked: "This invitation link was cancelled by your teacher. Ask them for a new one.",
  missing: "This invitation link is not valid. Check that you copied all of it, or ask your teacher for a new one.",
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  const { token } = await params;
  const [{ invitation, state }, user, { studioName }] = await Promise.all([findInvitation(token), getCurrentUser(), getSettings()]);

  if (state !== "valid" || !invitation) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
          <CircleX className="size-7" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("Invitation cannot be used")}</h1>
        <p className="text-sm text-muted-foreground">{t(PROBLEM[state === "valid" ? "missing" : state])}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/masuk">{t("Sign in")}</Link>
        </Button>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("You are already signed in")}</h1>
        <p className="text-sm text-muted-foreground">{t("You are signed in as {0}. Sign out first, then open this link again to make the new account.", user.name)}</p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            {t("Sign out")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <MailOpen className="size-7" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("Welcome to {0}!", studioName)}</h1>
        <p className="text-sm text-muted-foreground">{t("Your teacher invited you. Make your account to start practising.")}</p>
      </div>
      <AcceptInvitationForm token={token} name={invitation.name} />
    </>
  );
}
