import { z } from "zod";

/** Minutes per segment of the daily practice routine (warm-up & posture, technique, etude, piece). */
export type RoutineSegments = { warmup: number; technique: number; etude: number; piece: number };

export const ROUTINE_KEYS = ["warmup", "technique", "etude", "piece"] as const;

/** Default from the module: 5/10/10/10 minutes (± 35 minutes a day). */
export const DEFAULT_ROUTINE: RoutineSegments = { warmup: 5, technique: 10, etude: 10, piece: 10 };

const minutes = z.coerce.number().int("Minutes must be a whole number").min(0, "Minutes cannot be negative").max(120, "At most 120 minutes per segment");

export const routineSchema = z.object({ warmup: minutes, technique: minutes, etude: minutes, piece: minutes });
