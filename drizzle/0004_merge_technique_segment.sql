-- The practice routine goes from 4 segments (warm-up, technique, etude, piece) to 3: the technique exercises are
-- now part of "warm-up, posture & technique". Fold every stored "technique" value into "warmup".

-- Default timer (minutes; a segment holds at most 120).
UPDATE "app_setting"
SET "value" = ("value" - 'technique') || jsonb_build_object('warmup', LEAST(120, COALESCE(("value"->>'warmup')::numeric, 5) + COALESCE(("value"->>'technique')::numeric, 0)))
WHERE "key" = 'routine' AND "value" ? 'technique';
--> statement-breakpoint
-- A student's own timer (minutes).
UPDATE "student_profile"
SET "routine_segments" = ("routine_segments" - 'technique') || jsonb_build_object('warmup', LEAST(120, COALESCE(("routine_segments"->>'warmup')::numeric, 5) + COALESCE(("routine_segments"->>'technique')::numeric, 0)))
WHERE "routine_segments" ? 'technique';
--> statement-breakpoint
-- Practice history (minutes actually spent).
UPDATE "practice_session"
SET "segments" = ("segments" - 'technique') || jsonb_build_object('warmup', COALESCE(("segments"->>'warmup')::numeric, 0) + COALESCE(("segments"->>'technique')::numeric, 0))
WHERE "segments" ? 'technique';
