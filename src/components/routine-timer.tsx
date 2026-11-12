"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, Flag, Minus, Pause, Play, Plus, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { savePracticeSession } from "@/app/actions/practice";
import { Metronome } from "@/components/metronome";
import { ScorePlayer } from "@/components/score/score-player";
import { TempoLadder } from "@/components/tempo-ladder";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { audioTime, scheduleChime, unlockAudio } from "@/lib/audio";
import { SEGMENT_LABEL } from "@/lib/labels";
import { ROUTINE_KEYS, type RoutineSegments } from "@/lib/routine";
import { GENERAL_BPM_KEY } from "@/lib/practice-keys";
import { cn, shortLabel } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Key = (typeof ROUTINE_KEYS)[number];

const SEGMENT_HINT: Record<Key, string> = {
  warmup: "Sit up straight, check your posture, and move your fingers slowly.",
  technique: "Technique from your lesson: rest stroke / free stroke, block position, open strings.",
  etude: "The exercise you are learning now. Slowly, two bars at a time.",
  piece: "The piece you are learning. Play it through without stopping.",
};

/** Timer state, saved in localStorage so a reload or a closed tab does not lose the session. */
type State = {
  v: 2;
  startedAt: string | null;
  index: number;
  /** Milliseconds spent per segment, not counting the current run. */
  spent: number[];
  /** Date.now() when the current run started, null while paused. */
  runningSince: number | null;
  finished: boolean;
  endedAt: string | null;
  /** Highest metronome tempo per piece id ("general" = no piece picked). */
  maxBpm: Record<string, number>;
  /** The piece picked next to the metronome. */
  pieceId: string;
};

const fresh = (n: number, pieceId = GENERAL_BPM_KEY): State => ({
  v: 2,
  startedAt: null,
  index: 0,
  spent: Array(n).fill(0),
  runningSince: null,
  finished: false,
  endedAt: null,
  maxBpm: {},
  pieceId,
});

