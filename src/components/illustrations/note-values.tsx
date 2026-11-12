"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Explain, IllustrationFrame, pluck } from "./common";
import { audioTime, startMetronome, unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Row = { id: "whole" | "half" | "quarter" | "eighth"; name: string; beats: number; count: number; beatsLabel: string };
const ROWS: Row[] = [
  { id: "whole", name: "Whole note", beats: 4, count: 1, beatsLabel: "4 beats" },
  { id: "half", name: "Half note", beats: 2, count: 2, beatsLabel: "2 beats" },
  { id: "quarter", name: "Quarter note", beats: 1, count: 4, beatsLabel: "1 beat" },
  { id: "eighth", name: "Eighth note", beats: 0.5, count: 8, beatsLabel: "½ beat" },
];
const X0 = 112;
const BEAT = 69;
const rowY = (i: number) => 58 + i * 50;
const BPM = 60;

function NoteGlyph({ id, x, y, lit }: { id: Row["id"]; x: number; y: number; lit: boolean }) {
  const c = lit ? "var(--primary)" : "var(--foreground)";
  const hollow = id === "whole" || id === "half";
  return (
    <g>
      <ellipse cx={x} cy={y} rx={7.5} ry={5.2} transform={`rotate(-20 ${x} ${y})`} fill={hollow ? "none" : c} stroke={c} strokeWidth={hollow ? 2.4 : 1} />
      {id !== "whole" && <line x1={x + 6.6} x2={x + 6.6} y1={y - 1} y2={y - 28} stroke={c} strokeWidth={1.6} />}
    </g>
  );
}

export function NoteValues({ caption }: { caption?: string }) {
  const t = useT();
  const [row, setRow] = useState<Row["id"]>("quarter");
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState<number | null>(null); // beat position 0..4 while playing
  const rowRef = useRef(row);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = audioTime() + 0.08; // the metronome's first click
    const stopClick = startMetronome(() => BPM, 4);
    let last = -1;
    const tick = () => {
      const beats = (audioTime() - t0) * (BPM / 60);
      if (beats >= 0) {
        const p = beats % 4;
        setPos(p);
        // Pluck each note of the chosen row as the cursor reaches it.
        const r = ROWS.find((x) => x.id === rowRef.current)!;
        const idx = Math.floor(beats / r.beats);
        if (idx !== last) {
          last = idx;
          void pluck(55, Math.min(2.5, r.beats * 1.1));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stopClick();
      setPos(null);
    };
  }, [playing]);

  const toggle = async () => {
    await unlockAudio();
    setPlaying((p) => !p);
  };
  const r = ROWS.find((x) => x.id === row)!;

  return (
    <IllustrationFrame title="Note values" hint="Choose a row, then press Play" caption={caption}>
      <div className="overflow-x-auto [contain:inline-size]">
        <svg viewBox="0 0 400 252" className="w-full min-w-[340px] select-none" role="img" aria-label={t("Note values")}>
          {[0, 1, 2, 3].map((b) => (
            <g key={b}>
              <text x={X0 + b * BEAT + BEAT / 2} y={20} textAnchor="middle" fontSize={15} fontWeight={800} fill={pos !== null && Math.floor(pos) === b ? "var(--primary)" : "var(--muted-foreground)"}>
                {b + 1}
              </text>
              <line x1={X0 + b * BEAT} x2={X0 + b * BEAT} y1={28} y2={238} className="stroke-border" strokeWidth={1} strokeDasharray={b ? "3 3" : undefined} />
            </g>
          ))}
          <line x1={X0 + 4 * BEAT} x2={X0 + 4 * BEAT} y1={28} y2={238} className="stroke-border" />
          {ROWS.map((rw, i) => {
            const y = rowY(i);
            const chosen = rw.id === row;
            return (
              <g key={rw.id} onClick={() => setRow(rw.id)} className="cursor-pointer" role="button" aria-pressed={chosen} aria-label={t(rw.name)}>
                <rect x={0} y={y - 24} width={400} height={46} rx={10} fill={chosen ? "var(--primary-soft)" : "transparent"} />
                <text x={8} y={y - 2} fontSize={12} fontWeight={700} className="fill-foreground">
                  {t(rw.name)}
                </text>
                <text x={8} y={y + 14} fontSize={11} className="fill-muted-foreground">
                  {t(rw.beatsLabel)}
                </text>
                {Array.from({ length: rw.count }, (_, k) => {
                  const x = X0 + k * rw.beats * BEAT;
                  const lit = pos !== null && pos >= k * rw.beats && pos < (k + 1) * rw.beats;
                  return (
                    <g key={k}>
                      <rect x={x + 3} y={y + 9} width={rw.beats * BEAT - 6} height={7} rx={3.5} fill={lit ? "var(--primary)" : "var(--muted-foreground)"} opacity={lit ? 0.9 : 0.18} />
                      <NoteGlyph id={rw.id} x={x + 14} y={y} lit={lit} />
                    </g>
                  );
                })}
                {rw.id === "eighth" &&
                  [0, 1, 2, 3].map((k) => (
                    <rect key={k} x={X0 + k * BEAT + 14 + 6} y={y - 29} width={BEAT / 2 + 1.6} height={4.5} className="fill-foreground" />
                  ))}
              </g>
            );
          })}
          {pos !== null && <line x1={X0 + pos * BEAT} x2={X0 + pos * BEAT} y1={28} y2={238} stroke="var(--accent)" strokeWidth={3} />}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={toggle}>
          {playing ? <Square /> : <Play />} {playing ? t("Stop") : t("Play")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("{0} bpm · count along out loud", BPM)}</span>
      </div>
      <Explain>
        <p>
          <span className={cn("font-bold")}>{t(r.name)}</span> = {t(r.beatsLabel)}.{" "}
          {r.id === "eighth" ? t("Two eighth notes fit in one beat: count “1-and, 2-and…”.") : t("{0} of them fill one bar of 4/4.", r.count)}
        </p>
      </Explain>
    </IllustrationFrame>
  );
}
