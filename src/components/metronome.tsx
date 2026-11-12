"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Play, Plus, Square } from "lucide-react";
import { TempoLadder } from "@/components/tempo-ladder";
import { Button } from "@/components/ui/button";
import { startMetronome, unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const MIN = 30;
const MAX = 220;

function tempoName(bpm: number) {
  return bpm < 60 ? "Largo" : bpm < 76 ? "Adagio" : bpm < 108 ? "Andante" : bpm < 120 ? "Moderato" : bpm < 168 ? "Allegro" : "Presto";
}

/**
 * Metronome with a tempo ladder. `onMaxBpm` gets the highest tempo that was actually played (running for at
 * least 10 seconds), so a practice session can save it.
 */
export function Metronome({ initialBpm = 60, onMaxBpm, compact }: { initialBpm?: number; onMaxBpm?: (bpm: number) => void; compact?: boolean }) {
  const t = useT();
  const [bpm, setBpm] = useState(initialBpm);
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(-1);
  const [best, setBest] = useState(0);
  const bpmRef = useRef(bpm);
  const bestRef = useRef(0);
  const stop = useRef<(() => void) | null>(null);
  const onMaxRef = useRef(onMaxBpm);

  useEffect(() => {
    bpmRef.current = bpm;
    onMaxRef.current = onMaxBpm;
  });

  useEffect(() => () => stop.current?.(), []);

  // (Re)start the scheduler when it is switched on or the time signature changes.
  useEffect(() => {
    if (!running) return;
    stop.current = startMetronome(() => bpmRef.current, beats, setActive);
    return () => {
      stop.current?.();
      stop.current = null;
    };
  }, [beats, running]);

  // A tempo counts as "played" after 10 seconds of running at it.
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      if (bpm <= bestRef.current) return;
      bestRef.current = bpm;
      setBest(bpm);
      onMaxRef.current?.(bpm);
    }, 10_000);
    return () => clearTimeout(id);
  }, [bpm, running]);

  const set = (n: number) => setBpm(Math.max(MIN, Math.min(MAX, Math.round(n))));

  async function toggle() {
    if (running) {
      setRunning(false);
      setActive(-1);
    } else {
      await unlockAudio();
      setRunning(true);
    }
  }

  return (
    <div className={cn("grid gap-4 rounded-xl border bg-card p-4 shadow-xs", !compact && "sm:p-5")}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t("Metronome")}</h3>
        <span className="text-xs font-semibold text-muted-foreground">{tempoName(bpm)}</span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" aria-label={t("Slower")} onClick={() => set(bpm - 1)}>
          <Minus />
        </Button>
        <div className="min-w-24 text-center">
          <p className="text-5xl leading-none font-extrabold tabular-nums">{bpm}</p>
          <p className="mt-1 text-xs text-muted-foreground">bpm</p>
        </div>
        <Button variant="outline" size="icon" aria-label={t("Faster")} onClick={() => set(bpm + 1)}>
          <Plus />
        </Button>
      </div>
      <input type="range" min={MIN} max={MAX} value={bpm} onChange={(e) => set(Number(e.target.value))} aria-label={t("Tempo")} className="w-full accent-[var(--primary)]" />

      <div className="flex items-center justify-center gap-2" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-5 rounded-full border-2 transition-transform",
              active === i ? (i === 0 ? "scale-125 border-accent bg-accent" : "scale-125 border-primary bg-primary") : "border-input",
            )}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          {t("Time signature")}
          <select value={beats} onChange={(e) => setBeats(Number(e.target.value))} className="h-9 rounded-lg border border-input bg-card px-2 text-sm">
            {[2, 3, 4, 6].map((n) => (
              <option key={n} value={n}>
                {n}/4
              </option>
            ))}
          </select>
        </label>
        <Button onClick={toggle} variant={running ? "danger" : "default"} size="lg">
          {running ? <Square /> : <Play />} {running ? t("Stop") : t("Start")}
        </Button>
      </div>

      <TempoLadder bpm={bpm} onBpm={set} max={MAX} best={best} />
    </div>
  );
}
