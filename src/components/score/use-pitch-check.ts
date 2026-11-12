"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as AlphaTabTypes from "@coderline/alphatab";
import { useMicPitch, type MicReading } from "@/components/audio/use-mic-pitch";
import { freqToMidi, median } from "@/lib/pitch";
import type { Api } from "./alphatab";

type Beat = AlphaTabTypes.model.Beat;
export type Verdict = "ok" | "wrong" | "missed";

/** One time a beat was played (a beat inside a repeat is played more than once). */
type Occurrence = { start: number; end: number; beat: Beat; expected: number[]; samples: number[]; verdict?: Verdict };

export type CheckResult = { beat: Beat; verdict: Verdict; heard: number | null; expected: number[] };

/**
 * Microphone input usually reaches us this late (device + analysis window): a reading is matched to the beat that
 * was playing this long before it.
 */
const LATENCY_MS = 110;
/** A beat is judged this long after it ended, so a slightly late note still counts. */
const GRACE_MS = 220;
const TICKS_PER_QUARTER = 960;

/** Notes sounding on a beat in any voice of its bar (a held bass note in voice 2 is also a right note). */
function notesAt(beat: Beat): number[] {
  const from = beat.playbackStart;
  const to = from + beat.playbackDuration;
  const out = new Set<number>();
  for (const v of beat.voice.bar.voices)
    for (const b of v.beats) {
      if (b.isRest) continue;
      if (b.playbackStart < to && b.playbackStart + b.playbackDuration > from) for (const n of b.notes) out.add(n.realValue);
    }
  return [...out];
}

/** Right note: the same pitch, or an octave off (detectors and guitar harmonics can jump an octave). */
const matches = (heard: number, expected: number[]) => expected.some((e) => Math.abs(heard - e) < 0.5 || Math.abs(Math.abs(heard - e) - 12) < 0.5);

/**
 * "Check my notes": while the score plays, the microphone listens and every note of the chosen part (guitar) is
 * judged right, wrong or not heard. Monophonic: in a chord, any of its notes counts.
 */
const newRunId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

export function usePitchCheck({ api, track, bpm, playing }: { api: Api | null; track: number; bpm: number; playing: boolean }) {
  const pos = useRef({ tick: 0, at: 0 });
  /** One id per run (from one reset to the next), so a saved score is updated, not duplicated, after a pause. */
  const [runId, setRunId] = useState(newRunId);
  const occ = useRef(new Map<number, Occurrence>());
  const hint = useRef<AlphaTabTypes.midi.MidiTickLookupFindBeatResult | null>(null);
  const [results, setResults] = useState<Map<Beat, CheckResult>>(new Map());
  const [live, setLive] = useState<{ expected: number[] | null; heard: number | null } | null>(null);
  const [stats, setStats] = useState({ ok: 0, total: 0 });
  const state = useRef({ bpm, playing, track });
  state.current = { bpm, playing, track };

  useEffect(() => {
    if (!api) return;
    return api.playerPositionChanged.on((e) => {
      pos.current = { tick: e.currentTick, at: performance.now() };
    });
  }, [api]);

  const tickAt = (ms: number) => {
    const rate = (state.current.bpm * TICKS_PER_QUARTER) / 60_000;
    return pos.current.tick + Math.max(0, ms - pos.current.at) * rate;
  };

  const find = (tick: number) => {
    const r = api?.tickCache?.findBeat(new Set([state.current.track]), tick, hint.current) ?? null;
    if (r) hint.current = r;
    return r;
  };

  const judge = useCallback((now: number) => {
    const rate = (state.current.bpm * TICKS_PER_QUARTER) / 60_000;
    const done = tickAt(now) - GRACE_MS * rate;
    let changed = false;
    for (const o of occ.current.values()) {
      if (o.verdict || o.end > done) continue;
      const good = o.samples.filter((m) => matches(m, o.expected)).length;
      o.verdict = !o.samples.length ? "missed" : good >= 1 && good / o.samples.length >= 0.3 ? "ok" : "wrong";
      changed = true;
    }
    if (!changed) return;
    const next = new Map<Beat, CheckResult>();
    let ok = 0;
    let total = 0;
    for (const o of occ.current.values()) {
      if (!o.verdict) continue;
      total++;
      if (o.verdict === "ok") ok++;
      next.set(o.beat, { beat: o.beat, verdict: o.verdict, heard: o.samples.length ? median(o.samples) : null, expected: o.expected });
    }
    setResults(next);
    setStats({ ok, total });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onReading = (r: MicReading) => {
    const heard = r.freq ? freqToMidi(r.freq) : null;
    if (!state.current.playing || !api) {
      setLive((l) => ({ expected: l?.expected ?? null, heard }));
      return;
    }
    const nowBeat = find(tickAt(r.at));
    setLive({ expected: nowBeat && !nowBeat.beat.isRest ? notesAt(nowBeat.beat) : null, heard });
    const at = find(tickAt(r.at - LATENCY_MS));
    if (at && !at.beat.isRest && at.beat.notes.length) {
      let o = occ.current.get(at.start);
      if (!o) occ.current.set(at.start, (o = { start: at.start, end: at.end, beat: at.beat, expected: notesAt(at.beat), samples: [] }));
      if (heard !== null && !o.verdict) o.samples.push(heard);
    }
    judge(r.at);
  };

  const mic = useMicPitch({ onReading, intervalMs: 30 });

  const reset = useCallback(() => {
    occ.current = new Map();
    hint.current = null;
    setResults(new Map());
    setStats({ ok: 0, total: 0 });
    setRunId(newRunId());
  }, []);

  // Judge what is left when playback stops.
  useEffect(() => {
    if (!playing) judge(performance.now() + 60_000);
  }, [playing, judge]);

  return { mic, results, live, stats, reset, runId };
}
