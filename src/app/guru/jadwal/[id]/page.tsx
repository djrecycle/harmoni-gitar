import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteMeeting } from "@/app/actions/schedule";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { dayName, formatDay, isoDayOfWeek, shortTime, startOfWeek } from "@/lib/dates";
import { MEETING_STATUS_LABEL, MEETING_STATUS_TONE } from "@/lib/labels";
import { requireTeacher } from "@/lib/session";
import { getT } from "@/i18n/server";
import { EditMeetingForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Meeting") };
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const t = await getT();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ m: schema.meeting, studentName: schema.user.name })
    .from(schema.meeting)
    .innerJoin(schema.user, eq(schema.user.id, schema.meeting.studentId))
    .where(and(eq(schema.meeting.id, id), eq(schema.meeting.teacherId, teacher.id)))
    .limit(1);
  if (!row) notFound();
  const { m } = row;

  return (
    <>
      <Link href={`/guru/jadwal?minggu=${startOfWeek(m.date)}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("Schedule")}
      </Link>
      <PageHeader
        title={row.studentName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t(dayName(isoDayOfWeek(m.date)))}, {formatDay(m.date)} {shortTime(m.startTime)}
            <Badge tone={MEETING_STATUS_TONE[m.status]}>{t(MEETING_STATUS_LABEL[m.status])}</Badge>
            {m.originalDate && m.originalDate !== m.date && <Badge>{t("Moved from {0}", formatDay(m.originalDate))}</Badge>}
            {!m.slotId && <Badge>{t("Extra meeting")}</Badge>}
          </span>
        }
        action={
          <>
            <Link href={`/guru/siswa/${m.studentId}`} className="text-sm font-semibold text-primary hover:underline">
              {t("Student profile")}
            </Link>
            {!m.slotId && (
              <ActionButton action={deleteMeeting.bind(null, m.id)} confirm={t("Delete this meeting?")} variant="ghost" size="sm">
                <Trash2 /> {t("Delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-5">
          <EditMeetingForm
            key={m.updatedAt.toISOString()}
            id={m.id}
            values={{
              date: m.date,
              startTime: shortTime(m.startTime),
              status: m.status,
              material: m.material ?? "",
              teacherNote: m.teacherNote ?? "",
              privateNote: m.privateNote ?? "",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
