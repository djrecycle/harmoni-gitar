"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch, rms } from "@/lib/pitch";
import type { Translate } from "@/i18n";

/** One reading from the microphone: the pitch (null = silence / unclear) and how loud it was. */
export type MicReading = { freq: number | null; clarity: number; level: number; at: number };

export function micErrorMessage(e: unknown, t: Translate): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return t("Microphone permission was denied. Open the site settings in your browser (the padlock icon next to the address), allow the microphone, then reload the page.");
  if (name === "NotFoundError" || name === "OverconstrainedError") return t("No microphone found. Make sure your device has an active microphone.");
  if (name === "NotReadableError") return t("The microphone is being used by another app. Close that app, then try again.");
  if (name === "NotSupported") return window.isSecureContext ? t("This browser cannot use the microphone.") : t("The microphone needs a secure connection (HTTPS). Open the app through an https:// address.");
  return t("Could not access the microphone. Try reloading the page.");
}

/**
 * Listen to the microphone and detect the pitch about 20 times a second. Echo cancellation, noise suppression and
 * auto gain are off: they distort a guitar's tone. `onReading` is called for every reading (also silence).
 */
export function useMicPitch({ onReading, intervalMs = 50, minRms = 0.008 }: { onReading?: (r: MicReading) => void; intervalMs?: number; minRms?: number } = {}) {
  const [status, setStatus] = useState<"off" | "starting" | "on" | "error">("off");
  const [error, setError] = useState<unknown>(null);
  const [reading, setReading] = useState<MicReading | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef(onReading);
  cb.current = onReading;
  const gate = useRef(minRms);
  gate.current = minRms;

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    setStatus("off");
    setReading(null);
  }, []);

  const start = useCallback(async () => {
    if (ctx.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(new DOMException("", "NotSupported"));
      setStatus("error");
      return;
    }
    setStatus("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ac = new AudioContext();
      await ac.resume();
      const src = ac.createMediaStreamSource(s);
      const analyser = ac.createAnalyser();
      // ~43 ms at 48 kHz: long enough for two periods of the low E string (82 Hz).
      analyser.fftSize = 4096;
      src.connect(analyser);
      stream.current = s;
      ctx.current = ac;
      const buf = new Float32Array(analyser.fftSize);
      timer.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const level = rms(buf);
        const p = detectPitch(buf.subarray(buf.length - 2048), ac.sampleRate, gate.current);
        const r: MicReading = { freq: p?.freq ?? null, clarity: p?.clarity ?? 0, level, at: performance.now() };
        setReading(r);
        cb.current?.(r);
      }, intervalMs);
      setStatus("on");
    } catch (e) {
      stream.current?.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
      setError(e);
      setStatus("error");
    }
  }, [intervalMs]);

  useEffect(() => stop, [stop]);

  return { status, error, reading, start, stop };
}
