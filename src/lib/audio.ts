"use client";

/*
 * Small Web Audio helpers for the metronome and the practice timer's segment signal. Plain Web Audio (no samples
 * to download) so it works offline and starts instantly. Browsers only allow sound after a tap: call
 * `unlockAudio()` from a click handler first.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
  }
  return ctx;
}

export async function unlockAudio() {
  const c = context();
  if (c && c.state !== "running") await c.resume().catch(() => {});
}

export const audioTime = () => context()?.currentTime ?? 0;

/** A short wood-block-like click at `time` (AudioContext seconds). The first beat of a bar is higher and louder. */
export function scheduleClick(time: number, accent: boolean) {
  const c = context();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(accent ? 1760 : 1175, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(gain).connect(c.destination);
  osc.start(time);
  osc.stop(time + 0.06);
}

/** A soft three-note chime (segment change / end of practice). Returns a function that cancels it if not played yet. */
export function scheduleChime(time: number, final = false): () => void {
  const c = context();
  if (!c) return () => {};
  const notes = final ? [784, 988, 1175, 1568] : [659, 880, 1175];
  const nodes: OscillatorNode[] = [];
  notes.forEach((f, i) => {
    const at = time + i * 0.18;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.65);
    nodes.push(osc);
  });
  // Stopping a node before its start time means it never sounds.
  return () =>
    nodes.forEach((n) => {
      try {
        n.stop(0);
      } catch {
        /* already stopped */
      }
    });
}

/**
 * Start a metronome. `getBpm` is read before every beat, so tempo changes apply at once. `onBeat(i)` is called
 * close to when beat i (0 = first of the bar) sounds. Returns stop().
 * Uses the usual look-ahead scheduler: a timer every 25 ms schedules the clicks of the next 120 ms on the audio clock,
 * so the beat stays steady even when the page is busy.
 */
export function startMetronome(getBpm: () => number, beatsPerBar: number, onBeat?: (beat: number) => void): () => void {
  const c = context();
  if (!c) return () => {};
  let next = c.currentTime + 0.08;
  let beat = 0;
  const visual: ReturnType<typeof setTimeout>[] = [];
  const timer = setInterval(() => {
    while (next < c.currentTime + 0.12) {
      const b = beat;
      scheduleClick(next, b === 0);
      if (onBeat) visual.push(setTimeout(() => onBeat(b), Math.max(0, (next - c.currentTime) * 1000)));
      next += 60 / Math.max(20, getBpm());
      beat = (beat + 1) % beatsPerBar;
    }
    if (visual.length > 50) visual.splice(0, visual.length - 10);
  }, 25);
  return () => {
    clearInterval(timer);
    visual.forEach(clearTimeout);
  };
}
