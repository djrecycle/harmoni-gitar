import type { Metadata } from "next";
import { Metronome } from "@/components/metronome";
import { PageHeader } from "@/components/ui/misc";
import { requireStudent } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Metronome") };
}

export default async function MetronomePage() {
  await requireStudent();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Metronome")} description={t("Start at 60 bpm. After 3 times in a row without mistakes, go up 4 bpm.")} />
      <div className="max-w-md">
        <Metronome initialBpm={60} />
      </div>
    </>
  );
}
