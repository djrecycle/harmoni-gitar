/*
 * Write simple classical-guitar notation as MusicXML (notation + tab). Used by `npm run scores:build` (from .notes
 * files, see notes.ts) and by the teacher's score editor (from a ScoreDoc, see doc.ts). Safe for client code.
 * Lengths are counted in 16th notes (DIV = 4 divisions per quarter note).
 */

/** Sounding MIDI pitch of each open string, string 1 (high E) to 6 (low E). */
export const TUNING = [64, 59, 55, 50, 45, 40];
const STEPS_SHARP = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const ALTER_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const STEPS_FLAT = ["C", "D", "D", "E", "E", "F", "G", "G", "A", "A", "B", "B"];
const ALTER_FLAT = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0];
const DIV = 4;
export const MAX_FRET = 19;

export const DUR = {
  w: { len: 16, type: "whole" },
  h: { len: 8, type: "half" },
  q: { len: 4, type: "quarter" },
  e: { len: 2, type: "eighth" },
  s: { len: 1, type: "16th" },
} as const;
export type DurCode = keyof typeof DUR;

const CHORD_KIND: Record<string, string> = { "": "major", m: "minor", "7": "dominant", m7: "minor-seventh", maj7: "major-seventh" };
export const CHORD_RE = /^([A-G])([b#]?)(m7|maj7|m|7|)$/;

export type Finger = "p" | "i" | "m" | "a" | "c";
export type Note = { string: number; fret: number; finger?: Finger };
export type Event =
  | { kind: "note"; notes: Note[]; len: number; type: string; dots: number }
  | { kind: "rest"; len: number; type: string; dots: number }
  | { kind: "chordName"; name: string }
  | { kind: "text"; text: string }
  | { kind: "rehearsal"; text: string };
export type Bar = { events: Event[]; time?: string; barline?: "double" | "final" };
/** voices[0] = voice 1 (all bars), voices[1] = voice 2 (empty, or one entry per bar; an empty bar = no voice 2 there). */
export type Part = { name: string; voices: Bar[][] };

export type ScoreInput = {
  title: string;
  composer?: string | null;
  /** Starting time signature, e.g. "4/4". A bar may change it (Bar.time, written in part 1, voice 1). */
  time: string;
  tempo: number;
  /** Key signature as fifths: -7 (7 flats) .. 7 (7 sharps). Flat keys spell black keys as flats. */
  key?: number;
  parts: Part[];
  /** XML comments written at the top of the file. */
  comments?: string[];
  software?: string;
};

/** A problem in the notation; `bar` is 1-based. The message is Indonesian, for scripts and as a fallback. */
export class ScoreError extends Error {
  constructor(
    message: string,
    readonly info: { part?: string; bar?: number; voice?: number } = {},
  ) {
    super(message);
  }
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Length of a full bar in 16ths, e.g. "3/4" -> 12. */
export function barLength(time: string) {
  const [n, d] = time.split("/").map(Number);
  return (n * 16) / d;
}

export function durLength(code: DurCode, dots: number) {
  return dots ? DUR[code].len * 1.5 : DUR[code].len;
}

/** Split a length (in 16ths) into rests, longest first (e.g. 12 -> dotted half). */
export function restsFor(len: number): Event[] {
  const options: { len: number; type: string; dots: number }[] = [];
  for (const d of Object.values(DUR)) {
    options.push({ len: d.len * 1.5, type: d.type, dots: 1 }, { len: d.len, type: d.type, dots: 0 });
  }
  options.sort((a, b) => b.len - a.len);
  const out: Event[] = [];
  let left = len;
  while (left > 0) {
    const o = options.find((x) => x.len <= left && Number.isInteger(x.len))!;
    out.push({ kind: "rest", ...o });
    left -= o.len;
  }
  return out;
}

function pitchXml(midi: number, flats: boolean) {
  const step = (flats ? STEPS_FLAT : STEPS_SHARP)[midi % 12];
  const alter = (flats ? ALTER_FLAT : ALTER_SHARP)[midi % 12];
  const octave = Math.floor((midi - alter) / 12) - 1;
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`;
}

function chordXml(name: string, where: string, info: ScoreError["info"]) {
  const m = CHORD_RE.exec(name);
  if (!m) throw new ScoreError(`${where}: akor "${name}" tidak dikenal`, info);
  const alter = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return `<harmony><root><root-step>${m[1]}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ""}</root><kind text="${esc(m[3])}">${CHORD_KIND[m[3]]}</kind></harmony>`;
}

function voiceXml(bar: Bar, voice: number, flats: boolean, where: string, info: ScoreError["info"]): { xml: string; len: number } {
  let xml = "";
  let len = 0;
  for (const ev of bar.events) {
    if (ev.kind === "text") {
      const sound = /^fine$/i.test(ev.text) ? `<sound fine="yes"/>` : /^d\.c\./i.test(ev.text) ? `<sound dacapo="yes"/>` : "";
      xml += `<direction placement="${/^d\.c\./i.test(ev.text) ? "below" : "above"}"><direction-type><words font-style="italic">${esc(ev.text)}</words></direction-type>${sound}</direction>`;
    } else if (ev.kind === "rehearsal") {
      xml += `<direction placement="above"><direction-type><rehearsal>${esc(ev.text)}</rehearsal></direction-type></direction>`;
    } else if (ev.kind === "chordName") {
      xml += chordXml(ev.name, where, info);
    } else if (ev.kind === "rest") {
      xml += `<note><rest/><duration>${ev.len}</duration><voice>${voice}</voice><type>${ev.type}</type>${"<dot/>".repeat(ev.dots)}</note>`;
      len += ev.len;
    } else {
      ev.notes.forEach((n, i) => {
        if (n.fret > MAX_FRET) throw new ScoreError(`${where}: fret ${n.fret} terlalu tinggi`, info);
        const midi = TUNING[n.string - 1] + n.fret;
        const technical = `<technical>${n.finger ? `<pluck>${n.finger}</pluck>` : ""}<string>${n.string}</string><fret>${n.fret}</fret></technical>`;
        xml +=
          `<note>${i > 0 ? "<chord/>" : ""}${pitchXml(midi, flats)}<duration>${ev.len}</duration><voice>${voice}</voice><type>${ev.type}</type>${"<dot/>".repeat(ev.dots)}` +
          `<stem>${voice === 1 ? "up" : "down"}</stem><notations>${technical}</notations></note>`;
      });
      len += ev.len;
    }
  }
  return { xml, len };
}

/**
 * Build the MusicXML document. Every bar must be full, except a shorter first bar (a pickup / anacrusis).
 * Voice 2 of a bar, when present, must be as long as voice 1. Throws a ScoreError on the first problem.
 */
export function toMusicXml(input: ScoreInput, label = "notasi"): string {
  const { time, tempo, parts } = input;
  const key = Math.max(-7, Math.min(7, Math.round(input.key ?? 0)));
  const flats = key < 0;
  if (!parts.length) throw new ScoreError(`${label}: tidak ada part`);
  const barCount = parts[0].voices[0].length;
  if (!barCount) throw new ScoreError(`${label}: belum ada birama`);
  for (const p of parts) {
    if (p.voices[0].length !== barCount) throw new ScoreError(`${label}: "${p.name}" punya ${p.voices[0].length} birama, "${parts[0].name}" ${barCount}`, { part: p.name });
    if (p.voices[1]?.length && p.voices[1].length !== barCount)
      throw new ScoreError(`${label}: suara 2 "${p.name}" punya ${p.voices[1].length} birama, harus ${barCount}`, { part: p.name, voice: 2 });
  }

  // Time signature per bar (a change is written in part 1, voice 1).
  const times: string[] = [];
  parts[0].voices[0].forEach((b, i) => times.push(b.time ?? (i ? times[i - 1] : time)));

  const partList = parts
    .map(
      (p, i) =>
        `<score-part id="P${i + 1}"><part-name>${esc(p.name)}</part-name><score-instrument id="P${i + 1}-I1"><instrument-name>Classical Guitar</instrument-name></score-instrument>` +
        `<midi-instrument id="P${i + 1}-I1"><midi-channel>${i + 1}</midi-channel><midi-program>25</midi-program><volume>80</volume></midi-instrument></score-part>`,
    )
    .join("");

  const partsXml = parts
    .map((p, pi) => {
      const measures = p.voices[0]
        .map((bar, bi) => {
          const where = `${label}, ${p.name}, birama ${bi + 1}`;
          const info = { part: p.name, bar: bi + 1 };
          const t = times[bi];
          const want = barLength(t);
          let attrs = "";
          if (bi === 0) {
            const [beats, beatType] = t.split("/");
            attrs =
              `<attributes><divisions>${DIV}</divisions><key><fifths>${key}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
              `<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>` +
              // Standard guitar tuning, so players can show the tablature (line 1 = lowest string).
              `<staff-details><staff-lines>6</staff-lines>${TUNING.slice()
                .reverse()
                .map((m, i) => `<staff-tuning line="${i + 1}"><tuning-step>${STEPS_SHARP[m % 12]}</tuning-step><tuning-octave>${Math.floor(m / 12) - 1}</tuning-octave></staff-tuning>`)
                .join("")}</staff-details></attributes>`;
          } else if (t !== times[bi - 1]) {
            const [beats, beatType] = t.split("/");
            attrs = `<attributes><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time></attributes>`;
          }
          const v1 = voiceXml(bar, 1, flats, where, info);
          // A short first bar is a pickup (anacrusis); every other bar must be full.
          if (v1.len !== want && !(bi === 0 && v1.len < want && v1.len > 0))
            throw new ScoreError(`${where}: panjang birama ${v1.len / 4} ketuk, seharusnya ${want / 4}`, info);
          let body = v1.xml;
          const second = p.voices[1]?.[bi];
          if (second && second.events.length) {
            const v2 = voiceXml(second, 2, flats, where + " (suara 2)", { ...info, voice: 2 });
            if (v2.len !== v1.len) throw new ScoreError(`${where} (suara 2): panjang ${v2.len / 4} ketuk, suara 1 ${v1.len / 4}`, { ...info, voice: 2 });
            body += `<backup><duration>${v1.len}</duration></backup>${v2.xml}`;
          }
          const tempoXml =
            bi === 0 && pi === 0
              ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`
              : "";
          const last = bi === barCount - 1;
          const style = bar.barline === "final" || (last && !bar.barline) ? "light-heavy" : bar.barline === "double" ? "light-light" : "";
          const barline = style ? `<barline location="right"><bar-style>${style}</bar-style></barline>` : "";
          const implicit = bi === 0 && v1.len < want ? ` implicit="yes"` : "";
          return `<measure number="${bi + 1}"${implicit}>${attrs}${tempoXml}${body}${barline}</measure>`;
        })
        .join("\n");
      return `<part id="P${pi + 1}">\n${measures}\n</part>`;
    })
    .join("\n");

  const comments = (input.comments ?? []).map((c) => `<!-- ${esc(c).replace(/--/g, "-")} -->\n`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
${comments}
<score-partwise version="4.0">
<work><work-title>${esc(input.title)}</work-title></work>
<identification>${input.composer ? `<creator type="composer">${esc(input.composer)}</creator>` : ""}<encoding><software>${esc(input.software ?? "Harmoni Gitar")}</software></encoding></identification>
<part-list>${partList}</part-list>
${partsXml}
</score-partwise>
`;
}
