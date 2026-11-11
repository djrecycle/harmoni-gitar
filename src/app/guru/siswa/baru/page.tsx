import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { generatePassword } from "@/lib/password";
import { requireTeacher } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { CreateStudentForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Create account") };
}

export default async function CreateStudentPage() {
  await requireTeacher();
  const [t, { studioName }] = await Promise.all([getT(), getSettings()]);
  return (
    <>
      <Link href="/guru/siswa" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("Students")}
      </Link>
      <PageHeader title={t("Create account")} description={t("For a student who cannot open an invitation link. They must change the initial password the first time they sign in.")} />
      <CreateStudentForm initialPassword={generatePassword(8)} studioName={studioName} signInUrl={`${(process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "")}/masuk`} />
    </>
  );
}
