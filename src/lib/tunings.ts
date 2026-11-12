/**
 * Guitar tunings for the tuner, as MIDI notes from string 6 (lowest) to string 1. English names, translated
 * through i18n where they are words. Safe for client code.
 */
export type Tuning = { id: string; name: string; hint?: string; notes: [number, number, number, number, number, number] };

export const TUNINGS: Tuning[] = [
  { id: "standard", name: "Standard (E A D G B E)", hint: "The usual tuning for classical guitar", notes: [40, 45, 50, 55, 59, 64] },
  { id: "drop-d", name: "Drop D (D A D G B E)", hint: "String 6 down to D: common in classical pieces", notes: [38, 45, 50, 55, 59, 64] },
  { id: "lute", name: "Lute / vihuela (E A D F♯ B E)", hint: "String 3 down to F♯, for Renaissance music", notes: [40, 45, 50, 54, 59, 64] },
  { id: "double-drop-d", name: "Double drop D (D A D G B D)", notes: [38, 45, 50, 55, 59, 62] },
  { id: "dadgad", name: "DADGAD", notes: [38, 45, 50, 55, 57, 62] },
  { id: "open-d", name: "Open D (D A D F♯ A D)", notes: [38, 45, 50, 54, 57, 62] },
  { id: "open-g", name: "Open G (D G D G B D)", notes: [38, 43, 50, 55, 59, 62] },
  { id: "open-e", name: "Open E (E B E G♯ B E)", notes: [40, 47, 52, 56, 59, 64] },
  { id: "open-a", name: "Open A (E A E A C♯ E)", notes: [40, 45, 52, 57, 61, 64] },
  { id: "open-c", name: "Open C (C G C G C E)", notes: [36, 43, 48, 55, 60, 64] },
  { id: "drop-c", name: "Drop C (C G C F A D)", notes: [36, 43, 48, 53, 57, 62] },
  { id: "half-down", name: "Half step down (E♭ A♭ D♭ G♭ B♭ E♭)", notes: [39, 44, 49, 54, 58, 63] },
  { id: "whole-down", name: "Whole step down (D G C F A D)", notes: [38, 43, 48, 53, 57, 62] },
];

/** Tuner mode without strings: any note, the nearest semitone is the target. */
export const CHROMATIC = "chromatic";
