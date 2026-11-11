import { capacity, contentLength, eventLength, timeAt, type DocEvent, type DocNote, type ScoreDoc } from "@/lib/score/doc";
import { DUR, barLength, durLength, type DurCode, type Finger } from "@/lib/score/musicxml";

/*
 * Editing operations of the score editor, as pure functions (doc in, new doc out) so undo/redo is just a list
 * of docs. Works like MuseScore's note input: entering a note at a selected note overwrites it (and what it
 * covers), a bar can never get longer than its time signature, and what is left of a bar shows as rests.
 */

/** Where input goes: an event (index < events.length) or the free space after the last event of a bar. */
export type Cursor = { part: number; voice: 0 | 1; measure: number; index: number };

export type Input = {
  dur: DurCode;
  dot: boolean;
  /** Add notes to the selected chord instead of moving on (petikan rangkap / akor). */
  chord: boolean;
  /** Insert before the selected note instead of overwriting it. */
  insert: boolean;
  finger?: Finger;
};

/** Why an edit was refused (shown to the teacher). */
export type EditError = "noRoom" | "tooLongForBar" | "lastBar" | "barTooFull" | "lastPart";

export type Result = { doc: ScoreDoc; cur: Cursor } | { error: EditError };

const clone = (d: ScoreDoc): ScoreDoc => structuredClone(d);

export function eventsAt(doc: ScoreDoc, c: Cursor): DocEvent[] {
  return doc.parts[c.part]?.voices[c.voice][c.measure] ?? [];
}

/** Make sure voice 2 of a part has one (empty) list per bar before writing into it. */
function ensureVoice(doc: ScoreDoc, c: Cursor) {
  const v = doc.parts[c.part].voices[c.voice];
  while (v.length < doc.measures.length) v.push([]);
}

/** Rests that fill `len` 16ths, longest first. */
export function restEvents(len: number): DocEvent[] {
  const opts: { dur: DurCode; dot: boolean; len: number }[] = [];
  for (const [k, d] of Object.entries(DUR) as [DurCode, (typeof DUR)[DurCode]][])
    opts.push({ dur: k, dot: true, len: d.len * 1.5 }, { dur: k, dot: false, len: d.len });
  opts.sort((a, b) => b.len - a.len);
  const out: DocEvent[] = [];
  let left = len;
  while (left > 0) {
    const o = opts.find((x) => x.len <= left && Number.isInteger(x.len))!;
    out.push({ dur: o.dur, ...(o.dot ? { dot: true } : {}), rest: true, notes: [] });
    left -= o.len;
  }
  return out;
}

/**
 * Put `ev` at position `index` of a bar, overwriting what it covers (like MuseScore): events starting inside its
 * span are removed, and the part of the last one that sticks out becomes rests. Null when it runs past the bar.
 */
function overwrite(evs: DocEvent[], index: number, ev: DocEvent, cap: number): DocEvent[] | null {
  let start = 0;
  for (let i = 0; i < index; i++) start += eventLength(evs[i]);
  const end = start + eventLength(ev);
  if (end > cap) return null;
  let j = index;
  let pos = start;
  while (j < evs.length && pos < end) pos += eventLength(evs[j++]);
  const leftover = pos > end ? restEvents(pos - end) : [];
  return [...evs.slice(0, index), ev, ...leftover, ...evs.slice(j)];
}

/** Add an empty bar after bar m (for every part and voice). */
function addMeasureAfter(doc: ScoreDoc, m: number) {
  doc.measures.splice(m + 1, 0, {});
  for (const p of doc.parts) for (const v of p.voices) if (v.length) v.splice(m + 1, 0, []);
}

/** After an edit: when the cursor sits after a full bar, move it to the next bar (adding one at the end). */
function settle(doc: ScoreDoc, c: Cursor): Cursor {
  const evs = eventsAt(doc, c);
  if (c.index >= evs.length && contentLength(evs) >= capacity(doc, c.measure)) {
    if (c.measure === doc.measures.length - 1) addMeasureAfter(doc, c.measure);
    return { ...c, measure: c.measure + 1, index: 0 };
  }
  return c;
}

