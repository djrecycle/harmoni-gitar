"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { succeed, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/session";

const N = schema.notification;

/** Mark one of the user's own notifications as read. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (z.uuid().safeParse(id).success) await db.update(N).set({ readAt: new Date() }).where(and(eq(N.id, id), eq(N.userId, user.id), isNull(N.readAt)));
  refresh();
  return succeed();
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser();
  await db.update(N).set({ readAt: new Date() }).where(and(eq(N.userId, user.id), isNull(N.readAt)));
  refresh();
  return succeed();
}
