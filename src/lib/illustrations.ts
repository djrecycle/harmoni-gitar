/**
 * Built-in interactive illustrations for the `illustration` lesson block. Each one is a drawing made for this app
 * (SVG in src/components/illustrations), never a scan of the printed book. Safe for client code.
 * Labels are English i18n keys (translated where they are shown).
 */
export const ILLUSTRATIONS = {
  "guitar-parts": "Parts of the guitar",
  strings: "The six strings",
  sitting: "Sitting position",
  fingers: "Finger names",
  "block-position": "Block position",
  apoyando: "Apoyando stroke",
  tirando: "Tirando stroke",
  "staff-notes": "Notes on the staff",
  "note-values": "Note values",
  "time-signature": "Time signatures",
  "fretboard-1-2": "Notes on strings ① and ②",
  "fretboard-3-4": "Notes on strings ③ and ④",
  "fretboard-5-6": "Notes on strings ⑤ and ⑥",
  "dc-al-fine": "D.C. al Fine",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;
export const ILLUSTRATION_NAMES = Object.keys(ILLUSTRATIONS) as [IllustrationName, ...IllustrationName[]];