function put(doc: ScoreDoc, c: Cursor, ev: DocEvent, input: Input, stay: boolean): Result {
  const d = clone(doc);
  ensureVoice(d, c);
  const evs = eventsAt(d, c);
  const cap = capacity(d, c.measure);
  const len = eventLength(ev);
  if (len > barLength(timeAt(d, c.measure))) return { error: "tooLongForBar" };
  let next: DocEvent[] | null;
  if (c.index >= evs.length) next = cap - contentLength(evs) >= len ? [...evs, ev] : null;
  else if (input.insert) next = cap - contentLength(evs) >= len ? [...evs.slice(0, c.index), ev, ...evs.slice(c.index)] : null;
  else next = overwrite(evs, c.index, ev, cap);
  if (!next) return { error: "noRoom" };
  d.parts[c.part].voices[c.voice][c.measure] = next;
  const cur = stay ? { ...c, index: Math.min(c.index, next.length - 1) } : settle(d, { ...c, index: c.index + 1 });
  return { doc: d, cur };
}

/** Enter a note (string 1–6, fret) at the cursor. In chord mode it is added to the selected chord instead. */
export function enterNote(doc: ScoreDoc, c: Cursor, input: Input, string: number, fret: number): Result {
  const note: DocNote = { string, fret, ...(input.finger ? { finger: input.finger } : {}) };
  const evs = eventsAt(doc, c);
  const at = evs[c.index];
  if (input.chord && at) {
    const d = clone(doc);
    const ev = eventsAt(d, c)[c.index];
    if (ev.rest) {
      ev.rest = undefined;
      ev.notes = [note];
    } else {
      const same = ev.notes.find((n) => n.string === string);
      if (same && same.fret === fret) {
        ev.notes = ev.notes.filter((n) => n !== same);
        if (!ev.notes.length) ev.rest = true;
      } else if (same) same.fret = fret;
      else ev.notes.push(note);
    }
    return { doc: d, cur: c };
  }
  // A new chord in chord mode: stay on it so the next notes join it.
  return put(doc, c, { dur: input.dur, ...(input.dot ? { dot: true } : {}), notes: [note] }, input, input.chord);
}

export function enterRest(doc: ScoreDoc, c: Cursor, input: Input): Result {
  return put(doc, c, { dur: input.dur, ...(input.dot ? { dot: true } : {}), rest: true, notes: [] }, { ...input, chord: false }, false);
}

/** Change the length of the selected event (keeping its notes); a shorter one leaves a rest behind. */
export function changeDuration(doc: ScoreDoc, c: Cursor, dur: DurCode, dot: boolean): Result | null {
  const at = eventsAt(doc, c)[c.index];
  if (!at) return null;
  if (durLength(dur, dot ? 1 : 0) > barLength(timeAt(doc, c.measure))) return { error: "tooLongForBar" };
  const d = clone(doc);
  const evs = eventsAt(d, c);
  const ev = { ...at, dur, dot: dot || undefined };
  if (!ev.dot) delete ev.dot;
  const next = overwrite(evs, c.index, ev, capacity(d, c.measure));
  if (!next) return { error: "noRoom" };
  d.parts[c.part].voices[c.voice][c.measure] = next;
  return { doc: d, cur: c };
}

/** "Delete": a note becomes a rest of the same length; a rest is removed (the rest of the bar moves up). */
export function deleteAt(doc: ScoreDoc, c: Cursor): Result | null {
  let cur = c;
  if (!eventsAt(doc, cur)[cur.index]) {
    // At the free space: delete the last event before it.
    if (cur.index === 0) return null;
    cur = { ...cur, index: cur.index - 1 };
  }
  const d = clone(doc);
  const evs = eventsAt(d, cur);
  const ev = evs[cur.index];
  if (ev.rest) evs.splice(cur.index, 1);
  else evs[cur.index] = { dur: ev.dur, ...(ev.dot ? { dot: true } : {}), rest: true, notes: [] };
  return { doc: d, cur };
}

/** Positions the cursor can stop at in a bar: each event, plus the free space when the bar is not full. */
function stops(doc: ScoreDoc, c: Cursor) {
  const evs = eventsAt(doc, c);
  return evs.length + (contentLength(evs) < capacity(doc, c.measure) ? 1 : 0);
}

