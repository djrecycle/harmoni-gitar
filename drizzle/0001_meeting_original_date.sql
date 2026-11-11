ALTER TABLE "meeting" ADD COLUMN "original_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_slot_original_date_unique" ON "meeting" USING btree ("slot_id","original_date");