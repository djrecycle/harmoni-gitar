import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

/*
 * In-app notifications. `type` decides the (translated) title shown; `body` holds the details (a piece title, a
 * student's name…) and `link` where a tap goes. Notifications are best-effort: a failure never breaks the action.
 */

export const NOTIFICATION_TITLE: Record<string, string> = {
  assignment_new: "New assignment",
  recording_submitted: "New recording to review",
  recording_reviewed: "Your recording has been reviewed",
  assignment_done: "Assignment marked as done",
};

export async function notify(userIds: string | string[], n: { type: keyof typeof NOTIFICATION_TITLE; body?: string; link?: string }) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return;
  try {
    await db.insert(schema.notification).values(ids.map((userId) => ({ userId, type: n.type, title: NOTIFICATION_TITLE[n.type], body: n.body ?? null, link: n.link ?? null })));
  } catch (e) {
    console.error("[notify]", e);
  }
}

export async function unreadCount(userId: string) {
  const N = schema.notification;
  const [r] = await db.select({ n: count() }).from(N).where(and(eq(N.userId, userId), isNull(N.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(userId: string, limit = 50) {
  const N = schema.notification;
  return db.select().from(N).where(eq(N.userId, userId)).orderBy(desc(N.createdAt)).limit(limit);
}

/** Opening the page a notification points at counts as reading it (called while rendering that page). */
export async function markReadByLink(userId: string, link: string) {
  const N = schema.notification;
  await db.update(N).set({ readAt: new Date() }).where(and(eq(N.userId, userId), eq(N.link, link), isNull(N.readAt)));
}
