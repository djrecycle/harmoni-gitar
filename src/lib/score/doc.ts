import { z } from "zod";
import {
  CHORD_RE,
  DUR,
  MAX_FRET,
  barLength,
  durLength,
  restsFor,
  toMusicXml,
  type Bar,
  type DurCode,
  type Event,
  type Finger,
  type Part,
} from "./musicxml";

/*
 * ScoreDoc: what the teacher's score editor edits (stored in piece.score_doc, turned into MusicXML on save).
 * Like MuseScore, a bar that is not full is filled up with rests when it is written, so a bar is never "wrong";
 * the editor never lets a bar get longer than its time signature. Safe for client code.
 */

export const DUR_CODES = ["w", "h", "q", "e", "s"] as const satisfies readonly DurCode[];
export const FINGERS = ["p", "i", "m", "a"] as const satisfies readonly Finger[];
export const MAX_BARS = 300;
export const MAX_PARTS = 2;

export type DocNote = { string: number; fret: number; finger?: Finger };
export type DocEvent = { dur: DurCode; dot?: boolean; rest?: boolean; notes: DocNote[]; chord?: string };
export type DocMeasure = { time?: string; barline?: "double" | "final"; mark?: string; text?: string };
/** voices[0] / voices[1] hold one event list per measure (voice 2 may be empty everywhere). */
export type DocPart = { name: string; voices: [DocEvent[][], DocEvent[][]] };
export type ScoreDoc = {
  version: 1;
  time: string;
  tempo: number;
  key: number;
  /** The first bar is a pickup (anacrusis): it is not filled up with rests. */
  pickup: boolean;
  measures: DocMeasure[];
  parts: DocPart[];
};

const timeSig = z.string().regex(/^(1[0-2]|[1-9])\/(2|4|8|16)$/);
const noteSchema = z.object({
  string: z.number().int().min(1).max(6),
  fret: z.number().int().min(0).max(MAX_FRET),
  finger: z.enum(["p", "i", "m", "a", "c"]).optional(),
});
const eventSchema = z.object({
  dur: z.enum(DUR_CODES),
  dot: z.boolean().optional(),
  rest: z.boolean().optional(),
  notes: z.array(noteSchema).max(6),
  chord: z.string().regex(CHORD_RE).optional(),
});
const measureEvents = z.array(z.array(eventSchema).max(64)).max(MAX_BARS);

export const scoreDocSchema = z
  .object({
    version: z.literal(1),
    time: timeSig,
    tempo: z.number().int().min(20).max(300),
    key: z.number().int().min(-7).max(7),
    pickup: z.boolean(),
    measures: z
      .array(
        z.object({
          time: timeSig.optional(),
          barline: z.enum(["double", "final"]).optional(),
          mark: z.string().max(40).optional(),
          text: z.string().max(40).optional(),
        }),
      )
      .min(1)
      .max(MAX_BARS),
    parts: z
      .array(z.object({ name: z.string().trim().min(1).max(40), voices: z.tuple([measureEvents, measureEvents]) }))
      .min(1)
      .max(MAX_PARTS),
  })
  .superRefine((d, ctx) => {
    const n = d.measures.length;
    d.parts.forEach((p, pi) => {
      if (p.voices[0].length !== n || (p.voices[1].length && p.voices[1].length !== n))
        ctx.addIssue({ code: "custom", path: ["parts", pi], message: "measure count" });
      p.voices.forEach((v, vi) =>
        v.forEach((evs, mi) => {
          if (contentLength(evs) > capacity(d, mi)) ctx.addIssue({ code: "custom", path: ["parts", pi, "voices", vi, mi], message: "bar too long" });
          if (evs.some((e) => !e.rest && !e.notes.length)) ctx.addIssue({ code: "custom", path: ["parts", pi, "voices", vi, mi], message: "empty note" });
          // One note per string in a chord.
          if (evs.some((e) => new Set(e.notes.map((x) => x.string)).size !== e.notes.length))
            ctx.addIssue({ code: "custom", path: ["parts", pi, "voices", vi, mi], message: "string twice" });
        }),
      );
    });
  });

