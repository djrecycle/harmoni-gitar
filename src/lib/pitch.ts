/*
 * Pitch detection for the tuner and the "check my notes" practice mode. Safe for client code (no DOM).
 * detectPitch() is the YIN algorithm (de Cheveigné & Kawahara, 2002) with parabolic interpolation: accurate to
 * about a cent on a sustained guitar string, and robust against the octave errors simpler autocorrelation makes.
 * One voice at a time: for a chord it finds the strongest/lowest clear pitch.
 */

export type Pitch = { freq: number; clarity: number };

const MIN_FREQ = 60; // below the lowest string of common tunings (C2 = 65 Hz)
const MAX_FREQ = 1400; // above fret 19 of the first string (B5 = 988 Hz), with room for harmonics
const THRESHOLD = 0.12;

/** Loudness (RMS) of a buffer, 0..1. */
export function rms(buf: Float32Array) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/**
 * The fundamental frequency in `buf`, or null when it is too quiet or not clearly pitched.
 * `minRms` is the noise gate (raise it in a noisy room).
 */
export function detectPitch(buf: Float32Array, sampleRate: number, minRms = 0.01): Pitch | null {
  if (rms(buf) < minRms) return null;
  const maxTau = Math.min(Math.floor(sampleRate / MIN_FREQ), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
  const n = buf.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  // Difference function.
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference.
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    d[tau] = running ? (d[tau] * tau) / running : 1;
  }
  // First dip below the threshold (then its local minimum).
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < THRESHOLD) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the minimum for sub-sample accuracy.
  const x0 = tau > 1 ? d[tau - 1] : d[tau];
  const x2 = tau < maxTau ? d[tau + 1] : d[tau];
  const denom = x0 + x2 - 2 * d[tau];
  const better = denom ? tau + (x0 - x2) / (2 * denom) : tau;
  return { freq: sampleRate / better, clarity: 1 - d[tau] };
}

/** Frequency -> MIDI note number (fractional), for a given A4. */
export const freqToMidi = (freq: number, a4 = 440) => 69 + 12 * Math.log2(freq / a4);
export const midiToFreq = (midi: number, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);

const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

/** "E2", "F♯4" (or "G♭4" with flats). */
export function noteName(midi: number, flats = false) {
  const m = Math.round(midi);
  return `${(flats ? FLAT : SHARP)[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
export const pitchClass = (midi: number, flats = false) => (flats ? FLAT : SHARP)[((Math.round(midi) % 12) + 12) % 12];

/** Median of the last few readings: steadies the needle without making it slow. */
export function median(values: number[]) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
