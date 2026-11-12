import { cache } from "react";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_ROUTINE, routineSchema, type RoutineSegments } from "./routine";

/*
 * Studio-wide settings in `app_setting` (one row per key, value = JSON object):
 *   "studio"   -> { name: string }                                    studio name shown in the app
 *   "routine"  -> { warmup, etude, piece }                            default practice timer (minutes)
 *   "features" -> { payments: boolean }                               feature flags (see features.ts)
 * A missing row or field falls back to the defaults below.
 */

export const DEFAULT_STUDIO_NAME = "Harmoni Gitar";

export type Features = { payments: boolean };
export const DEFAULT_FEATURES: Features = { payments: false };

export type Settings = { studioName: string; routine: RoutineSegments; features: Features };

const KEYS = ["studio", "routine", "features"] as const;

/** All settings, read once per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.select().from(schema.appSetting).where(inArray(schema.appSetting.key, [...KEYS]));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const studio = byKey.get("studio") ?? {};
  const name = typeof studio.name === "string" && studio.name.trim() ? studio.name.trim() : DEFAULT_STUDIO_NAME;

  const routine = routineSchema.safeParse({ ...DEFAULT_ROUTINE, ...byKey.get("routine") });

  const features = byKey.get("features") ?? {};
  return {
    studioName: name,
    routine: routine.success ? routine.data : DEFAULT_ROUTINE,
    features: { payments: features.payments === true },
  };
});

type Executor = Pick<typeof db, "insert">;

async function setSetting(tx: Executor, key: (typeof KEYS)[number], value: Record<string, unknown>, updatedBy: string) {
  await tx
    .insert(schema.appSetting)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({ target: schema.appSetting.key, set: { value, updatedBy, updatedAt: sql`now()` } });
}

/** Save all settings at once (teacher Settings page). Callers must check the teacher role first. */
export async function saveSettings(s: Settings, updatedBy: string) {
  await db.transaction(async (tx) => {
    await setSetting(tx, "studio", { name: s.studioName }, updatedBy);
    await setSetting(tx, "routine", { ...s.routine }, updatedBy);
    await setSetting(tx, "features", { ...s.features }, updatedBy);
  });
}
