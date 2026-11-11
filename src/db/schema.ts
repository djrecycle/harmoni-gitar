import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RoutineSegments } from "@/lib/routine";

/*
 * Database schema, following docs/RENCANA_TEKNIS.md section 5.
 * Table/column names are English; display labels live in the i18n dictionary.
 * Money is always stored as whole rupiah (integer).
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["teacher", "student"]);
export const studentStatusEnum = pgEnum("student_status", ["active", "inactive"]);
export const lessonKindEnum = pgEnum("lesson_kind", ["theory", "technique", "etude", "piece", "check"]);
export const lessonBlockTypeEnum = pgEnum("lesson_block_type", [
  "text",
  "image",
  "video",
  "score",
  "checklist",
  "quiz",
  "tip",
  "focus",
  "target",
]);
export const copyrightStatusEnum = pgEnum("copyright_status", ["public_domain", "own_work", "licensed", "unknown"]);
export const lessonProgressStatusEnum = pgEnum("lesson_progress_status", ["locked", "open", "done"]);
export const checkLevelEnum = pgEnum("check_level", ["belum", "hampir", "sudah"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["assigned", "submitted", "reviewed", "done"]);
export const lessonLocationEnum = pgEnum("lesson_location", ["studio", "rumah_siswa", "online"]);
export const meetingStatusEnum = pgEnum("meeting_status", [
  "scheduled",
  "hadir",
  "izin",
  "sakit",
  "alpa",
  "batal_guru",
  "pengganti",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["unpaid", "partial", "paid", "void"]);
export const paymentMethodEnum = pgEnum("payment_method", ["tunai", "transfer", "qris", "lainnya"]);

export type Role = (typeof roleEnum.enumValues)[number];

/* ------------------------------------------------------------------ */
/* 5.1 Accounts & people (auth tables follow Better Auth)              */
/* ------------------------------------------------------------------ */

/** The password hash lives in `account` (managed by Better Auth). */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Students without an email get a placeholder address that is never sent to; they sign in with `username`. */
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    username: text("username").unique(),
    image: text("image"),
    role: roleEnum("role").notNull().default("student"),
    /** The first teacher (created with `npm run setup:teacher`) is the main admin. */
    isAdmin: boolean("is_admin").notNull().default(false),
    /** Set on accounts a teacher creates with an initial password: the student must pick a new one on first sign-in. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    // Used by Better Auth's `admin` plugin. `banned = true` is how an inactive student is kept from signing in.
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("user_role_idx").on(t.role)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Required by the `admin` plugin schema; unused (this app never impersonates). */
    impersonatedBy: text("impersonated_by"),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const studentProfile = pgTable(
  "student_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: studentStatusEnum("status").notNull().default("active"),
    /** The unit the student is currently working on. */
    currentUnitId: uuid("current_unit_id").references(() => unit.id, { onDelete: "set null" }),
    startedAt: date("started_at"),
    birthYear: smallint("birth_year"),
    /** E.g. guitar size. */
    guitarNotes: text("guitar_notes"),
    /** Private teacher notes, never shown to the student. */
    teacherNotes: text("teacher_notes"),
    /** Practice timer durations just for this student; null = use the studio default (app_setting `routine`). */
    routineSegments: jsonb("routine_segments").$type<RoutineSegments>(),
    ...timestamps,
  },
  (t) => [index("student_profile_teacher_idx").on(t.teacherId, t.status)],
);

/** One-time invitation link. Only the SHA-256 hash of the token is stored. */
export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    role: roleEnum("role").notNull().default("student"),
    /** Name of the person being invited (pre-filled on the sign-up form). */
    name: text("name").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("invitation_created_by_idx").on(t.createdBy)],
);

/* ------------------------------------------------------------------ */
/* 5.2 Curriculum (seeded from content/units/*.json)                   */
/* ------------------------------------------------------------------ */

export const unit = pgTable("unit", {
  id: uuid("id").primaryKey().defaultRandom(),
  order: smallint("order").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  color: text("color"),
  description: text("description"),
  ...timestamps,
});

export const lesson = pgTable(
  "lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" }),
    order: smallint("order").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    kind: lessonKindEnum("kind").notNull(),
    estimatedMinutes: smallint("estimated_minutes"),
    published: boolean("published").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("lesson_unit_slug_unique").on(t.unitId, t.slug), index("lesson_unit_order_idx").on(t.unitId, t.order)],
);

