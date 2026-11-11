import { DUR, ScoreError, type Bar, type DurCode, type Finger, type Note, type Part } from "./musicxml";

/*
 * Parser for the short text notation in content/pieces/<slug>.notes (format: content/pieces/README.md).
 * Safe for client code.
 */

function parseDuration(s: string, where: string) {
  const m = /^([whqes])(\.?)$/.exec(s);
  if (!m) throw new ScoreError(`${where}: durasi "${s}" tidak dikenal (pakai w h q e s, boleh diberi titik)`);
  const d = DUR[m[1] as DurCode];
  return { len: m[2] ? d.len * 1.5 : d.len, type: d.type, dots: m[2] ? 1 : 0 };
}

function parseNote(s: string, where: string): Note {
  const m = /^([1-6])\.(\d{1,2})([pimac]?)$/.exec(s);
  if (!m) throw new ScoreError(`${where}: not "${s}" tidak dikenal (contoh: 1.0 atau 2.3i)`);
  return { string: Number(m[1]), fret: Number(m[2]), finger: (m[3] || undefined) as Finger | undefined };
}

/** Parse one line of bars ("... | ... | ...") into bars. */
function parseBars(line: string, where: string): Bar[] {
  const bars: Bar[] = [];
  for (const raw of line.split("|")) {
    const text = raw.trim();
    if (!text) continue;
    const bar: Bar = { events: [] };
    // Tokens: {Fine} {D.C. al Fine} (text), <Latihan 1> (rehearsal), [G7] (chord name), T3/4 (time), !! / !end (barline)
    const tokens = text.match(/\{[^}]*\}|<[^>]*>|\[[^\]]*\]|\S+/g) ?? [];
    for (const tk of tokens) {
      if (tk.startsWith("{")) bar.events.push({ kind: "text", text: tk.slice(1, -1) });
      else if (tk.startsWith("<")) bar.events.push({ kind: "rehearsal", text: tk.slice(1, -1) });
      else if (tk.startsWith("[")) bar.events.push({ kind: "chordName", name: tk.slice(1, -1) });
      else if (/^T\d+\/\d+$/.test(tk)) bar.time = tk.slice(1);
      else if (tk === "!!") bar.barline = "double";
      else if (tk === "!end") bar.barline = "final";
      else {
        const [notes, dur] = tk.split(":");
        if (!dur) throw new ScoreError(`${where}: "${tk}" butuh durasi, contoh 1.0:q`);
        const d = parseDuration(dur, where);
        if (notes === "r") bar.events.push({ kind: "rest", ...d });
        else bar.events.push({ kind: "note", notes: notes.split("+").map((n) => parseNote(n, where)), ...d });
      }
    }
    bars.push(bar);
  }
  return bars;
}

/** Parse a whole .notes file. */
export function parseNotes(src: string, file: string) {
  let time = "4/4";
  let tempo = 80;
  let key = 0;
  const parts: Part[] = [];
  let current: { part: Part; voice: number } | null = null;
  src.split("\n").forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    const l = line.replace(/#.*$/, "").trim();
    if (!l) return;
    let m: RegExpExecArray | null;
    if ((m = /^time\s+(\d+\/\d+)$/.exec(l))) time = m[1];
    else if ((m = /^tempo\s+(\d+)$/.exec(l))) tempo = Number(m[1]);
    else if ((m = /^key\s+(-?\d)$/.exec(l))) key = Number(m[1]);
    else if ((m = /^part\s+(.+?)(?:\s+voice\s+([12]))?$/.exec(l))) {
      const name = m[1];
      const voice = Number(m[2] ?? 1) - 1;
      let part = parts.find((p) => p.name === name);
      if (!part) parts.push((part = { name, voices: [[], []] }));
      current = { part, voice };
    } else {
      if (!current) throw new ScoreError(`${where}: tulis "part <nama>" sebelum notasi`);
      const c = current as { part: Part; voice: number };
      c.part.voices[c.voice].push(...parseBars(l, where));
    }
  });
  return { time, tempo, key, parts };
}
