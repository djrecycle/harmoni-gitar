import { z } from "zod";

/**
 * Minutes per segment of the daily practice routine. Warm-up, posture and the technique exercises are one segment
 * (the technique exercises are the warm-up); then the etude, then the piece (song).
 */
export type RoutineSegments = { warmup: number; etude: number; piece: number };

export const ROUTINE_KEYS = ["warmup", "etude", "piece"] as const;
export type RoutineKey = (typeof ROUTINE_KEYS)[number];

/** From the module: 5 minutes warm-up + 10 minutes technique, 10 etude, 10 piece (± 35 minutes a day). */
export const DEFAULT_ROUTINE: RoutineSegments = { warmup: 15, etude: 10, piece: 10 };

const minutes = z.coerce.number().int("Minutes must be a whole number").min(0, "Minutes cannot be negative").max(120, "At most 120 minutes per segment");

export const routineSchema = z.object({ warmup: minutes, etude: minutes, piece: minutes });

/** The segment a piece is practised in, from the kind of lesson that teaches it (null = not known, e.g. only assigned). */
export function segmentForLessonKind(kind: string | null | undefined): RoutineKey | null {
  if (!kind) return null;
  if (kind === "etude") return "etude";
  if (kind === "piece") return "piece";
  return "warmup"; // technique, and the exercises in theory lessons (e.g. time signatures)
}
