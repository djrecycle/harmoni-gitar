"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Delete,
  ListPlus,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { saveScoreDoc, type PieceMeta } from "@/app/actions/scores";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CHORD_RE, MAX_FRET, type DurCode, type Finger } from "@/lib/score/musicxml";
import { DUR_CODES, FINGERS, MAX_PARTS, capacity, contentLength, timeAt, type ScoreDoc } from "@/lib/score/doc";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { Fretboard } from "./fretboard";
import { ScoreCanvas, type CanvasHandle } from "./score-canvas";
import {
  addPart,
  beats,
  changeDuration,
  clampCursor,
  deleteAt,
  deleteMeasure,
  enterNote,
  enterRest,
  eventsAt,
  insertMeasure,
  move,
  removePart,
  setTime,
  trimEnd,
  updateEvent,
  type Cursor,
  type EditError,
  type Input as NoteInput,
} from "./edit";

/** SMuFL code points in the Bravura font (the note-value buttons look like MuseScore's). */
const GLYPH: Record<DurCode, string> = { w: "", h: "", q: "", e: "", s: "" };
const GLYPH_DOT = "";
const GLYPH_REST = "";
const DUR_LABEL: Record<DurCode, string> = { w: "Whole note", h: "Half note", q: "Quarter note", e: "Eighth note", s: "Sixteenth note" };
const DUR_KEY: Record<string, DurCode> = { "6": "w", "5": "h", "4": "q", "3": "e", "2": "s" };
const TIMES = ["2/4", "3/4", "4/4", "2/2", "3/8", "6/8", "9/8", "12/8", "5/4"];
const MAJOR = ["C♭", "G♭", "D♭", "A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯"];
const MINOR = ["A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯", "G♯", "D♯", "A♯"];
const STATUSES = [
  { value: "own_work", label: "Own work" },
  { value: "public_domain", label: "Public domain" },
  { value: "licensed", label: "Licensed" },
  { value: "unknown", label: "Unknown" },
] as const;

const ERRORS: Record<EditError, string> = {
  noRoom: "That does not fit in this bar. Pick a shorter note value, or go to the next bar.",
  tooLongForBar: "That note value is longer than a whole bar in this time signature.",
  lastBar: "A score needs at least one bar.",
  barTooFull: "Some bars hold more than the new time signature allows. Shorten them first.",
  lastPart: "A score needs at least one guitar.",
};

export type ScoreMetaState = {
  title: string;
  composer: string;
  stage1: number;
  stage2: number;
  stage3: number;
  copyrightStatus: PieceMeta["copyrightStatus"];
  sourceNote: string;
};

type History = { past: ScoreDoc[]; doc: ScoreDoc; future: ScoreDoc[] };