export function emptyDoc(time = "4/4", bars = 4): ScoreDoc {
  return {
    version: 1,
    time,
    tempo: 80,
    key: 0,
    pickup: false,
    measures: Array.from({ length: bars }, () => ({})),
    parts: [{ name: "Gitar", voices: [Array.from({ length: bars }, () => []), []] }],
  };
}

export const eventLength = (e: DocEvent) => durLength(e.dur, e.dot ? 1 : 0);
export const contentLength = (evs: DocEvent[]) => evs.reduce((n, e) => n + eventLength(e), 0);

/** Time signature in force at measure m. */
export function timeAt(doc: Pick<ScoreDoc, "time" | "measures">, m: number) {
  for (let i = Math.min(m, doc.measures.length - 1); i >= 0; i--) if (doc.measures[i]?.time) return doc.measures[i].time!;
  return doc.time;
}

/** Length of measure m when full, in 16ths. */
export const capacity = (doc: Pick<ScoreDoc, "time" | "measures">, m: number) => barLength(timeAt(doc, m));

/**
 * Length measure m is written with: full, except a pickup first bar, which is as long as its longest voice
 * (across all parts, so a duet stays aligned; at least one beat).
 */
export function writtenLength(doc: ScoreDoc, m: number) {
  const full = capacity(doc, m);
  if (m !== 0 || !doc.pickup) return full;
  let longest = 0;
  for (const p of doc.parts) for (const v of p.voices) longest = Math.max(longest, contentLength(v[0] ?? []));
  const beat = 16 / Number(timeAt(doc, 0).split("/")[1]);
  return Math.min(full, Math.max(beat, longest));
}

function toEvents(evs: DocEvent[], pad: number): Event[] {
  const out: Event[] = [];
  for (const e of evs) {
    if (e.chord) out.push({ kind: "chordName", name: e.chord });
    const d = { len: eventLength(e), type: DUR[e.dur].type, dots: e.dot ? 1 : 0 };
    out.push(e.rest || !e.notes.length ? { kind: "rest", ...d } : { kind: "note", notes: [...e.notes].sort((a, b) => b.string - a.string), ...d });
  }
  out.push(...restsFor(pad));
  return out;
}

/** The doc as the MusicXML writer's input, with every bar filled up with rests. */
export function docToParts(doc: ScoreDoc): Part[] {
  return doc.parts.map((p) => {
    const hasV2 = p.voices[1].some((evs) => evs.length);
    const voices: Bar[][] = [[], []];
    doc.measures.forEach((ms, m) => {
      const len = writtenLength(doc, m);
      const v1 = p.voices[0][m] ?? [];
      const events = toEvents(v1, Math.max(0, len - contentLength(v1)));
      // Marks first, "D.C. ..." texts at the end of the bar (where players read them).
      if (ms.mark) events.unshift({ kind: "rehearsal", text: ms.mark });
      if (ms.text) {
        if (/^d\.c\./i.test(ms.text)) events.push({ kind: "text", text: ms.text });
        else events.unshift({ kind: "text", text: ms.text });
      }
      voices[0].push({ events, time: m > 0 && ms.time && ms.time !== timeAt(doc, m - 1) ? ms.time : undefined, barline: ms.barline });
      if (hasV2) {
        const v2 = p.voices[1][m] ?? [];
        voices[1].push({ events: v2.length ? toEvents(v2, Math.max(0, len - contentLength(v2))) : [] });
      }
    });
    return { name: p.name, voices };
  });
}

export function docToMusicXml(doc: ScoreDoc, meta: { title: string; composer?: string | null; sourceNote?: string | null }) {
  // A time change in the first bar is the starting time signature.
  const time = doc.measures[0]?.time ?? doc.time;
  return toMusicXml(
    { title: meta.title || "Tanpa judul", composer: meta.composer, time, tempo: doc.tempo, key: doc.key, parts: docToParts(doc), comments: meta.sourceNote ? [meta.sourceNote] : [] },
    meta.title || "partitur",
  );
}