export function move(doc: ScoreDoc, c: Cursor, delta: 1 | -1): Cursor {
  if (delta > 0) {
    if (c.index + 1 < stops(doc, c)) return { ...c, index: c.index + 1 };
    return c.measure + 1 < doc.measures.length ? { ...c, measure: c.measure + 1, index: 0 } : c;
  }
  if (c.index > 0) return { ...c, index: c.index - 1 };
  if (c.measure === 0) return c;
  const prev = { ...c, measure: c.measure - 1, index: 0 };
  return { ...prev, index: Math.max(0, stops(doc, prev) - 1) };
}

/** Keep a cursor valid after the doc changed under it (undo, deleted bar, other voice...). */
export function clampCursor(doc: ScoreDoc, c: Cursor): Cursor {
  const part = Math.min(c.part, doc.parts.length - 1);
  const measure = Math.max(0, Math.min(c.measure, doc.measures.length - 1));
  const base = { ...c, part, measure };
  return { ...base, index: Math.max(0, Math.min(c.index, stops(doc, base) - 1)) };
}

export function insertMeasure(doc: ScoreDoc, c: Cursor, before: boolean): Result {
  const d = clone(doc);
  addMeasureAfter(d, before ? c.measure - 1 : c.measure);
  if (before && c.measure === 0 && d.measures[1]?.time) {
    // Keep the starting time signature on the first bar.
    d.measures[0].time = d.measures[1].time;
    delete d.measures[1].time;
  }
  return { doc: d, cur: { ...c, measure: before ? c.measure : c.measure + 1, index: 0 } };
}

export function deleteMeasure(doc: ScoreDoc, c: Cursor): Result {
  if (doc.measures.length <= 1) return { error: "lastBar" };
  const d = clone(doc);
  const [gone] = d.measures.splice(c.measure, 1);
  // A time change on the deleted bar moves to the next one, so later bars keep their time signature.
  if (gone.time && d.measures[c.measure] && !d.measures[c.measure].time) d.measures[c.measure].time = gone.time;
  for (const p of d.parts) for (const v of p.voices) if (v.length) v.splice(c.measure, 1);
  return { doc: d, cur: clampCursor(d, { ...c, index: 0 }) };
}

/** Change the time signature from bar m on (bar 0 = the starting one). Refused when a bar would be too full. */
export function setTime(doc: ScoreDoc, m: number, time: string): Result | { error: EditError } {
  const d = clone(doc);
  if (m === 0) {
    d.time = time;
    delete d.measures[0].time;
  } else if (time === timeAt(d, m - 1)) delete d.measures[m].time;
  else d.measures[m].time = time;
  for (let i = 0; i < d.measures.length; i++)
    for (const p of d.parts) for (const v of p.voices) if (contentLength(v[i] ?? []) > capacity(d, i)) return { error: "barTooFull" };
  return { doc: d, cur: { part: 0, voice: 0, measure: m, index: 0 } };
}

export function addPart(doc: ScoreDoc, name: string): ScoreDoc {
  const d = clone(doc);
  d.parts.push({ name, voices: [d.measures.map(() => []), []] });
  return d;
}

export function removePart(doc: ScoreDoc, p: number): ScoreDoc | { error: EditError } {
  if (doc.parts.length <= 1) return { error: "lastPart" };
  const d = clone(doc);
  d.parts.splice(p, 1);
  return d;
}

export function updateEvent(doc: ScoreDoc, c: Cursor, f: (ev: DocEvent) => void): ScoreDoc | null {
  if (!eventsAt(doc, c)[c.index]) return null;
  const d = clone(doc);
  f(eventsAt(d, c)[c.index]);
  return d;
}

/** Remove empty bars at the end (keeping at least one), e.g. the one added automatically after the last note. */
export function trimEnd(doc: ScoreDoc): ScoreDoc {
  const d = clone(doc);
  const empty = (m: number) => d.parts.every((p) => p.voices.every((v) => !(v[m]?.length))) && !d.measures[m].mark && !d.measures[m].text;
  while (d.measures.length > 1 && empty(d.measures.length - 1)) {
    d.measures.pop();
    for (const p of d.parts) for (const v of p.voices) if (v.length) v.pop();
  }
  return d;
}

/** Bar length in beats for display, e.g. 12 16ths in 3/4 -> 3. */
export const beats = (len: number, time: string) => len / (16 / Number(time.split("/")[1]));
