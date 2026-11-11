import type { Metadata } from "next";
import { ScoreEditor } from "@/components/score/editor/score-editor";
import { emptyDoc } from "@/lib/score/doc";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("New score") };
}

export default async function NewScorePage() {
  await requireTeacher();
  return (
    <ScoreEditor
      pieceId={null}
      initialDoc={emptyDoc()}
      initialMeta={{ title: "", composer: "", stage1: 50, stage2: 65, stage3: 80, copyrightStatus: "own_work", sourceNote: "" }}
    />
  );
}
