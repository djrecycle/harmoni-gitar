import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: "teacher" | "student";
  isAdmin: boolean;
  mustChangePassword: boolean;
};

/** The signed-in user for this request (cached per request), or null. A banned (inactive) account counts as signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; isAdmin?: boolean; mustChangePassword?: boolean; banned?: boolean | null; username?: string | null };
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username ?? null,
    role: u.role === "teacher" ? "teacher" : "student",
    isAdmin: Boolean(u.isAdmin),
    mustChangePassword: Boolean(u.mustChangePassword),
  };
});

export function dashboardPathFor(role: CurrentUser["role"]) {
  return role === "teacher" ? "/guru" : "/siswa";
}

/** Where to send a user right after signing in. */
export function homePathFor(user: Pick<CurrentUser, "role" | "mustChangePassword">) {
  return user.mustChangePassword ? "/ganti-sandi" : dashboardPathFor(user.role);
}

/** Any signed-in user. Someone who still has to change their initial password is sent to /ganti-sandi first. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/masuk");
  if (u.mustChangePassword) redirect("/ganti-sandi");
  return u;
}

/** Teacher-only pages & actions. Students are sent to their own home page. */
export async function requireTeacher(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "teacher") redirect("/siswa");
  return u;
}

/** Student-only pages & actions. Teachers are sent to their dashboard. */
export async function requireStudent(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "student") redirect("/guru");
  return u;
}
