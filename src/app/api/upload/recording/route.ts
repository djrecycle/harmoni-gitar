import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isTeacherOfStudent } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";
import { ALLOWED_MIME, saveFile } from "@/lib/storage";
import { getT } from "@/i18n/server";

export const runtime = "nodejs";

const STUDENT_LIMIT_MB = 20;
const TEACHER_LIMIT_MB = 10;
/** Browsers name the same audio types differently. */
const ALIAS: Record<string, string> = { "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "video/webm": "audio/webm" };

/**
 * Upload an audio recording made in the browser (MediaRecorder). Returns its storage key; a server action then
 * attaches it (submitRecording / saveReview). Files go under recording/<studentId>/, readable only by that student
 * and their teacher (see /api/files):
 *  - a student uploads into their own folder;
 *  - a teacher uploads a voice comment into the folder of one of their students (form field `studentId`).
 */
export async function POST(req: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: t("Please sign in first.") }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: t("Invalid data") }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: t("The recording is empty. Try again.") }, { status: 400 });

  let owner = user.id;
  let prefix = "";
  if (user.role === "teacher") {
    const studentId = String(form.get("studentId") ?? "");
    if (!studentId || !(await isTeacherOfStudent(user.id, studentId))) return NextResponse.json({ error: t("Student not found.") }, { status: 403 });
    owner = studentId;
    prefix = "comment-";
  }
  const limit = (user.role === "teacher" ? TEACHER_LIMIT_MB : STUDENT_LIMIT_MB) * 1024 * 1024;
  if (file.size > limit) return NextResponse.json({ error: t("The recording is too big (max {0} MB).", limit / 1024 / 1024) }, { status: 413 });

  const raw = file.type.split(";")[0].trim().toLowerCase();
  const mime = ALIAS[raw] ?? raw;
  // The extension comes from the type, never from the file name.
  const ext = Object.entries(ALLOWED_MIME).find(([e, m]) => m === mime && mime.startsWith("audio/") && e !== "oga")?.[0];
  if (!ext) return NextResponse.json({ error: t("This audio type is not supported ({0}).", mime || "?") }, { status: 415 });

  const key = `recording/${owner}/${prefix}${randomUUID()}.${ext}`;
  await saveFile(key, Buffer.from(await file.arrayBuffer()), ALLOWED_MIME[ext]);
  return NextResponse.json({ key, mime: ALLOWED_MIME[ext] });
}
