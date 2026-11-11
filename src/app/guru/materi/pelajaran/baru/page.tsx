import type { Metadata } from "next";
import { LessonEditor } from "@/components/materials/lesson-editor";
import { lessonEditorOptions } from "@/lib/materials";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("New material") };
}

type Props = { searchParams: Promise<{ unit?: string; siswa?: string }> };

/** New material. `?unit=<id>` starts it in that unit, `?siswa=<id>` as extra material for that student. */
export default async function NewLessonPage({ searchParams }: Props) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  const options = await lessonEditorOptions(teacher.id);
  const unitId = options.units.some((u) => u.id === sp.unit) ? sp.unit! : null;
  const studentIds = options.students.some((s) => s.id === sp.siswa) ? [sp.siswa!] : [];
  return (
    <LessonEditor
      {...options}
      lesson={{ id: null, title: "", summary: "", kind: "technique", estimatedMinutes: null, published: true, unitId, blocks: [], studentIds }}
    />
  );
}
