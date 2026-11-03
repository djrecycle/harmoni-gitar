import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireTeacher } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { SettingsForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Settings") };
}

export default async function SettingsPage() {
  await requireTeacher();
  const [settings, t] = await Promise.all([getSettings(), getT()]);
  return (
    <>
      <PageHeader title={t("Settings")} description={t("Studio profile, default practice timer, and features.")} />
      <SettingsForm settings={settings} />
    </>
  );
}
