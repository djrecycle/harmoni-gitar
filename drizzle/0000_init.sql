CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'submitted', 'reviewed', 'done');--> statement-breakpoint
CREATE TYPE "public"."check_level" AS ENUM('belum', 'hampir', 'sudah');--> statement-breakpoint
CREATE TYPE "public"."copyright_status" AS ENUM('public_domain', 'own_work', 'licensed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('unpaid', 'partial', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."lesson_block_type" AS ENUM('text', 'image', 'video', 'score', 'checklist', 'quiz', 'tip', 'focus', 'target');--> statement-breakpoint
CREATE TYPE "public"."lesson_kind" AS ENUM('theory', 'technique', 'etude', 'piece', 'check');--> statement-breakpoint
CREATE TYPE "public"."lesson_location" AS ENUM('studio', 'rumah_siswa', 'online');--> statement-breakpoint
CREATE TYPE "public"."lesson_progress_status" AS ENUM('locked', 'open', 'done');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'hadir', 'izin', 'sakit', 'alpa', 'batal_guru', 'pengganti');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('tunai', 'transfer', 'qris', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('teacher', 'student');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"student_id" text NOT NULL,
	"lesson_id" uuid,
	"piece_id" uuid,
	"target_stage" smallint,
	"target_bpm" smallint,
	"instructions" text,
	"due_date" date,
	"status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"lesson_block_id" uuid NOT NULL,
	"checked_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"role" "role" DEFAULT 'student' NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"period" text NOT NULL,
	"amount" integer NOT NULL,
	"due_date" date,
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_period_format" CHECK ("invoice"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "invoice_amount_nonnegative" CHECK ("invoice"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"order" smallint NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"kind" "lesson_kind" NOT NULL,
	"estimated_minutes" smallint,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"order" smallint NOT NULL,
	"type" "lesson_block_type" NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"lesson_id" uuid NOT NULL,
	"status" "lesson_progress_status" DEFAULT 'locked' NOT NULL,
	"opened_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"duration_minutes" smallint DEFAULT 60 NOT NULL,
	"location" "lesson_location" DEFAULT 'studio' NOT NULL,
	"active_from" date NOT NULL,
	"active_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_slot_day_range" CHECK ("lesson_slot"."day_of_week" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"slot_id" uuid,
	"date" date NOT NULL,
	"start_time" time,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"material" text,
	"teacher_note" text,
	"private_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"proof_file_key" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_amount_positive" CHECK ("payment"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "piece" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"composer" text,
	"music_xml_file_key" text,
	"default_bpm" smallint,
	"stage_bpm" jsonb,
	"time_signature" text,
	"copyright_status" "copyright_status" NOT NULL,
	"source_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piece_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "piece_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"piece_id" uuid NOT NULL,
	"stage" smallint DEFAULT 0 NOT NULL,
	"best_bpm" smallint,
	"stage_dates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"teacher_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piece_progress_stage_range" CHECK ("piece_progress"."stage" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "practice_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"segments" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"piece_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_bpm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mood" smallint,
	"difficulty" smallint,
	"student_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_session_mood_range" CHECK ("practice_session"."mood" is null or "practice_session"."mood" between 1 and 5),
	CONSTRAINT "practice_session_difficulty_range" CHECK ("practice_session"."difficulty" is null or "practice_session"."difficulty" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "recording" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"assignment_id" uuid,
	"piece_id" uuid,
	"file_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"duration_seconds" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"posture" smallint NOT NULL,
	"accuracy" smallint NOT NULL,
	"rhythm" smallint NOT NULL,
	"technique" smallint NOT NULL,
	"expression" smallint NOT NULL,
	"comment" text,
	"audio_comment_file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_scores_range" CHECK ("review"."posture" between 1 and 4 and "review"."accuracy" between 1 and 4 and "review"."rhythm" between 1 and 4 and "review"."technique" between 1 and 4 and "review"."expression" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"custom_price" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"status" "student_status" DEFAULT 'active' NOT NULL,
	"current_unit_id" uuid,
	"started_at" date,
	"birth_year" smallint,
	"guitar_notes" text,
	"teacher_notes" text,
	"routine_segments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuition_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price_per_month" integer,
	"price_per_meeting" integer,
	"meetings_per_month" smallint,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" smallint NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"color" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "unit_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"unit_check_item_id" uuid NOT NULL,
	"self_level" "check_level",
	"teacher_level" "check_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_check_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"order" smallint NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_unlock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"unit_id" uuid NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlocked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"username" text,
	"image" text,
	"role" "role" DEFAULT 'student' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_piece_id_piece_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."piece"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_state" ADD CONSTRAINT "checklist_state_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_state" ADD CONSTRAINT "checklist_state_lesson_block_id_lesson_block_id_fk" FOREIGN KEY ("lesson_block_id") REFERENCES "public"."lesson_block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_block" ADD CONSTRAINT "lesson_block_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_slot" ADD CONSTRAINT "lesson_slot_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_slot" ADD CONSTRAINT "lesson_slot_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_slot_id_lesson_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."lesson_slot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_progress" ADD CONSTRAINT "piece_progress_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_progress" ADD CONSTRAINT "piece_progress_piece_id_piece_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."piece"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording" ADD CONSTRAINT "recording_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording" ADD CONSTRAINT "recording_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording" ADD CONSTRAINT "recording_piece_id_piece_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."piece"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_recording_id_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_plan" ADD CONSTRAINT "student_plan_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_plan" ADD CONSTRAINT "student_plan_plan_id_tuition_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tuition_plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_current_unit_id_unit_id_fk" FOREIGN KEY ("current_unit_id") REFERENCES "public"."unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_check" ADD CONSTRAINT "unit_check_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_check" ADD CONSTRAINT "unit_check_unit_check_item_id_unit_check_item_id_fk" FOREIGN KEY ("unit_check_item_id") REFERENCES "public"."unit_check_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_check_item" ADD CONSTRAINT "unit_check_item_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_unlock" ADD CONSTRAINT "unit_unlock_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_unlock" ADD CONSTRAINT "unit_unlock_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_unlock" ADD CONSTRAINT "unit_unlock_unlocked_by_user_id_fk" FOREIGN KEY ("unlocked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assignment_student_idx" ON "assignment" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "assignment_teacher_idx" ON "assignment" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_state_unique" ON "checklist_state" USING btree ("student_id","lesson_block_id");--> statement-breakpoint
CREATE INDEX "invitation_created_by_idx" ON "invitation" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invoice_student_period_idx" ON "invoice" USING btree ("student_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_unit_slug_unique" ON "lesson" USING btree ("unit_id","slug");--> statement-breakpoint
CREATE INDEX "lesson_unit_order_idx" ON "lesson" USING btree ("unit_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_block_lesson_order_unique" ON "lesson_block" USING btree ("lesson_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_unique" ON "lesson_progress" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_slot_teacher_idx" ON "lesson_slot" USING btree ("teacher_id","day_of_week");--> statement-breakpoint
CREATE INDEX "lesson_slot_student_idx" ON "lesson_slot" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "meeting_teacher_date_idx" ON "meeting" USING btree ("teacher_id","date");--> statement-breakpoint
CREATE INDEX "meeting_student_date_idx" ON "meeting" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "payment_invoice_idx" ON "payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "piece_progress_unique" ON "piece_progress" USING btree ("student_id","piece_id");--> statement-breakpoint
CREATE INDEX "practice_session_student_started_idx" ON "practice_session" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recording_student_idx" ON "recording" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "review_recording_idx" ON "review" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_plan_student_idx" ON "student_plan" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_profile_teacher_idx" ON "student_profile" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_check_unique" ON "unit_check" USING btree ("student_id","unit_check_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_check_item_unit_order_unique" ON "unit_check_item" USING btree ("unit_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_unlock_unique" ON "unit_unlock" USING btree ("student_id","unit_id");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");