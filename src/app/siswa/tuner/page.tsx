import type { Metadata } from "next";
import { Tuner } from "@/components/tuner/tuner";
import { PageHeader } from "@/components/ui/misc";
import { requireStudent } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tuner") };
}

export default async function TunerPage() {
  await requireStudent();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Guitar tuner")} description={t("Uses the microphone of your phone or laptop. Nothing is recorded or sent.")} />
      <Tuner />
    </>
  );
}