export function ScoreEditor({ pieceId, initialDoc, initialMeta }: { pieceId: string | null; initialDoc: ScoreDoc; initialMeta: ScoreMetaState }) {
  const t = useT();
  const router = useRouter();
  const [hist, setHist] = useState<History>({ past: [], doc: initialDoc, future: [] });
  const doc = hist.doc;
  const [cur, setCur] = useState<Cursor>({ part: 0, voice: 0, measure: 0, index: 0 });
  const [input, setInput] = useState<NoteInput>({ dur: "q", dot: false, chord: false, insert: false });
  const [string, setString] = useState(1);
  const [meta, setMeta] = useState(initialMeta);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTab, setShowTab] = useState(true);
  const [showFrets, setShowFrets] = useState(true);
  const [frets, setFrets] = useState(12);
  const [player, setPlayer] = useState({ ready: false, playing: false });
  const canvas = useRef<CanvasHandle>({ api: null, score: null, playerReady: false });
  /** The last number key, so "1" then "2" quickly = fret 12. */
  const lastDigit = useRef<{ at: number; digit: number; past: number; cursor: Cursor } | null>(null);

  const commit = useCallback((next: ScoreDoc, c?: Cursor) => {
    setHist((h) => ({ past: [...h.past.slice(-199), h.doc], doc: next, future: [] }));
    if (c) setCur(clampCursor(next, c));
    setDirty(true);
  }, []);

  const apply = (r: { doc: ScoreDoc; cur: Cursor } | { error: EditError } | null) => {
    if (!r) return false;
    if ("error" in r) {
      toast.error(t(ERRORS[r.error]));
      return false;
    }
    commit(r.doc, r.cur);
    return true;
  };

  /** Next position; past the end of a full last bar, add a bar so writing can go on. */
  const next = () => {
    const c = move(doc, cur, 1);
    if (c !== cur) return setCur(c);
    if (cur.measure === doc.measures.length - 1) apply(insertMeasure(doc, cur, false));
  };

  const undo = () =>
    setHist((h) => {
      if (!h.past.length) return h;
      const doc = h.past[h.past.length - 1];
      setCur((c) => clampCursor(doc, c));
      return { past: h.past.slice(0, -1), doc, future: [h.doc, ...h.future] };
    });
  const redo = () =>
    setHist((h) => {
      if (!h.future.length) return h;
      const doc = h.future[0];
      setCur((c) => clampCursor(doc, c));
      return { past: [...h.past, h.doc], doc, future: h.future.slice(1) };
    });

  const events = eventsAt(doc, cur);
  const selected = events[cur.index] ?? null;
  const time = timeAt(doc, cur.measure);
  const left = capacity(doc, cur.measure) - contentLength(events);
  const active = useMemo(() => new Map((selected && !selected.rest ? selected.notes : []).map((n) => [n.string, n.fret])), [selected]);
  const selectedNote = selected && !selected.rest ? (selected.notes.find((n) => n.string === string) ?? (selected.notes.length === 1 ? selected.notes[0] : null)) : null;
  const measure = doc.measures[cur.measure] ?? {};

  const pick = (s: number, f: number) => {
    setString(s);
    apply(enterNote(doc, cur, input, s, f));
  };

  const setDur = (dur: DurCode, dot = input.dot && dur !== "s") => {
    setInput((i) => ({ ...i, dur, dot }));
    if (selected) apply(changeDuration(doc, cur, dur, dot));
  };
  const toggleDot = () => setDur(input.dur, !input.dot);

  const setFinger = (f: Finger | null) => {
    if (!selectedNote) return;
    const next = updateEvent(doc, cur, (ev) => {
      const n = ev.notes.find((x) => x.string === selectedNote.string)!;
      if (f && n.finger !== f) n.finger = f;
      else delete n.finger;
    });
    if (next) commit(next);
  };

  const setChordName = (name: string) => {
    const v = name.trim();
    const next = updateEvent(doc, cur, (ev) => {
      if (v) ev.chord = v;
      else delete ev.chord;
    });
    if (next) commit(next);
  };

  const setMeasure = (f: (m: ScoreDoc["measures"][number]) => void) => {
    const d = structuredClone(doc);
    f(d.measures[cur.measure]);
    commit(d);
  };

  const changeTime = (value: string) => {
    const r = setTime(doc, cur.measure, value);
    if ("error" in r) toast.error(t(ERRORS[r.error]));
    else commit(r.doc, cur);
  };

  const setDocField = <K extends keyof ScoreDoc>(k: K, v: ScoreDoc[K]) => {
    const d = structuredClone(doc);
    d[k] = v;
    commit(d);
  };

  const togglePlay = () => {
    const a = canvas.current.api;
    const score = canvas.current.score;
    if (!a || !canvas.current.playerReady) return;
    if (!player.playing && score?.masterBars[cur.measure]) a.tickPosition = score.masterBars[cur.measure].start;
    a.playPause();
  };
  const stop = () => canvas.current.api?.stop();

  const save = async () => {
    if (!meta.title.trim()) return toast.error(t("Give the score a title first."));
    setSaving(true);
    const trimmed = trimEnd(doc);
    const r = await saveScoreDoc(pieceId, trimmed, { ...meta, composer: meta.composer || undefined, sourceNote: meta.sourceNote || undefined });
    setSaving(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.message);
    setDirty(false);
    if (!pieceId && r.data) router.replace(`/guru/materi/partitur/${r.data.slug}/ubah`);
  };

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Keyboard input (desktop), close to MuseScore: numbers = fret on the current string, ↑/↓ = string,
  // ←/→ = move, Alt+2..6 = note value, "." = dot, R = rest, Del = delete, Ctrl+Z / Ctrl+Y.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    // Only "1" directly followed by another number makes a fret 10–19.
    if (!/^[0-9]$/.test(k) || ctrl || e.altKey) {
      if (!["Shift", "Alt", "Control", "Meta"].includes(k)) lastDigit.current = null;
    }
    if (ctrl && k.toLowerCase() === "s") {
      e.preventDefault();
      void save();
    } else if (ctrl && k.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (ctrl && k.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if (ctrl) return;
    else if (e.altKey && DUR_KEY[e.code.replace("Digit", "")]) {
      e.preventDefault();
      setDur(DUR_KEY[e.code.replace("Digit", "")]);
    } else if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      const digit = Number(k);
      const prev = lastDigit.current;
      // "1" then another digit within a moment: replace the fret-1 note just entered with fret 10–19.
      if (prev && prev.digit === 1 && !e.altKey && Date.now() - prev.at < 700 && hist.past.length === prev.past + 1) {
        const before = hist.past[hist.past.length - 1];
        lastDigit.current = null;
        const r = enterNote(before, prev.cursor, input, string, 10 + digit);
        if ("error" in r) return void toast.error(t(ERRORS[r.error]));
        setHist((h) => ({ past: h.past, doc: r.doc, future: [] }));
        setCur(clampCursor(r.doc, r.cur));
        return;
      }
      if (apply(enterNote(doc, cur, input, string, digit))) lastDigit.current = { at: Date.now(), digit, past: hist.past.length, cursor: cur };
    } else if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      setString((s) => Math.max(1, Math.min(6, s + (k === "ArrowUp" ? -1 : 1))));
    } else if (k === "ArrowRight" || k === "ArrowLeft") {
      e.preventDefault();
      if (k === "ArrowRight") next();
      else setCur((c) => move(doc, c, -1));
    } else if (k === ".") toggleDot();
    else if (k.toLowerCase() === "r") apply(enterRest(doc, cur, input));
    else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      apply(deleteAt(doc, cur));
    } else if (k === " ") {
      e.preventDefault();
      togglePlay();
    } else if (k === "Escape") setInput((i) => ({ ...i, chord: false, insert: false }));
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const part = doc.parts[cur.part];
  const status = [
    t("Bar {0} of {1}", cur.measure + 1, doc.measures.length),
    time,
    left > 0 ? t("{0} beats left", beats(left, time)) : t("Bar full"),
    selected ? (selected.rest ? t("Rest selected") : t("Note selected")) : t("Next note goes here"),
  ].join(" · ");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/guru/materi#partitur" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Materials")}
        </Link>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">{t("Not saved yet")}</span>}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />} {t("Save")}
          </Button>
        </div>
      </div>

      <input
        value={meta.title}
        onChange={(e) => {
          setMeta({ ...meta, title: e.target.value });
          setDirty(true);
        }}
        placeholder={t("Score title")}
        aria-label={t("Score title")}
        className="w-full rounded-lg bg-transparent px-1 text-2xl font-extrabold tracking-tight outline-none focus:bg-muted"
      />

      <details className="group rounded-xl border bg-card p-3" open={!pieceId}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
          {t("Score details")}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("Composer / source")}>
            <Input
              value={meta.composer}
              onChange={(e) => {
                setMeta({ ...meta, composer: e.target.value });
                setDirty(true);
              }}
              placeholder={t("e.g. Folk song, or your name")}
            />
          </Field>
          <Field label={t("Tempo (bpm)")} hint={t("The speed written in the score (100%).")}>
            <Input type="number" min={20} max={300} value={doc.tempo} onChange={(e) => setDocField("tempo", Math.max(20, Math.min(300, Number(e.target.value) || 80)))} />
          </Field>
          <Field label={t("Time signature")}>
            <Select value={doc.time} onChange={(e) => changeTime0(e.target.value)}>
              {TIMES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("Key signature")}>
            <Select value={doc.key} onChange={(e) => setDocField("key", Number(e.target.value))}>
              {MAJOR.map((m, i) => {
                const k = i - 7;
                return (
                  <option key={k} value={k}>
                    {t("{0} major / {1} minor", m, MINOR[i])} {k ? `(${Math.abs(k)}${k > 0 ? "♯" : "♭"})` : ""}
                  </option>
                );
              })}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={doc.pickup} onChange={(e) => setDocField("pickup", e.target.checked)} />
            {t("The first bar is a pickup bar (it is not filled up with rests)")}
          </label>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            {(["stage1", "stage2", "stage3"] as const).map((k, i) => (
              <Field key={k} label={t("Stage {0} (bpm)", i + 1)}>
                <Input
                  type="number"
                  min={20}
                  max={300}
                  value={meta[k]}
                  onChange={(e) => {
                    setMeta({ ...meta, [k]: Number(e.target.value) });
                    setDirty(true);
                  }}
                />
              </Field>
            ))}
            <button
              type="button"
              className="col-span-3 justify-self-start text-xs font-semibold text-primary hover:underline"
              onClick={() => {
                setMeta({ ...meta, stage1: Math.round(doc.tempo * 0.6), stage2: Math.round(doc.tempo * 0.8), stage3: doc.tempo });
                setDirty(true);
              }}
            >
              {t("Use 60% / 80% / 100% of the tempo")}
            </button>
          </div>
          <Field label={t("Copyright status")} hint={t("“Unknown” is never shown to students.")}>
            <Select
              value={meta.copyrightStatus}
              onChange={(e) => {
                setMeta({ ...meta, copyrightStatus: e.target.value as ScoreMetaState["copyrightStatus"] });
                setDirty(true);
              }}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {t(s.label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Source note (optional)")}>
            <Textarea
              rows={1}
              value={meta.sourceNote}
              onChange={(e) => {
                setMeta({ ...meta, sourceNote: e.target.value });
                setDirty(true);
              }}
              placeholder={t("e.g. Melody in the public domain, rewritten in C major.")}
            />
          </Field>
        </div>
      </details>

      {/* Note input toolbar, like MuseScore's. */}
      <div className="sticky top-14 z-20 grid gap-2 rounded-xl border bg-card/95 p-2 shadow-sm backdrop-blur lg:top-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" onClick={togglePlay} disabled={!player.ready} title={t("Play from the selected bar (Space)")}>
            {!player.ready ? <LoaderCircle className="animate-spin" /> : player.playing ? <Pause /> : <Play />}
          </Button>
          <Button size="sm" variant="outline" onClick={stop} disabled={!player.ready} aria-label={t("Stop")}>
            <Square />
          </Button>
          <Sep />
          {DUR_CODES.map((d, i) => (
            <ToolButton key={d} on={input.dur === d} onClick={() => setDur(d)} title={`${t(DUR_LABEL[d])} (Alt+${6 - i})`}>
              <span className="font-music translate-y-[0.35em] text-[1.6rem]">{GLYPH[d]}</span>
            </ToolButton>
          ))}
          <ToolButton on={input.dot} onClick={toggleDot} title={t("Dotted (.)")}>
            <span className="font-music text-[1.6rem]">{GLYPH_DOT}</span>
          </ToolButton>
          <ToolButton on={false} onClick={() => apply(enterRest(doc, cur, input))} title={t("Rest (R)")}>
            <span className="font-music translate-y-[0.1em] text-[1.4rem]">{GLYPH_REST}</span>
          </ToolButton>
          <Sep />
          <ToolButton on={input.chord} onClick={() => setInput((i) => ({ ...i, chord: !i.chord }))} title={t("Chord: add notes to the selected beat instead of moving on")} wide>
            {t("Chord")}
          </ToolButton>
          <ToolButton on={input.insert} onClick={() => setInput((i) => ({ ...i, insert: !i.insert }))} title={t("Insert before the selected note instead of overwriting it")} wide>
            {t("Insert")}
          </ToolButton>
          <ToolButton on={false} onClick={() => apply(deleteAt(doc, cur))} title={t("Delete: a note becomes a rest, a rest is removed (Del)")}>
            <Delete className="size-4.5" />
          </ToolButton>
          <Sep />
          <ToolButton on={false} onClick={undo} disabled={!hist.past.length} title={t("Undo (Ctrl+Z)")}>
            <Undo2 className="size-4.5" />
          </ToolButton>
          <ToolButton on={false} onClick={redo} disabled={!hist.future.length} title={t("Redo (Ctrl+Y)")}>
            <Redo2 className="size-4.5" />
          </ToolButton>
          <ToolButton on={false} onClick={() => setCur((c) => move(doc, c, -1))} title={t("Previous (←)")}>
            <ChevronLeft className="size-4.5" />
          </ToolButton>
          <ToolButton on={false} onClick={next} title={t("Next (→)")}>
            <ChevronRight className="size-4.5" />
          </ToolButton>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {doc.parts.map((p, i) => (
            <ToolButton key={i} on={cur.part === i} onClick={() => setCur((c) => clampCursor(doc, { ...c, part: i, index: 0 }))} wide>
              {p.name}
            </ToolButton>
          ))}
          {doc.parts.length < MAX_PARTS && (
            <ToolButton on={false} onClick={() => commit(addPart(doc, t("Guitar {0}", doc.parts.length + 1)))} title={t("Add a second guitar (duet)")} wide>
              <Plus className="size-3.5" /> {t("Guitar")}
            </ToolButton>
          )}
          <Sep />
          {([0, 1] as const).map((v) => (
            <ToolButton key={v} on={cur.voice === v} onClick={() => setCur((c) => clampCursor(doc, { ...c, voice: v, index: 0 }))} title={v ? t("Voice 2: e.g. a bass note held under the melody (stems down)") : undefined} wide>
              {t("Voice {0}", v + 1)}
            </ToolButton>
          ))}
          <Sep />
          <ToolButton on={showTab} onClick={() => setShowTab((s) => !s)} wide>
            {t("Tab")}
          </ToolButton>
          <ToolButton on={showFrets} onClick={() => setShowFrets((s) => !s)} wide>
            {t("Fretboard")}
          </ToolButton>
          <span className="ml-auto min-w-0 truncate text-muted-foreground">{status}</span>
        </div>
      </div>

      <ScoreCanvas
        doc={doc}
        title={meta.title}
        cursor={cur}
        showTab={showTab}
        handle={canvas}
        onPlayer={setPlayer}
        onSelect={(c, s) => {
          setCur(clampCursor(doc, c));
          if (s) setString(s);
        }}
      />

      {/* Selected note + bar */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="grid gap-2 rounded-xl border bg-card p-3">
          <h2 className="text-sm font-bold">{t("Selected note")}</h2>
          {!selected ? (
            <p className="text-sm text-muted-foreground">{t("Tap a fret or type a number to write the next note here.")}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t("Chord name above the staff")} hint={t("For the teacher's accompaniment, e.g. C, G7, Am, F#m.")}>
                <ChordInput key={`${cur.part}-${cur.voice}-${cur.measure}-${cur.index}`} value={selected.chord ?? ""} onChange={setChordName} disabled={false} />
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-semibold">{t("Right-hand finger")}</p>
                <div className="flex gap-1">
                  {FINGERS.map((f) => (
                    <ToolButton key={f} on={selectedNote?.finger === f} onClick={() => setFinger(f)} disabled={!selectedNote} title={selectedNote ? t("String {0}", selectedNote.string) : t("Select a note first")}>
                      <span className="font-serif text-base italic">{f}</span>
                    </ToolButton>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
        <section className="grid gap-2 rounded-xl border bg-card p-3">
          <h2 className="text-sm font-bold">{t("Bar {0}", cur.measure + 1)}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label={t("Time signature")}>
              <Select value={time} onChange={(e) => changeTime(e.target.value)}>
                {[...new Set([...TIMES, time])].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("Bar line")}>
              <Select
                value={measure.barline ?? ""}
                onChange={(e) =>
                  setMeasure((m) => {
                    if (e.target.value) m.barline = e.target.value as "double" | "final";
                    else delete m.barline;
                  })
                }
              >
                <option value="">{t("Normal")}</option>
                <option value="double">{t("Double")}</option>
                <option value="final">{t("Final")}</option>
              </Select>
            </Field>
            <Field label={t("Repeat sign")}>
              <Select
                value={measure.text ?? ""}
                onChange={(e) =>
                  setMeasure((m) => {
                    if (e.target.value) m.text = e.target.value;
                    else delete m.text;
                  })
                }
              >
                <option value="">-</option>
                <option>Fine</option>
                <option>D.C. al Fine</option>
                <option>D.C.</option>
              </Select>
            </Field>
            <Field label={t("Section mark")}>
              <MarkInput key={cur.measure} value={measure.mark ?? ""} onChange={(v) => setMeasure((m) => (v ? (m.mark = v) : delete m.mark))} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => apply(insertMeasure(doc, cur, true))}>
              <ListPlus /> {t("Bar before")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => apply(insertMeasure(doc, cur, false))}>
              <ListPlus /> {t("Bar after")}
            </Button>
            <Button size="sm" variant="danger-soft" onClick={() => apply(deleteMeasure(doc, cur))}>
              <Trash2 /> {t("Delete bar")}
            </Button>
            {doc.parts.length > 1 && (
              <Button
                size="sm"
                variant="danger-soft"
                onClick={() => {
                  const r = removePart(doc, cur.part);
                  if ("error" in r) return void toast.error(t(ERRORS[r.error]));
                  commit(r, { ...cur, part: 0, index: 0 });
                }}
              >
                <Trash2 /> {t("Remove {0}", part?.name ?? "")}
              </Button>
            )}
          </div>
        </section>
      </div>

      <details className="rounded-xl border bg-card p-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-bold">
          <CircleHelp className="size-4" /> {t("How to write notes")}
        </summary>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-muted-foreground">
          <li>{t("Pick a note value at the top, then tap a string and fret on the fretboard. The cursor moves on by itself; a full bar goes on to the next bar.")}</li>
          <li>{t("Tap a note in the score to select it. A new note there replaces it; a new note value changes its length.")}</li>
          <li>{t("Chord on: notes go into the same beat (double stops, chords). Tap Next (→) to move on.")}</li>
          <li>{t("Voice 2 is for a second line on the same guitar, e.g. a bass note held under the melody.")}</li>
          <li>{t("A bar that is not full is filled with rests, like in MuseScore.")}</li>
          <li>{t("Keyboard: numbers = fret on the highlighted string (1 then 2 quickly = 12), ↑/↓ = string, ←/→ = move, Alt+2…6 = note value, . = dot, R = rest, Del = delete, Space = play, Ctrl+Z / Ctrl+Y = undo / redo, Ctrl+S = save.")}</li>
        </ul>
      </details>

      {showFrets && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 rounded-xl border bg-card/95 p-2 shadow-lg backdrop-blur lg:bottom-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("Tap a fret to write a note · current string: {0}", string)}</span>
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setFrets(frets === 12 ? MAX_FRET : 12)}>
              {frets === 12 ? t("Show frets 13–{0}", MAX_FRET) : t("Frets 0–12 only")}
            </button>
          </div>
          <Fretboard frets={frets} string={string} active={active} flats={doc.key < 0} onPick={pick} onString={setString} />
        </div>
      )}
    </div>
  );

  function changeTime0(value: string) {
    const r = setTime(doc, 0, value);
    if ("error" in r) toast.error(t(ERRORS[r.error]));
    else commit(r.doc, cur);
  }
}

function Sep() {
  return <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />;
}

function ToolButton({ on, onClick, children, title, disabled, wide }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1 overflow-hidden rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40",
        wide ? "px-2.5" : "w-9",
        on ? "border-primary bg-primary-soft text-primary" : "border-transparent hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Chord name, saved when it is valid and the field loses focus or Enter is pressed. */
function ChordInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const t = useT();
  const [v, setV] = useState(value);
  const ok = !v.trim() || CHORD_RE.test(v.trim());
  const done = () => ok && v.trim() !== value && onChange(v);
  return (
    <div>
      <Input
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={done}
        onKeyDown={(e) => e.key === "Enter" && done()}
        placeholder="C, G7, Am"
        className={cn("w-32", !ok && "border-danger")}
      />
      {!ok && <p className="mt-1 text-xs text-danger">{t("Use a name like C, G7, Am, F#m, Bbmaj7.")}</p>}
    </div>
  );
}

function MarkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  const done = () => v.trim() !== value && onChange(v.trim());
  return <Input value={v} maxLength={40} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === "Enter" && done()} placeholder="A, Latihan 1" />;
}