/** One content block of a lesson. The shape of `data` depends on `type` (see content/README.md). */
export const lessonBlock = pgTable(
  "lesson_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    order: smallint("order").notNull(),
    type: lessonBlockTypeEnum("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  // Unique per position so re-seeding updates a block in place (students' checklist ticks keep pointing at it).
  (t) => [uniqueIndex("lesson_block_lesson_order_unique").on(t.lessonId, t.order)],
);

/** A piece/exercise with rewritten MusicXML notation. Never a scan from the source book. */
export const piece = pgTable("piece", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stable name used by content files (content/pieces/<slug>.*). */
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  composer: text("composer"),
  musicXmlFileKey: text("music_xml_file_key"),
  defaultBpm: smallint("default_bpm"),
  /** Target tempo per stage: { "1": 60, "2": 80, "3": 100 } (Pelan, Sedang, Tempo asli). */
  stageBpm: jsonb("stage_bpm").$type<Record<"1" | "2" | "3", number>>(),
  timeSignature: text("time_signature"),
  copyrightStatus: copyrightStatusEnum("copyright_status").notNull(),
  sourceNote: text("source_note"),
  ...timestamps,
});

/** One "Cek Unit" skill (e.g. the 12 skills of Unit 1). */
export const unitCheckItem = pgTable(
  "unit_check_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" }),
    order: smallint("order").notNull(),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("unit_check_item_unit_order_unique").on(t.unitId, t.order)],
);

/* ------------------------------------------------------------------ */
/* 5.3 Student progress                                                */
/* ------------------------------------------------------------------ */

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    status: lessonProgressStatusEnum("status").notNull().default("locked"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("lesson_progress_unique").on(t.studentId, t.lessonId)],
);

export const checklistState = pgTable(
  "checklist_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonBlockId: uuid("lesson_block_id")
      .notNull()
      .references(() => lessonBlock.id, { onDelete: "cascade" }),
    /** Indexes of the ticked checklist items. */
    checkedItems: jsonb("checked_items").$type<number[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [uniqueIndex("checklist_state_unique").on(t.studentId, t.lessonBlockId)],
);

export const pieceProgress = pgTable(
  "piece_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => piece.id, { onDelete: "cascade" }),
    /** 0 = not started, 1 = Pelan, 2 = Sedang, 3 = Tempo asli. */
    stage: smallint("stage").notNull().default(0),
    bestBpm: smallint("best_bpm"),
    /** When each stage was reached: { "1": "2026-11-03", ... }. */
    stageDates: jsonb("stage_dates").$type<Partial<Record<"1" | "2" | "3", string>>>().notNull().default({}),
    teacherVerified: boolean("teacher_verified").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("piece_progress_unique").on(t.studentId, t.pieceId),
    check("piece_progress_stage_range", sql`${t.stage} between 0 and 3`),
  ],
);

export const unitCheck = pgTable(
  "unit_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    unitCheckItemId: uuid("unit_check_item_id")
      .notNull()
      .references(() => unitCheckItem.id, { onDelete: "cascade" }),
    selfLevel: checkLevelEnum("self_level"),
    teacherLevel: checkLevelEnum("teacher_level"),
    ...timestamps,
  },
  (t) => [uniqueIndex("unit_check_unique").on(t.studentId, t.unitCheckItemId)],
);

/** A unit opened for a student: after the teacher approves the previous Cek Unit, or opened by hand. */
export const unitUnlock = pgTable(
  "unit_unlock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    unlockedBy: text("unlocked_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("unit_unlock_unique").on(t.studentId, t.unitId)],
);

/* ------------------------------------------------------------------ */
/* 5.4 Practice & journal                                              */
/* ------------------------------------------------------------------ */

/** One practice session. The journal, streak and weekly tracker are all computed from this table. */
export const practiceSession = pgTable(
  "practice_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    totalSeconds: integer("total_seconds").notNull().default(0),
    /** Minutes actually spent per segment. */
    segments: jsonb("segments").$type<Partial<RoutineSegments>>().notNull().default({}),
    pieceIds: jsonb("piece_ids").$type<string[]>().notNull().default([]),
    /** Highest bpm reached per piece: { [pieceId]: bpm }. */
    maxBpm: jsonb("max_bpm").$type<Record<string, number>>().notNull().default({}),
    mood: smallint("mood"),
    difficulty: smallint("difficulty"),
    studentNote: text("student_note"),
    ...timestamps,
  },
  (t) => [
    index("practice_session_student_started_idx").on(t.studentId, t.startedAt),
    check("practice_session_mood_range", sql`${t.mood} is null or ${t.mood} between 1 and 5`),
    check("practice_session_difficulty_range", sql`${t.difficulty} is null or ${t.difficulty} between 1 and 5`),
  ],
);

/* ------------------------------------------------------------------ */
/* 5.5 Assignments, recordings, reviews                                */
/* ------------------------------------------------------------------ */

export const assignment = pgTable(
  "assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lesson.id, { onDelete: "set null" }),
    pieceId: uuid("piece_id").references(() => piece.id, { onDelete: "set null" }),
    targetStage: smallint("target_stage"),
    targetBpm: smallint("target_bpm"),
    instructions: text("instructions"),
    dueDate: date("due_date"),
    status: assignmentStatusEnum("status").notNull().default("assigned"),
    ...timestamps,
  },
  (t) => [index("assignment_student_idx").on(t.studentId, t.status), index("assignment_teacher_idx").on(t.teacherId, t.status)],
);

