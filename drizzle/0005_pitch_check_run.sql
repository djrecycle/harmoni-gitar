CREATE TABLE "pitch_check_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"piece_id" uuid NOT NULL,
	"bpm" smallint NOT NULL,
	"notes_right" smallint NOT NULL,
	"notes_total" smallint NOT NULL,
	"score" smallint NOT NULL,
	"loop_from" smallint,
	"loop_to" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pitch_check_run_counts" CHECK ("pitch_check_run"."notes_total" > 0 and "pitch_check_run"."notes_right" between 0 and "pitch_check_run"."notes_total" and "pitch_check_run"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "pitch_check_run" ADD CONSTRAINT "pitch_check_run_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_check_run" ADD CONSTRAINT "pitch_check_run_piece_id_piece_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."piece"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pitch_check_run_student_idx" ON "pitch_check_run" USING btree ("student_id","created_at");