import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/misc";
import { dashboardPathFor, getCurrentUser } from "@/lib/session";
import { getT } from "@/i18n/server";
import { ChangePasswordForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Change password") };
}

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const t = await getT();
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("Change password")}</h1>
      {user.mustChangePassword ? (
        <Alert kind="warning" className="mt-4 mb-6">
          {t("Hello {0}! Before you start, replace the initial password from your teacher with your own.", user.name.split(" ")[0])}
        </Alert>
      ) : (
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("Your other devices will be signed out.")}</p>
      )}
      <ChangePasswordForm />
      {!user.mustChangePassword && (
        <p className="mt-6 text-center text-sm">
          <Link href={dashboardPathFor(user.role)} className="font-semibold text-primary hover:underline">
            {t("Cancel")}
          </Link>
        </p>
      )}
    </>
  );
}