export const recording = pgTable(
  "recording",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => assignment.id, { onDelete: "set null" }),
    pieceId: uuid("piece_id").references(() => piece.id, { onDelete: "set null" }),
    /** Storage key `recording/<studentId>/<file>`; served only through /api/files after an access check. */
    fileKey: text("file_key").notNull(),
    mimeType: text("mime_type").notNull(),
    durationSeconds: integer("duration_seconds"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("recording_student_idx").on(t.studentId)],
);

/** Rubric review of a recording: 5 aspects, each 1–4 (as in the module). */
export const review = pgTable(
  "review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    posture: smallint("posture").notNull(),
    accuracy: smallint("accuracy").notNull(),
    rhythm: smallint("rhythm").notNull(),
    technique: smallint("technique").notNull(),
    expression: smallint("expression").notNull(),
    comment: text("comment"),
    audioCommentFileKey: text("audio_comment_file_key"),
    ...timestamps,
  },
  (t) => [
    index("review_recording_idx").on(t.recordingId),
    check(
      "review_scores_range",
      sql`${t.posture} between 1 and 4 and ${t.accuracy} between 1 and 4 and ${t.rhythm} between 1 and 4 and ${t.technique} between 1 and 4 and ${t.expression} between 1 and 4`,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 5.6 Private lessons: schedule & meetings                            */
/* ------------------------------------------------------------------ */

/** A fixed weekly lesson time. `dayOfWeek` is ISO: 1 = Monday … 7 = Sunday. */
export const lessonSlot = pgTable(
  "lesson_slot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    durationMinutes: smallint("duration_minutes").notNull().default(60),
    location: lessonLocationEnum("location").notNull().default("studio"),
    activeFrom: date("active_from").notNull(),
    activeUntil: date("active_until"),
    ...timestamps,
  },
  (t) => [
    index("lesson_slot_teacher_idx").on(t.teacherId, t.dayOfWeek),
    index("lesson_slot_student_idx").on(t.studentId),
    check("lesson_slot_day_range", sql`${t.dayOfWeek} between 1 and 7`),
  ],
);

/** One lesson meeting (generated from a slot, or added by hand). */
export const meeting = pgTable(
  "meeting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    slotId: uuid("slot_id").references(() => lessonSlot.id, { onDelete: "set null" }),
    /**
     * For meetings generated from a slot: the slot date this meeting was made for. It stays the same when the
     * meeting is moved to another `date`, so generating again never re-creates a meeting that was rescheduled.
     */
    originalDate: date("original_date"),
    date: date("date").notNull(),
    startTime: time("start_time"),
    status: meetingStatusEnum("status").notNull().default("scheduled"),
    /** What was studied. */
    material: text("material"),
    /** Note for the student. */
    teacherNote: text("teacher_note"),
    /** Only the teacher sees this. */
    privateNote: text("private_note"),
    ...timestamps,
  },
  (t) => [
    index("meeting_teacher_date_idx").on(t.teacherId, t.date),
    index("meeting_student_date_idx").on(t.studentId, t.date),
    uniqueIndex("meeting_slot_original_date_unique").on(t.slotId, t.originalDate),
  ],
);

/* ------------------------------------------------------------------ */
/* 5.7 Payments (tables exist, feature off: app_setting features.payments) */
/* ------------------------------------------------------------------ */

export const tuitionPlan = pgTable("tuition_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** E.g. "Reguler 4x/bulan". */
  name: text("name").notNull(),
  pricePerMonth: integer("price_per_month"),
  pricePerMeeting: integer("price_per_meeting"),
  meetingsPerMonth: smallint("meetings_per_month"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const studentPlan = pgTable(
  "student_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => tuitionPlan.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    /** Special price (discount) for this student, whole rupiah. */
    customPrice: integer("custom_price"),
    ...timestamps,
  },
  (t) => [index("student_plan_student_idx").on(t.studentId)],
);

export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** YYYY-MM */
    period: text("period").notNull(),
    amount: integer("amount").notNull(),
    dueDate: date("due_date"),
    status: invoiceStatusEnum("status").notNull().default("unpaid"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("invoice_student_period_idx").on(t.studentId, t.period),
    check("invoice_period_format", sql`${t.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("invoice_amount_nonnegative", sql`${t.amount} >= 0`),
  ],
);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    /** Storage key `payment/<studentId>/<file>`. */
    proofFileKey: text("proof_file_key"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("payment_invoice_idx").on(t.invoiceId), check("payment_amount_positive", sql`${t.amount} > 0`)],
);

/* ------------------------------------------------------------------ */
/* 5.8 Other                                                           */
/* ------------------------------------------------------------------ */

/** Key–value settings (see src/lib/settings.ts for the keys). */
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

/** In-app notification (new assignment, recording reviewed, schedule changed). */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notification_user_idx").on(t.userId, t.readAt)],
);

/** Web Push subscription for practice reminders (stage 4). */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)],
);
