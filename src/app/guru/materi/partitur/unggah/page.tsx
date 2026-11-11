import type { Metadata } from "next";
import { UploadScoreForm } from "@/components/score/upload-form";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Upload a score") };
}

export default async function UploadScorePage() {
  await requireTeacher();
  return <UploadScoreForm piece={null} />;
}
