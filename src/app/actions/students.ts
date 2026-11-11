"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { db, schema } from "@/db";
import { zodError } from "@/lib/action-result-server";
import { fail, succeed, type ActionResult } from "@/lib/action-result";
import { INVITATION_DAYS, hashInvitationToken, invitationUrl, newInvitationToken } from "@/lib/invitation";
import { generatePassword } from "@/lib/password";
import { routineSchema } from "@/lib/routine";
import { requireTeacher } from "@/lib/session";
import { createStudentAccount, getStudentOfTeacher, resetStudentPassword, setStudentActive, suggestUsername, usernameTaken } from "@/lib/students";
import { usernameField } from "@/lib/username";
import { getT } from "@/i18n/server";

const personName = z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long");
const password = z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long");

/* ---------------------------- Invitations ---------------------------- */

export type InvitationCreated = { name: string; url: string; expiresAt: string };

export async function createInvitation(_: ActionResult<InvitationCreated>, fd: FormData): Promise<ActionResult<InvitationCreated>> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = z.object({ name: personName }).safeParse({ name: fd.get("name") });
  if (!p.success) return zodError(p.error, fd);

  const token = newInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
  await db.insert(schema.invitation).values({ tokenHash: hashInvitationToken(token), role: "student", name: p.data.name, createdBy: teacher.id, expiresAt });
  refresh();
  return succeed(t("Invitation created."), { name: p.data.name, url: invitationUrl(token), expiresAt: expiresAt.toISOString() });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  if (!z.uuid().safeParse(id).success) return fail(t("Invitation not found."));
  const r = await db
    .update(schema.invitation)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.invitation.id, id), eq(schema.invitation.createdBy, teacher.id), isNull(schema.invitation.usedAt), isNull(schema.invitation.revokedAt)))
    .returning({ id: schema.invitation.id });
  if (!r.length) return fail(t("Invitation not found."));
  refresh();
  return succeed(t("Invitation cancelled."));
}

/* ------------------------ Teacher creates account ------------------------ */

export type AccountCreated = { studentId: string; name: string; username: string; password: string };

const createSchema = z.object({ name: personName, username: usernameField, password });

export async function createStudent(_: ActionResult<AccountCreated>, fd: FormData): Promise<ActionResult<AccountCreated>> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = createSchema.safeParse({ name: fd.get("name"), username: fd.get("username"), password: fd.get("password") });
  if (!p.success) return zodError(p.error, fd);
  const { name, username, password: pw } = p.data;
  if (await usernameTaken(username)) return { ...fail(t("That username is already taken."), fd), fieldErrors: { username: t("That username is already taken.") } };

  try {
    const studentId = await createStudentAccount({ via: "teacher", teacherId: teacher.id, name, username, password: pw, mustChangePassword: true });
    refresh();
    return succeed(t("Account created."), { studentId, name, username, password: pw });
  } catch (e) {
    console.error("[createStudent]", e);
    return fail(e instanceof APIError ? t("Could not create the account: {0}", String(e.body?.message ?? e.message)) : t("Could not create the account."), fd);
  }
}

/* --------------------------- Student profile --------------------------- */

async function ownStudent(studentId: string) {
  const teacher = await requireTeacher();
  if (!z.string().min(1).max(64).safeParse(studentId).success) return null;
  const s = await getStudentOfTeacher(teacher.id, studentId);
  return s ? { teacher, ...s } : null;
}

export async function setActive(studentId: string, active: boolean): Promise<ActionResult> {
  const t = await getT();
  const s = await ownStudent(studentId);
  if (!s) return fail(t("Student not found."));
  await setStudentActive(studentId, active);
  refresh();
  return succeed(active ? t("{0} is active again and can sign in.", s.user.name) : t("{0} is now inactive and has been signed out.", s.user.name));
}

const optionalYear = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int("Birth year must be a whole number").min(1930, "Birth year looks wrong").max(new Date().getFullYear(), "Birth year looks wrong").nullable(),
);
const optionalDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.iso.date("Invalid date").nullable());
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(max, "Text is too long").nullable());

const profileSchema = z.object({
  name: personName,
  birthYear: optionalYear,
  startedAt: optionalDate,
  guitarNotes: optionalText(300),
  teacherNotes: optionalText(2000),
  customRoutine: z.boolean(),
  routine: routineSchema.optional(),
});

export async function updateStudentProfile(studentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const s = await ownStudent(studentId);
  if (!s) return fail(t("Student not found."));
  const customRoutine = fd.get("customRoutine") === "on";
  const p = profileSchema.safeParse({
    name: fd.get("name"),
    birthYear: fd.get("birthYear"),
    startedAt: fd.get("startedAt"),
    guitarNotes: fd.get("guitarNotes"),
    teacherNotes: fd.get("teacherNotes"),
    customRoutine,
    routine: customRoutine ? { warmup: fd.get("warmup"), technique: fd.get("technique"), etude: fd.get("etude"), piece: fd.get("piece") } : undefined,
  });
  if (!p.success) return zodError(p.error, fd);
  const v = p.data;
  await db.transaction(async (tx) => {
    await tx.update(schema.user).set({ name: v.name }).where(eq(schema.user.id, studentId));
    await tx
      .update(schema.studentProfile)
      .set({
        birthYear: v.birthYear,
        startedAt: v.startedAt,
        guitarNotes: v.guitarNotes,
        teacherNotes: v.teacherNotes,
        routineSegments: v.customRoutine && v.routine ? v.routine : null,
      })
      .where(eq(schema.studentProfile.userId, studentId));
  });
  refresh();
  return succeed(t("Profile saved."));
}

export type PasswordReset = { username: string; password: string };

export async function resetPassword(studentId: string): Promise<ActionResult<PasswordReset>> {
  const t = await getT();
  const s = await ownStudent(studentId);
  if (!s) return fail(t("Student not found."));
  if (!s.user.username) return fail(t("This account has no username."));
  const pw = generatePassword(8);
  await resetStudentPassword(studentId, pw);
  refresh();
  return succeed(t("New initial password made."), { username: s.user.username, password: pw });
}

/** A free username suggestion for the "Create account" form. */
export async function suggestUsernameFor(name: string): Promise<string> {
  await requireTeacher();
  return suggestUsername(String(name).slice(0, 80));
}
