"use client";

import type { IllustrationName } from "@/lib/illustrations";
import { BlockPosition } from "./block-position";
import { DcAlFine } from "./dc-al-fine";
import { Fingers } from "./fingers";
import { FretboardNotes } from "./fretboard-notes";
import { GuitarParts } from "./guitar-parts";
import { NoteValues } from "./note-values";
import { PluckStroke } from "./pluck-stroke";
import { Sitting } from "./sitting";
import { StaffNotes } from "./staff-notes";
import { Strings } from "./strings";
import { TimeSignature } from "./time-signature";

/** An interactive, animated drawing for a lesson block (see src/lib/illustrations.ts). */
export function Illustration({ name, caption }: { name: IllustrationName; caption?: string }) {
  switch (name) {
    case "guitar-parts":
      return <GuitarParts caption={caption} />;
    case "strings":
      return <Strings caption={caption} />;
    case "sitting":
      return <Sitting caption={caption} />;
    case "fingers":
      return <Fingers caption={caption} />;
    case "block-position":
      return <BlockPosition caption={caption} />;
    case "apoyando":
    case "tirando":
      return <PluckStroke initial={name} caption={caption} />;
    case "staff-notes":
      return <StaffNotes caption={caption} />;
    case "note-values":
      return <NoteValues caption={caption} />;
    case "time-signature":
      return <TimeSignature caption={caption} />;
    case "fretboard-1-2":
      return <FretboardNotes set="1-2" caption={caption} />;
    case "fretboard-3-4":
      return <FretboardNotes set="3-4" caption={caption} />;
    case "fretboard-5-6":
      return <FretboardNotes set="5-6" caption={caption} />;
    case "dc-al-fine":
      return <DcAlFine caption={caption} />;
  }
}