export type PracticePiece = {
  id: string;
  title: string;
  targetBpm: number;
  stage: number;
  /** Notation, so the score can be shown and played along with at the practice tempo. */
  fileUrl: string;
  defaultBpm: number;
  stageBpm: Record<"1" | "2" | "3", number>;
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const MOODS = ["😫", "😕", "😐", "🙂", "😄"];

export function RoutineTimer({
  userId,
  routine,
  learning,
  pieces = [],
}: {
  userId: string;
  routine: RoutineSegments;
  learning?: { title: string; href: string } | null;
  /** Pieces the student may practise, with the tempo of the next stage to reach. */
  pieces?: PracticePiece[];
}) {
  const t = useT();
  const { warmup, technique, etude, piece } = routine;
  const segments = useMemo(() => {
    const r: RoutineSegments = { warmup, technique, etude, piece };
    return ROUTINE_KEYS.filter((k) => r[k] > 0).map((k) => ({ key: k, ms: r[k] * 60_000 }));
  }, [warmup, technique, etude, piece]);
  const storageKey = `hg-practice-${userId}`;
  const defaultPieceId = pieces.at(-1)?.id ?? GENERAL_BPM_KEY;
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [savedMinutes, setSavedMinutes] = useState<number | null>(null);
  const chimes = useRef<(() => void)[]>([]);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  // The tempo of the picked piece: one number for the score player and the tempo ladder.
  const [pieceBpm, setPieceBpm] = useState<number | null>(null);
  const [scorePlaying, setScorePlaying] = useState(false);
  const pickedPiece = pieces.find((p) => p.id === state?.pieceId);
  useEffect(() => setPieceBpm(pickedPiece?.targetBpm ?? null), [pickedPiece?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Like the metronome: a tempo counts as played after 10 seconds of playing the score at it.
  useEffect(() => {
    if (!scorePlaying || !pickedPiece || !pieceBpm) return;
    const pid = pickedPiece.id;
    const id = setTimeout(() => setState((s) => (s ? { ...s, maxBpm: { ...s.maxBpm, [pid]: Math.max(s.maxBpm[pid] ?? 0, pieceBpm) } } : s)), 10_000);
    return () => clearTimeout(id);
  }, [scorePlaying, pieceBpm, pickedPiece?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore a session from this device (only if it is from the last 24 hours and the segments still match).
  useEffect(() => {
    // Start with the newest piece the student has (the one they are most likely working on).
    let s = fresh(segments.length, defaultPieceId);
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? (JSON.parse(raw) as State) : null;
      if (saved?.v === 2 && saved.spent?.length === segments.length && saved.startedAt && Date.now() - Date.parse(saved.startedAt) < 86_400_000) s = saved;
    } catch {
      /* storage unavailable */
    }
    // Read browser storage after mount (not during render) to avoid a hydration mismatch.
    setState(s);
  }, [storageKey, segments.length, defaultPieceId]);

  useEffect(() => {
    if (!state) return;
    try {
      if (state.startedAt) localStorage.setItem(storageKey, JSON.stringify(state));
      else localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable */
    }
  }, [state, storageKey]);

  const running = Boolean(state?.runningSince) && !state?.finished;

  // Keep the screen on while practising (where the browser supports it).
  useEffect(() => {
    if (!running) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (wakeLock.current = l))
      .catch(() => {});
    return () => {
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [running]);

  const cancelChimes = () => {
    chimes.current.forEach((c) => c());
    chimes.current = [];
  };

  /** Schedule a chime at every remaining segment boundary on the audio clock, so it sounds even in a background tab. */
  const scheduleChimes = useCallback(
    (s: State, at: number) => {
      cancelChimes();
      let ahead = segments[s.index].ms - s.spent[s.index];
      const base = audioTime();
      for (let i = s.index; i < segments.length; i++) {
        if (i > s.index) ahead += segments[i].ms;
        chimes.current.push(scheduleChime(base + Math.max(0, ahead - (Date.now() - at)) / 1000, i === segments.length - 1));
      }
    },
    [segments],
  );

  useEffect(() => () => cancelChimes(), []);

  // Buzz the phone when a segment ends (the chime may be muted).
  const index = state?.index ?? 0;
  const finished = state?.finished ?? false;
  const prev = useRef({ index, finished });
  useEffect(() => {
    const p = prev.current;
    prev.current = { index, finished };
    if (finished && !p.finished) navigator.vibrate?.([200, 100, 200, 100, 400]);
    else if (index > p.index) navigator.vibrate?.(300);
  }, [index, finished]);

  // The clock: advance to the next segment when the current one is used up (carrying the extra time over).
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      setState((s) => {
        if (!s || !s.runningSince || s.finished) return s;
        const spent = [...s.spent];
        let index = s.index;
        let since = s.runningSince;
        let changed = false;
        while (index < segments.length && spent[index] + (n - since) >= segments[index].ms) {
          const used = segments[index].ms - spent[index];
          spent[index] = segments[index].ms;
          since += used;
          index++;
          changed = true;
        }
        if (!changed) return s;
        if (index >= segments.length) return { ...s, spent, index: segments.length - 1, runningSince: null, finished: true, endedAt: new Date(n).toISOString() };
        return { ...s, spent, index, runningSince: since };
      });
    };
    tick();
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running, segments]);

  if (!segments.length) return <p className="text-sm text-muted-foreground">{t("Your practice timer has no minutes set. Ask your teacher.")}</p>;
  if (!state) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;

  const selected = pieces.find((p) => p.id === state.pieceId);
  const current = (i: number) => state.spent[i] + (i === state.index && state.runningSince ? now - state.runningSince : 0);
  const seg = segments[state.index];
  const remaining = seg.ms - current(state.index);
  const totalMs = segments.reduce((n, _, i) => n + current(i), 0);
  const plannedMs = segments.reduce((n, s) => n + s.ms, 0);

  /** Time spent so far, with the current run added to its segment. */
  function stopClock(s: State, n: number): number[] {
    const spent = [...s.spent];
    if (s.runningSince) spent[s.index] += n - s.runningSince;
    return spent;
  }

  async function start() {
    if (!state) return;
    await unlockAudio();
    const n = Date.now();
    const next = { ...state, startedAt: state.startedAt ?? new Date(n).toISOString(), runningSince: n };
    setNow(n);
    setState(next);
    scheduleChimes(next, n);
  }

  function pause() {
    if (!state?.runningSince) return;
    cancelChimes();
    setState({ ...state, spent: stopClock(state, Date.now()), runningSince: null });
  }

  function finish() {
    if (!state) return;
    cancelChimes();
    const n = Date.now();
    setState({ ...state, spent: stopClock(state, n), runningSince: null, finished: true, endedAt: new Date(n).toISOString() });
  }

  function skip() {
    if (!state) return;
    if (state.index >= segments.length - 1) return finish();
    const n = Date.now();
    const next = { ...state, spent: stopClock(state, n), index: state.index + 1, runningSince: state.runningSince ? n : null };
    setState(next);
    if (next.runningSince) scheduleChimes(next, n);
  }

  function reset() {
    if (state?.startedAt && !window.confirm(t("Throw away this practice session?"))) return;
    cancelChimes();
    setState(fresh(segments.length, state?.pieceId));
  }

  if (savedMinutes !== null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-9" />
        </div>
        <h2 className="text-2xl font-extrabold">{t("Great work!")}</h2>
        <p className="text-sm text-muted-foreground">{t("{0} minutes of practice were saved to your journal.", savedMinutes)}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/siswa/jurnal">{t("Open journal")}</Link>
          </Button>
          <Button variant="outline" onClick={() => setSavedMinutes(null)}>
            {t("Practise again")}
          </Button>
        </div>
      </div>
    );
  }

  if (state.finished) {
    return (
      <SaveForm
        state={state}
        segments={segments.map((s) => s.key)}
        pieces={pieces}
        onSaved={(minutes) => {
          setState(fresh(segments.length, state.pieceId)); // also clears the copy in localStorage
          setSavedMinutes(minutes);
        }}
        onBack={() => setState({ ...state, finished: false, endedAt: null })}
      />
    );
  }

  const bpmMax = selected ? selected.defaultBpm * 2 : 220;
  const setBpm = (n: number) => setPieceBpm(Math.max(20, Math.min(bpmMax, Math.round(n))));

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="grid gap-4">
          <div className="rounded-2xl border bg-card p-5 text-center shadow-sm">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">
              {t("Segment {0} of {1}", state.index + 1, segments.length)}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">{t(SEGMENT_LABEL[seg.key])}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t(SEGMENT_HINT[seg.key])}</p>
            <p className={cn("my-5 text-7xl font-extrabold tabular-nums", running ? "text-foreground" : "text-muted-foreground")} aria-live="off">
              {mmss(remaining)}
            </p>
            <Progress value={(current(state.index) / seg.ms) * 100} label={t("Segment progress")} />
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {running ? (
                <Button size="lg" variant="secondary" onClick={pause}>
                  <Pause /> {t("Pause")}
                </Button>
              ) : (
                <Button size="lg" onClick={start}>
                  <Play /> {state.startedAt ? t("Continue") : t("Start practising")}
                </Button>
              )}
              {state.startedAt && (
                <>
                  <Button size="lg" variant="outline" onClick={skip}>
                    <SkipForward /> {state.index >= segments.length - 1 ? t("Finish") : t("Next segment")}
                  </Button>
                  <Button size="lg" variant="outline" onClick={finish}>
                    <Flag /> {t("Done for today")}
                  </Button>
                </>
              )}
            </div>
            {learning && (
              <p className="mt-4 text-sm">
                {t("Now learning:")}{" "}
                <Link href={learning.href} className="font-semibold text-primary hover:underline">
                  {learning.title}
                </Link>
              </p>
            )}
          </div>

          <ol className="grid gap-2 rounded-xl border bg-card p-4 shadow-xs">
            {segments.map((s, i) => {
              const done = i < state.index;
              return (
                <li key={s.key} className={cn("grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-lg p-2", i === state.index && "bg-primary-soft")}>
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", done ? "bg-success text-white" : "bg-muted")}>
                    {done ? <CircleCheck className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t(SEGMENT_LABEL[s.key])}</p>
                    <Progress value={(current(i) / s.ms) * 100} className="mt-1 h-1.5" label={t(SEGMENT_LABEL[s.key])} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {mmss(current(i))} / {Math.round(s.ms / 60_000)}′
                  </span>
                </li>
              );
            })}
            <li className="flex items-center justify-between border-t px-2 pt-3 text-sm">
              <span className="font-semibold">{t("Total")}</span>
              <span className="tabular-nums">
                {mmss(totalMs)} / {Math.round(plannedMs / 60_000)}′
              </span>
            </li>
            {state.startedAt && (
              <li className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
                  <RotateCcw /> {t("Start over")}
                </Button>
              </li>
            )}
          </ol>
        </div>

        <div className="grid gap-3">
          {pieces.length > 0 && (
            <label className="grid gap-1.5 rounded-xl border bg-card p-3 text-sm font-semibold shadow-xs">
              {t("Piece you are practising")}
              <Select value={selected?.id ?? GENERAL_BPM_KEY} onChange={(e) => setState({ ...state, pieceId: e.target.value })}>
                <option value={GENERAL_BPM_KEY}>{t("No piece (metronome only)")}</option>
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {shortLabel(p.title)}
                  </option>
                ))}
              </Select>
              {selected && (
                <span className="text-xs font-normal text-muted-foreground">
                  {selected.stage >= 3 ? t("All 3 stages reached. Keep it at {0} bpm.", selected.targetBpm) : t("Next target: stage {0} at {1} bpm.", selected.stage + 1, selected.targetBpm)}
                </span>
              )}
            </label>
          )}
          {selected && pieceBpm ? (
            <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{t("Tempo")}</h3>
                <span className="text-xs text-muted-foreground">{t("Same tempo as the score below")}</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" aria-label={t("Slower")} onClick={() => setBpm(pieceBpm - 1)}>
                  <Minus />
                </Button>
                <div className="min-w-24 text-center">
                  <p className="text-5xl leading-none font-extrabold tabular-nums">{pieceBpm}</p>
                  <p className="mt-1 text-xs text-muted-foreground">bpm</p>
                </div>
                <Button variant="outline" size="icon" aria-label={t("Faster")} onClick={() => setBpm(pieceBpm + 1)}>
                  <Plus />
                </Button>
              </div>
              <TempoLadder bpm={pieceBpm} onBpm={setBpm} max={bpmMax} best={state.maxBpm[selected.id]} />
            </div>
          ) : (
            // key: a new piece starts the metronome at that piece's target tempo
            <Metronome
              key={selected?.id ?? GENERAL_BPM_KEY}
              compact
              initialBpm={selected?.targetBpm ?? 60}
              onMaxBpm={(b) =>
                setState((s) => (s ? { ...s, maxBpm: { ...s.maxBpm, [s.pieceId]: Math.max(s.maxBpm[s.pieceId] ?? 0, b) } } : s))
              }
            />
          )}
        </div>
      </div>
      {selected && pieceBpm && (
        <section className="grid gap-2">
          <h2 className="text-lg font-extrabold">{selected.title}</h2>
          <ScorePlayer
            key={selected.id}
            practice
            fileUrl={selected.fileUrl}
            defaultBpm={selected.defaultBpm}
            stageBpm={selected.stageBpm}
            bpm={pieceBpm}
            onBpmChange={setBpm}
            onPlayingChange={setScorePlaying}
          />
        </section>
      )}
    </div>
  );
}

