import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { CurrentUser } from "./session";

export const isUuid = (s: unknown): s is string => z.uuid().safeParse(s).success;

/** Is this student one of this teacher's students? */
export async function isTeacherOfStudent(teacherId: string, studentId: string) {
  const [r] = await db
    .select({ id: schema.studentProfile.userId })
    .from(schema.studentProfile)
    .where(and(eq(schema.studentProfile.userId, studentId), eq(schema.studentProfile.teacherId, teacherId)))
    .limit(1);
  return Boolean(r);
}

/** A student may see only their own data; a teacher only the data of their own students. */
export async function canAccessStudentData(user: Pick<CurrentUser, "id" | "role">, studentId: string) {
  if (user.id === studentId) return true;
  return user.role === "teacher" && (await isTeacherOfStudent(user.id, studentId));
}
