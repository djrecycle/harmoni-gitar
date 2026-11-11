import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** How long an invitation link stays valid. */
export const INVITATION_DAYS = 7;

/** A new random token (32 bytes, URL-safe). Only its hash is stored; the token itself is shown to the teacher once. */
export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The link a teacher sends, based on BETTER_AUTH_URL (change it when moving to a real domain). */
export function invitationUrl(token: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  return `${base}/undangan/${token}`;
}

export type InvitationState = "valid" | "used" | "expired" | "revoked" | "missing";

export type InvitationRow = typeof schema.invitation.$inferSelect;

export function invitationState(inv: InvitationRow | undefined, now = new Date()): InvitationState {
  if (!inv) return "missing";
  if (inv.revokedAt) return "revoked";
  if (inv.usedAt) return "used";
  if (inv.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** Look up an invitation by the token from the link. */
export async function findInvitation(token: string): Promise<{ invitation?: InvitationRow; state: InvitationState }> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { state: "missing" };
  const [inv] = await db.select().from(schema.invitation).where(eq(schema.invitation.tokenHash, hashInvitationToken(token))).limit(1);
  return { invitation: inv, state: invitationState(inv) };
}
