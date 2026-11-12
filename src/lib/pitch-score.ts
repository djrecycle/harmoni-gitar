/** Scoring of "Check my notes" runs. Safe for client code. */

/** A run is saved (and given a score) only when at least this many notes were judged. */
export const MIN_CHECK_NOTES = 8;

/** 0–100: the share of notes played right. */
export const pitchScore = (right: number, total: number) => (total > 0 ? Math.round((right / total) * 100) : 0);

/** Stars for a score (kids like stars): 90+ = 3, 70+ = 2, 50+ = 1. */
export const pitchStars = (score: number) => (score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0);
