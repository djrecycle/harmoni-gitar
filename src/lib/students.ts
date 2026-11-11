import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth, signupContext } from "./auth";
import { DEFAULT_ROUTINE, type RoutineSegments } from "./routine";
import { getSettings } from "./settings";
import { shortUsername } from "./username";

/*
 * Student accounts. Callers check the teacher role (or the invitation) first; these helpers only do the work.
 * An inactive student has `user.banned = true` (Better Auth refuses to start a session) and no sessions left.
 */

/** Students sign in with a username; Better Auth still needs a unique email, so they get one that is never sent to. */
export const placeholderEmail = (username: string) => `${username}@siswa.harmoni-gitar.local`;
export const isPlaceholderEmail = (email: string) => email.endsWith("@siswa.harmoni-gitar.local");

export async function usernameTaken(username: string): Promise<boolean> {
  const [r] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.username, username)).limit(1);
  return Boolean(r);
}

/** A free short username for a name, like "rizky_27" (more digits when the 2-digit ones run out). */
export async function suggestUsername(name: string): Promise<string> {
  for (let digits = 2; digits <= 4; digits++) {
    for (let i = 0; i < 8; i++) {
      const u = shortUsername(name, Math.random, digits);
      if (!(await usernameTaken(u))) return u;
    }
  }
  return shortUsername(name, Math.random, 6);
}

/** The first unit (always open for every student). */
async function firstUnitId(): Promise<string | null> {
  const [u] = await db.select({ id: schema.unit.id }).from(schema.unit).orderBy(asc(schema.unit.order)).limit(1);
  return u?.id ?? null;
}

/**
 * Create a student account + profile. `via` says who is allowed to create it (see SignupContext in auth.ts).
 * Throws an APIError from Better Auth when the account cannot be made.
 */
export async function createStudentAccount(input: {
  via: "invitation" | "teacher";
  teacherId: string;
  name: string;
  username: string;
  password: string;
  mustChangePassword: boolean;
}): Promise<string> {
  const res = await signupContext.run({ via: input.via, role: "student", mustChangePassword: input.mustChangePassword }, () =>
    auth.api.createUser({
      body: { name: input.name, email: placeholderEmail(input.username), password: input.password, data: { username: input.username } },
    }),
  );
  const userId = res.user.id;
  await db
    .insert(schema.studentProfile)
    .values({ userId, teacherId: input.teacherId, status: "active", currentUnitId: await firstUnitId(), startedAt: sql`(now() at time zone 'Asia/Jakarta')::date` })
    .onConflictDoNothing();
  return userId;
}

/** Turn a student's access on or off. Turning off signs them out everywhere; their data stays. */
export async function setStudentActive(studentId: string, active: boolean) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set(active ? { banned: false, banReason: null, banExpires: null } : { banned: true, banReason: "inactive", banExpires: null })
      .where(eq(schema.user.id, studentId));
    await tx.update(schema.studentProfile).set({ status: active ? "active" : "inactive" }).where(eq(schema.studentProfile.userId, studentId));
    if (!active) await tx.delete(schema.session).where(eq(schema.session.userId, studentId));
  });
}

/** Give a student a new initial password: they must change it at the next sign-in, and all their sessions end. */
export async function resetStudentPassword(studentId: string, password: string) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  await ctx.internalAdapter.updatePassword(studentId, hash);
  await db.update(schema.user).set({ mustChangePassword: true }).where(eq(schema.user.id, studentId));
  await db.delete(schema.session).where(eq(schema.session.userId, studentId));
}

export type StudentRow = {
  id: string;
  name: string;
  username: string | null;
  status: "active" | "inactive";
  mustChangePassword: boolean;
  startedAt: string | null;
  currentUnitTitle: string | null;
  createdAt: Date;
};

/** All students of a teacher, active first, then by name. */
export async function listStudents(teacherId: string): Promise<StudentRow[]> {
  const S = schema;
  return db
    .select({
      id: S.user.id,
      name: S.user.name,
      username: S.user.username,
      status: S.studentProfile.status,
      mustChangePassword: S.user.mustChangePassword,
      startedAt: S.studentProfile.startedAt,
      currentUnitTitle: S.unit.title,
      createdAt: S.user.createdAt,
    })
    .from(S.studentProfile)
    .innerJoin(S.user, eq(S.user.id, S.studentProfile.userId))
    .leftJoin(S.unit, eq(S.unit.id, S.studentProfile.currentUnitId))
    .where(eq(S.studentProfile.teacherId, teacherId))
    .orderBy(asc(S.studentProfile.status), asc(S.user.name));
}

/** IDs of a teacher's active students. */
export async function activeStudentIds(teacherId: string): Promise<string[]> {
  const rows = await db
    .select({ id: schema.studentProfile.userId })
    .from(schema.studentProfile)
    .where(and(eq(schema.studentProfile.teacherId, teacherId), eq(schema.studentProfile.status, "active")));
  return rows.map((r) => r.id);
}

/** A student with their profile, only when they belong to this teacher. */
export async function getStudentOfTeacher(teacherId: string, studentId: string) {
  const S = schema;
  const [r] = await db
    .select({ user: S.user, profile: S.studentProfile })
    .from(S.studentProfile)
    .innerJoin(S.user, eq(S.user.id, S.studentProfile.userId))
    .where(and(eq(S.studentProfile.userId, studentId), eq(S.studentProfile.teacherId, teacherId)))
    .limit(1);
  return r ?? null;
}

/** Practice timer minutes for this student: their own durations, or the studio default. */
export async function routineFor(studentId: string): Promise<{ routine: RoutineSegments; custom: boolean }> {
  const [p] = await db
    .select({ r: schema.studentProfile.routineSegments })
    .from(schema.studentProfile)
    .where(eq(schema.studentProfile.userId, studentId))
    .limit(1);
  if (p?.r) return { routine: { ...DEFAULT_ROUTINE, ...p.r }, custom: true };
  return { routine: (await getSettings()).routine, custom: false };
}

/** Names of several users at once. */
export async function namesOf(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}
