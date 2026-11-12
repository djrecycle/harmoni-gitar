"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, RotateCcw, Square } from "lucide-react";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn, formatSeconds } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { micErrorMessage } from "@/components/audio/use-mic-pitch";

/*
 * Record audio in the browser (MediaRecorder, pattern from LMS Harmoni's recorder.tsx): press the microphone,
 * press the square to stop (or it stops at the limit), listen back, record again. The parent gets the result
 * through onChange and uploads it (uploadRecording below).
 */

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type Recorded = { blob: Blob; seconds: number };

export function AudioRecorder({ maxSeconds, onChange, disabled, compact }: { maxSeconds: number; onChange: (r: Recorded | null) => void; disabled?: boolean; compact?: boolean }) {
  const t = useT();
  const [status, setStatus] = useState<"idle" | "asking" | "recording" | "done">("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stopMic = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
  }, []);

  useEffect(
    () => () => {
      stopMic();
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    },
    [stopMic],
  );
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  async function start() {
    setError("");
    const supported = Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
    if (!supported) {
      setError(window.isSecureContext ? t("This browser does not support audio recording.") : t("Recording needs a secure connection (HTTPS). Open the app through an https:// address."));
      return;
    }
    setStatus("asking");
    try {
      // No noise suppression or auto gain: they make a guitar sound thin and pumping.
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      stream.current = s;
      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        stopMic();
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        setSeconds(secs);
        setUrl(URL.createObjectURL(blob));
        setStatus("done");
        onChangeRef.current({ blob, seconds: Math.min(secs, maxSeconds) });
      };
      rec.onerror = () => {
        stopMic();
        setError(t("Recording stopped because of an error. Try again."));
        setStatus("idle");
      };
      recorder.current = rec;
      rec.start(1000);
      started.current = Date.now();
      setSeconds(0);
      setStatus("recording");
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch (e) {
      stopMic();
      setError(micErrorMessage(e, t));
      setStatus("idle");
    }
  }

  function again() {
    setUrl(null);
    setSeconds(0);
    setStatus("idle");
    onChangeRef.current(null);
  }

  const size = compact ? "size-16" : "size-24";
  return (
    <div className="grid gap-3">
      {error && (
        <Alert kind="error" title={t("Recording could not start")}>
          {error}
        </Alert>
      )}
      {status !== "done" ? (
        <div className={cn("grid justify-items-center gap-2 text-center", compact && "grid-cols-[auto_1fr] items-center justify-items-start text-left")}>
          <button
            type="button"
            onClick={status === "recording" ? stop : start}
            disabled={disabled || status === "asking"}
            aria-label={status === "recording" ? t("Stop recording") : t("Start recording")}
            className={cn(
              "relative grid place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50",
              size,
              status === "recording" ? "bg-danger" : "bg-gradient-to-br from-rose-500 to-pink-600",
            )}
          >
            {status === "recording" && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
            {status === "asking" ? <LoaderCircle className="size-8 animate-spin" /> : status === "recording" ? <Square className="relative size-8" /> : <Mic className="size-10" />}
          </button>
          <div className={cn("grid gap-0.5", !compact && "justify-items-center")}>
            <p className="text-2xl font-extrabold tabular-nums" role="timer">
              {formatSeconds(seconds)} <span className="text-sm font-semibold text-muted-foreground">/ {formatSeconds(maxSeconds)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {status === "recording" ? t("Recording… press the square to stop.") : status === "asking" ? t("Allow microphone access in your browser…") : t("Press the microphone to start.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("Listen back")} ({formatSeconds(seconds)})
          </p>
          {url && <audio controls src={url} className="w-full" />}
          <div>
            <Button type="button" size="sm" variant="outline" onClick={again} disabled={disabled}>
              <RotateCcw /> {t("Record again")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Upload a recording to /api/upload/recording. A teacher passes the student whose folder it goes into. */
export async function uploadRecording(blob: Blob, studentId?: string): Promise<{ key: string; mime: string }> {
  const fd = new FormData();
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  fd.append("file", new File([blob], `recording.${ext}`, { type: blob.type }));
  if (studentId) fd.append("studentId", studentId);
  const res = await fetch("/api/upload/recording", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { key?: string; mime?: string; error?: string };
  if (!res.ok || !data.key || !data.mime) throw new Error(data.error ?? `HTTP ${res.status}`);
  return { key: data.key, mime: data.mime };
}
