/**
 * Performance rubric from the module (page 34, "Rubrik penilaian penampilan"): 5 aspects, each 1–4.
 * English source strings, translated through i18n. Safe for client code.
 */
export const RUBRIC = [
  { key: "posture", label: "Posture & position", hint: "Sitting upright, guitar steady, hands relaxed" },
  { key: "accuracy", label: "Note accuracy", hint: "Right notes, clear, no buzzing" },
  { key: "rhythm", label: "Rhythm & tempo", hint: "Even beat, no stopping" },
  { key: "technique", label: "Plucking technique", hint: "Apoyando/tirando as written, alternating fingers" },
  { key: "expression", label: "Expression", hint: "Loud and soft, phrasing, stage manner" },
] as const;

export type RubricKey = (typeof RUBRIC)[number]["key"];
export type RubricScores = Record<RubricKey, number>;

export const LEVELS = [
  { value: 1, label: "Needs much more practice" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very good" },
] as const;

export const levelLabel = (n: number) => LEVELS.find((l) => l.value === n)?.label ?? "-";

/** Average of the five aspects, one decimal. */
export const rubricAverage = (s: RubricScores) => Math.round((RUBRIC.reduce((n, r) => n + s[r.key], 0) / RUBRIC.length) * 10) / 10;

export const ASSIGNMENT_STATUS_LABEL = {
  assigned: "To do",
  submitted: "Sent, waiting for review",
  reviewed: "Reviewed",
  done: "Done",
} as const;

export const ASSIGNMENT_STATUS_TONE = {
  assigned: "primary",
  submitted: "warning",
  reviewed: "primary",
  done: "success",
} as const;

/** Longest recording a student can send, in seconds. */
export const MAX_RECORDING_SECONDS = 5 * 60;
/** Longest voice comment from the teacher, in seconds. */
export const MAX_VOICE_COMMENT_SECONDS = 2 * 60;