function SaveForm({ state, segments, pieces, onSaved, onBack }: { state: State; segments: Key[]; pieces: PracticePiece[]; onSaved: (minutes: number) => void; onBack: () => void }) {
  const t = useT();
  const [mood, setMood] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const seconds = Object.fromEntries(ROUTINE_KEYS.map((k) => [k, 0])) as Record<Key, number>;
  segments.forEach((k, i) => (seconds[k] = Math.round(state.spent[i] / 1000)));
  const total = Object.values(seconds).reduce((a, b) => a + b, 0);

  async function save() {
    setPending(true);
    const r = await savePracticeSession({
      startedAt: state.startedAt!,
      endedAt: state.endedAt ?? new Date().toISOString(),
      seconds,
      maxBpm: state.maxBpm,
      mood,
      difficulty,
      note,
    });
    setPending(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(r.message);
    onSaved(Math.round(total / 60));
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold">{t("Practice finished")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("You practised {0}.", mmss(total * 1000))}</p>
      </div>
      <ul className="grid gap-1 text-sm">
        {segments.map((k) => (
          <li key={k} className="flex justify-between rounded-lg bg-muted px-3 py-2">
            <span>{t(SEGMENT_LABEL[k])}</span>
            <span className="tabular-nums">{mmss(seconds[k] * 1000)}</span>
          </li>
        ))}
        {Object.entries(state.maxBpm).map(([id, bpm]) => (
          <li key={id} className="flex justify-between gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="min-w-0 truncate">
              {t("Highest metronome tempo")}
              {id !== GENERAL_BPM_KEY && `: ${pieces.find((p) => p.id === id)?.title ?? ""}`}
            </span>
            <span className="shrink-0 tabular-nums">{bpm} bpm</span>
          </li>
        ))}
      </ul>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("How did it feel?")}</legend>
        <div className="flex justify-between gap-1">
          {MOODS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(mood === i + 1 ? null : i + 1)}
              aria-pressed={mood === i + 1}
              aria-label={t("Mood {0} of 5", i + 1)}
              className={cn("grid size-12 place-items-center rounded-xl border text-2xl transition", mood === i + 1 ? "border-primary bg-primary-soft scale-110" : "opacity-70 hover:opacity-100")}
            >
              {m}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("How hard was the material?")}</legend>
        <div className="grid grid-cols-5 gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDifficulty(difficulty === n ? null : n)}
              aria-pressed={difficulty === n}
              className={cn("h-11 rounded-lg border text-sm font-bold", difficulty === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{t("Easy")}</span>
          <span>{t("Very hard")}</span>
        </p>
      </fieldset>

      <label className="grid gap-1.5 text-sm font-semibold">
        {t("Notes (what was hard, what went well)")}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={t("E.g. string ② still buzzes at fret 1")} />
      </label>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          {t("Back to timer")}
        </Button>
        <Button size="lg" onClick={save} disabled={pending || total < 60}>
          {pending ? t("Saving…") : t("Save to journal")}
        </Button>
      </div>
      {total < 60 && <p className="text-center text-xs text-danger">{t("Practise at least 1 minute before saving.")}</p>}
    </div>
  );
}
