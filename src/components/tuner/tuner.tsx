"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, MicOff, Volume2 } from "lucide-react";
import { micErrorMessage, useMicPitch, type MicReading } from "@/components/audio/use-mic-pitch";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { playPluck, unlockAudio } from "@/lib/audio";
import { freqToMidi, median, midiToFreq, noteName } from "@/lib/pitch";
import { CHROMATIC, TUNINGS } from "@/lib/tunings";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const STORE = "hg-tuner";
const CIRCLED = ["⑥", "⑤", "④", "③", "②", "①"];
/** Within this many cents a string counts as in tune. */
const IN_TUNE = 4;

type Saved = { tuning: string; a4: number };

function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Partial<Saved>;
    return { tuning: typeof v.tuning === "string" ? v.tuning : "standard", a4: typeof v.a4 === "number" && v.a4 >= 415 && v.a4 <= 466 ? v.a4 : 440 };
  } catch {
    return { tuning: "standard", a4: 440 };
  }
}

/**
 * Guitar tuner: the microphone hears a string, the needle shows how many cents it is off. Pick a tuning (or
 * chromatic); the string is found automatically, or tap one to tune just that string. Each string can play a
 * reference tone.
 */
export function Tuner() {
  const t = useT();
  const [saved, setSaved] = useState<Saved>({ tuning: "standard", a4: 440 });
  const [manual, setManual] = useState<number | null>(null);
  const [shown, setShown] = useState<{ midi: number; target: number; string: number | null; freq: number; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const [tuned, setTuned] = useState<Set<number>>(new Set());
  const history = useRef<number[]>([]);
  const inTuneSince = useRef<{ string: number; at: number } | null>(null);

  useEffect(() => setSaved(load()), []);
  const save = (s: Saved) => {
    setSaved(s);
    setTuned(new Set());
    try {
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch {
      /* private mode: settings are just not remembered */
    }
  };

  const tuning = TUNINGS.find((x) => x.id === saved.tuning) ?? null;
  const chromatic = saved.tuning === CHROMATIC;
  const flats = Boolean(tuning?.name.includes("♭"));

  const onReading = (r: MicReading) => {
    if (r.freq === null) return;
    const m = freqToMidi(r.freq, saved.a4);
    // A new note (jump of more than ~70 cents) starts the smoothing over.
    if (history.current.length && Math.abs(m - history.current[history.current.length - 1]) > 0.7) history.current = [];
    history.current = [...history.current.slice(-4), m];
    const midi = median(history.current);
    let string: number | null = null;
    let target = Math.round(midi);
    if (tuning && !chromatic) {
      string = manual ?? tuning.notes.reduce((best, n, i) => (Math.abs(midi - n) < Math.abs(midi - tuning.notes[best]) ? i : best), 0);
      target = tuning.notes[string];
    }
    const cents = (midi - target) * 100;
    if (string !== null && Math.abs(cents) <= IN_TUNE) {
      if (inTuneSince.current?.string !== string) inTuneSince.current = { string, at: r.at };
      else if (r.at - inTuneSince.current.at > 600) setTuned((s) => (s.has(string!) ? s : new Set(s).add(string!)));
    } else inTuneSince.current = null;
    setShown({ midi, target, string, freq: midiToFreq(midi, saved.a4), at: r.at });
  };

  const mic = useMicPitch({ onReading });

  // Fade the reading out a moment after the sound stops.
  useEffect(() => {
    if (mic.status !== "on") return;
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, [mic.status]);
  const fresh = shown && now - shown.at < 1500;
  const cents = shown ? (shown.midi - shown.target) * 100 : 0;
  const ok = fresh && Math.abs(cents) <= IN_TUNE;
  const close = fresh && Math.abs(cents) <= 15;
  const angle = Math.max(-50, Math.min(50, cents)) * 0.9;

  const ticks = useMemo(() => Array.from({ length: 21 }, (_, i) => (i - 10) * 5), []);

  const reference = async (midi: number) => {
    await unlockAudio();
    playPluck(midiToFreq(midi, saved.a4));
  };

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1.5 text-sm font-semibold">
          {t("Tuning")}
          <select value={saved.tuning} onChange={(e) => save({ ...saved, tuning: e.target.value })} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
            {TUNINGS.map((x) => (
              <option key={x.id} value={x.id}>
                {t(x.name)}
              </option>
            ))}
            <option value={CHROMATIC}>{t("Chromatic (any note)")}</option>
          </select>
          {tuning?.hint && <span className="text-xs font-normal text-muted-foreground">{t(tuning.hint)}</span>}
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          {t("A4 reference")}
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={415}
              max={466}
              value={saved.a4}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 415 && v <= 466) save({ ...saved, a4: v });
              }}
              className="h-11 w-20 rounded-lg border border-input bg-card px-2 text-center text-sm font-normal"
            />
            <span className="text-xs font-normal text-muted-foreground">Hz</span>
          </span>
        </label>
      </div>

      <section className={cn("grid justify-items-center gap-2 rounded-2xl border bg-card p-5 text-center shadow-sm transition-colors", ok && "border-success bg-success-soft/40")}>
        {/* Gauge: -50 … +50 cents */}
        <svg viewBox="-110 -105 220 120" className="w-full max-w-sm" role="img" aria-label={fresh ? t("{0} cents", Math.round(cents)) : t("Waiting for a note")}>
          <path d="M -95 0 A 95 95 0 0 1 95 0" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="14" strokeLinecap="round" />
          <path d="M -14.8 -93.8 A 95 95 0 0 1 14.8 -93.8" fill="none" className="stroke-success" strokeWidth="14" />
          {ticks.map((c) => {
            const a = ((c * 0.9 - 90) * Math.PI) / 180;
            const r1 = c % 25 === 0 ? 74 : 80;
            // Rounded: the server and the browser compute the last decimals of cos/sin differently (hydration).
            const r = (v: number) => Math.round(v * 100) / 100;
            return <line key={c} x1={r(Math.cos(a) * r1)} y1={r(Math.sin(a) * r1)} x2={r(Math.cos(a) * 86)} y2={r(Math.sin(a) * 86)} stroke="currentColor" strokeOpacity={c === 0 ? 0.8 : 0.35} strokeWidth={c % 25 === 0 ? 2 : 1} />;
          })}
          <text x="-92" y="14" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.6">
            −50
          </text>
          <text x="92" y="14" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.6">
            +50
          </text>
          <g style={{ transform: `rotate(${fresh ? angle : 0}deg)`, transition: "transform 90ms linear" }}>
            <line x1="0" y1="0" x2="0" y2="-88" strokeWidth="3.5" strokeLinecap="round" className={ok ? "stroke-success" : close ? "stroke-accent" : fresh ? "stroke-danger" : "stroke-muted-foreground"} />
          </g>
          <circle r="6" className="fill-foreground" />
        </svg>
        <p className={cn("text-6xl font-extrabold tabular-nums transition-opacity", !fresh && "opacity-30")}>{shown ? noteName(shown.target, flats).replace(/\d+$/, "") : "–"}</p>
        <p className="h-5 text-sm text-muted-foreground tabular-nums">
          {fresh && shown ? `${noteName(shown.target, flats)} · ${shown.freq.toFixed(1)} Hz · ${cents > 0 ? "+" : ""}${Math.round(cents)} ${t("cents")}` : mic.status === "on" ? t("Pluck one string…") : ""}
        </p>
        <p className={cn("h-6 font-bold", ok ? "text-success" : "text-muted-foreground")}>
          {!fresh ? "" : ok ? t("In tune!") : cents < 0 ? t("Too low: tighten the string") : t("Too high: loosen the string")}
        </p>
        {mic.status === "on" ? (
          <Button variant="outline" onClick={mic.stop}>
            <MicOff /> {t("Stop listening")}
          </Button>
        ) : (
          <Button size="lg" onClick={mic.start} disabled={mic.status === "starting"}>
            <Mic /> {t("Start tuner")}
          </Button>
        )}
      </section>

      {mic.status === "error" && (
        <Alert kind="error" title={t("The microphone could not start")}>
          {micErrorMessage(mic.error, t)}
        </Alert>
      )}

      {tuning && !chromatic && (
        <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t("Strings")}</h2>
            <button type="button" onClick={() => setManual(null)} aria-pressed={manual === null} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", manual === null ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground")}>
              {t("Automatic")}
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {tuning.notes.map((n, i) => {
              const active = fresh && shown?.string === i;
              return (
                <div key={i} className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => setManual(manual === i ? null : i)}
                    aria-pressed={manual === i}
                    title={t("Tune only this string")}
                    className={cn(
                      "relative grid h-16 place-items-center rounded-xl border text-center transition-colors",
                      manual === i ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-primary-soft" : "hover:bg-muted",
                    )}
                  >
                    {tuned.has(i) && <Check className="absolute top-1 right-1 size-3.5 text-success" aria-label={t("In tune")} />}
                    <span className="text-xs opacity-70">{CIRCLED[i]}</span>
                    <span className="text-lg leading-none font-extrabold">{noteName(n, flats).replace(/\d+$/, "")}</span>
                    <span className="text-[0.6rem] opacity-60">{noteName(n, flats)}</span>
                  </button>
                  <button type="button" onClick={() => reference(n)} className="grid h-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Play {0}", noteName(n, flats))} title={t("Play the note")}>
                    <Volume2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Automatic finds the string you play. Tap a string to tune only that one. The speaker button plays how the string should sound.")}
          </p>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">{t("Tip: tune in a quiet room, pluck one string at a time and let it ring. Tune up to the note (from below) so the string stays in tune.")}</p>
    </div>
  );
}
