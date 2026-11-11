/** Enum values with their English labels (translated through i18n). Safe for client code. */

export const CHECK_LEVELS = ["belum", "hampir", "sudah"] as const;
export type CheckLevel = (typeof CHECK_LEVELS)[number];
export const CHECK_LEVEL_LABEL: Record<CheckLevel, string> = { belum: "Not yet", hampir: "Almost", sudah: "Got it" };

export const MEETING_STATUSES = ["scheduled", "hadir", "izin", "sakit", "alpa", "batal_guru", "pengganti"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  hadir: "Present",
  izin: "Excused",
  sakit: "Sick",
  alpa: "Absent",
  batal_guru: "Cancelled by teacher",
  pengganti: "Moved to another day",
};
export const MEETING_STATUS_TONE: Record<MeetingStatus, "neutral" | "primary" | "success" | "danger" | "warning"> = {
  scheduled: "primary",
  hadir: "success",
  izin: "warning",
  sakit: "warning",
  alpa: "danger",
  batal_guru: "neutral",
  pengganti: "neutral",
};

export const LOCATIONS = ["studio", "rumah_siswa", "online"] as const;
export type LessonLocation = (typeof LOCATIONS)[number];
export const LOCATION_LABEL: Record<LessonLocation, string> = { studio: "Studio", rumah_siswa: "Student's home", online: "Online" };

export const SEGMENT_LABEL = { warmup: "Warm-up & posture", technique: "Technique", etude: "Etude", piece: "Piece" } as const;

export const LESSON_KIND_LABEL = { theory: "Theory", technique: "Technique", etude: "Etude", piece: "Piece", check: "Unit check" } as const;
