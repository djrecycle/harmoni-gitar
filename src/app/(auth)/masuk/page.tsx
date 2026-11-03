import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/session";
import { getT } from "@/i18n/server";
import { LoginForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign in") };
}

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const t = await getT();
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("Welcome back")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("Sign in to keep practising.")}</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">{t("No account yet? Ask your teacher for an invitation link.")}</p>
    </>
  );
}
