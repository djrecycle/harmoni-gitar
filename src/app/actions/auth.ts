"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { db, schema } from "@/db";
import { zodError } from "@/lib/action-result-server";
import { fail, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { dashboardPathFor, getCurrentUser, homePathFor } from "@/lib/session";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";

const password = z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long");

function apiErrorMessage(e: unknown, fallback: string, t: Translate) {
  if (e instanceof APIError) {
    const code = String(e.body?.code ?? "");
    const m = String(e.body?.message ?? e.message ?? "");
    if (code === "BANNED_USER") return t("This account is inactive. Contact your teacher.");
    if (/invalid (email|username) or password|credential/i.test(m)) return t("Incorrect email/username or password.");
    if (/password/i.test(m)) return t("The password is not acceptable or is incorrect.");
  }
  console.error("[auth]", e);
  return fallback;
}

/* ----------------------------- Sign in ------------------------------ */

// Teachers usually sign in with an email, students with a username; the field accepts either.
const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Enter your email or username").max(200),
  password: z.string().min(1, "Enter your password"),
});

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const p = loginSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return zodError(p.error, fd);
  const { identifier, password } = p.data;
  const isEmail = identifier.includes("@");

  const rate = rateLimit(`login:${identifier}`, 8, 10 * 60 * 1000);
  if (!rate.boleh) return fail(t("Too many sign-in attempts. Try again in {0} minutes.", Math.ceil(rate.secondsWait / 60)), fd);

  try {
    if (isEmail) await auth.api.signInEmail({ body: { email: identifier, password } });
    else await auth.api.signInUsername({ body: { username: identifier, password } });
  } catch (e) {
    return fail(apiErrorMessage(e, t("Sign-in failed. Try again."), t), fd);
  }
  const [u] = await db
    .select({ role: schema.user.role, mustChangePassword: schema.user.mustChangePassword })
    .from(schema.user)
    .where(isEmail ? eq(schema.user.email, identifier) : eq(schema.user.username, identifier))
    .limit(1);
  redirect(u ? homePathFor(u) : "/");
}

export async function signOut() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    /* the session no longer exists */
  }
  redirect("/");
}

/* -------------------------- Change password ------------------------- */

const changePasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), fresh: password, confirmText: z.string() })
  .refine((v) => v.fresh === v.confirmText, { path: ["confirmText"], message: "Passwords do not match" })
  .refine((v) => v.fresh !== v.current, { path: ["fresh"], message: "The new password must be different from the current one" });

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const p = changePasswordSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return zodError(p.error, fd);
  const rate = rateLimit(`change-password:${user.id}`, 6, 10 * 60 * 1000);
  if (!rate.boleh) return fail(t("Too many attempts. Try again later."));
  try {
    await auth.api.changePassword({
      body: { currentPassword: p.data.current, newPassword: p.data.fresh, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (e) {
    return fail(apiErrorMessage(e, t("Could not change the password."), t));
  }
  if (user.mustChangePassword) await db.update(schema.user).set({ mustChangePassword: false }).where(eq(schema.user.id, user.id));
  redirect(`${dashboardPathFor(user.role)}?sandi=diganti`);
}
