import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonEditor } from "@/components/materials/lesson-editor";
import type { BlockType } from "@/lib/blocks";
import { getOwnLesson, lessonEditorOptions } from "@/lib/materials";
import { requireTeacher } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const teacher = await requireTeacher();
  const l = await getOwnLesson(teacher.id, (await params).id).catch(() => null);
  return { title: l?.title ?? "-" };
}

export default async function EditLessonPage({ params }: Props) {
  const teacher = await requireTeacher();
  const id = (await params).id;
  const l = /^[0-9a-f-]{36}$/i.test(id) ? await getOwnLesson(teacher.id, id) : null;
  if (!l || l.kind === "check") notFound();
  const options = await lessonEditorOptions(teacher.id);
  return (
    <LessonEditor
      {...options}
      lesson={{
        id: l.id,
        title: l.title,
        summary: l.summary ?? "",
        kind: l.kind,
        estimatedMinutes: l.estimatedMinutes,
        published: l.published,
        unitId: l.unitId,
        blocks: l.blocks.map((b) => ({ type: b.type as BlockType, data: b.data })),
        studentIds: l.studentIds,
      }}
    />
  );
}
