CREATE TABLE "lesson_student" (
	"lesson_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_student_lesson_id_student_id_pk" PRIMARY KEY("lesson_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "lesson" ALTER COLUMN "unit_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "piece" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "piece" ADD COLUMN "score_doc" jsonb;--> statement-breakpoint
ALTER TABLE "lesson_student" ADD CONSTRAINT "lesson_student_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_student" ADD CONSTRAINT "lesson_student_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_student_student_idx" ON "lesson_student" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece" ADD CONSTRAINT "piece_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_extra_slug_unique" ON "lesson" USING btree ("slug") WHERE "lesson"."unit_id" is null;