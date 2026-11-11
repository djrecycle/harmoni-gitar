"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { db, schema } from "@/db";
import { zodError } from "@/lib/action-result-server";
import { fail, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { findInvitation, hashInvitationToken } from "@/lib/invitation";
import { rateLimit } from "@/lib/ratelimit";
import { getCurrentUser } from "@/lib/session";
import { createStudentAccount, usernameTaken } from "@/lib/students";
import { usernameField } from "@/lib/username";
import { getT } from "@/i18n/server";

const acceptSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
    username: usernameField,
    fresh: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
    confirmText: z.string(),
  })
  .refine((v) => v.fresh === v.confirmText, { path: ["confirmText"], message: "Passwords do not match" });

/**
 * A student accepts an invitation: the invitation is claimed first in one atomic UPDATE (so one link can never
 * make two accounts), then the account is created inside the "invitation" sign-up context, then they are signed in.
 */
export async function acceptInvitation(token: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  if (await getCurrentUser()) return fail(t("You are already signed in. Sign out first to use this invitation."));

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = rateLimit(`invite:${ip}`, 10, 10 * 60 * 1000);
  if (!rate.boleh) return fail(t("Too many attempts. Try again later."), fd);

  const { invitation, state } = await findInvitation(token);
  if (!invitation || state !== "valid") return fail(t("This invitation link can no longer be used. Ask your teacher for a new one."));

  const p = acceptSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return zodError(p.error, fd);
  const { name, username, fresh } = p.data;
  if (await usernameTaken(username)) return { ...fail(t("That username is already taken."), fd), fieldErrors: { username: t("That username is already taken.") } };

  const I = schema.invitation;
  const [claimed] = await db
    .update(I)
    .set({ usedAt: new Date() })
    .where(and(eq(I.tokenHash, hashInvitationToken(token)), isNull(I.usedAt), isNull(I.revokedAt), gt(I.expiresAt, new Date())))
    .returning({ id: I.id, createdBy: I.createdBy });
  if (!claimed) return fail(t("This invitation link can no longer be used. Ask your teacher for a new one."));

  let userId: string;
  try {
    userId = await createStudentAccount({ via: "invitation", teacherId: claimed.createdBy, name, username, password: fresh, mustChangePassword: false });
  } catch (e) {
    // Give the invitation back so the student can try again with another username.
    await db.update(I).set({ usedAt: null }).where(eq(I.id, claimed.id));
    console.error("[acceptInvitation]", e);
    const m = e instanceof APIError ? String(e.body?.message ?? "") : "";
    return fail(/username/i.test(m) ? t("That username is already taken.") : t("Could not create the account."), fd);
  }
  await db.update(I).set({ usedBy: userId }).where(eq(I.id, claimed.id));

  try {
    await auth.api.signInUsername({ body: { username, password: fresh } });
  } catch (e) {
    console.error("[acceptInvitation] sign-in", e);
    redirect("/masuk");
  }
  redirect("/siswa?baru=1");
}
