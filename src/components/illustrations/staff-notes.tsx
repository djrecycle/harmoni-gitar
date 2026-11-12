"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Explain, IllustrationFrame, Staff, StaffNote, letterOf, pluck, staffStep } from "./common";
import { useT } from "@/i18n/client";

/** Written C4 … C5 (the guitar sounds one octave lower than written). */
const NOTES = [60, 62, 64, 65, 67, 69, 71, 72];
const BOTTOM = 112;
const GAP = 14;
const X0 = 92;
const DX = 36;

export function StaffNotes({ caption }: { caption?: string }) {
  const t = useT();
  const [cur, setCur] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(false);
  };
  useEffect(() => stop, []);

  const hit = (i: number) => {
    setCur(i);
    setSeen((s) => new Set(s).add(i));
    void pluck(NOTES[i] - 12, 1.4);
  };
  const playAll = () => {
    stop();
    setPlaying(true);
    setSeen(new Set());
    timers.current = [...NOTES.map((_, i) => setTimeout(() => hit(i), i * 700)), setTimeout(() => setPlaying(false), NOTES.length * 700)];
  };

  const step = cur === null ? null : staffStep(NOTES[cur]);
  const where =
    step === null
      ? null
      : step === -2
        ? t("on a small extra line below the staff (ledger line)")
        : step === -1
          ? t("just below line 1")
          : step % 2 === 0
            ? t("on line {0}", step / 2 + 1)
            : t("in the space between line {0} and line {1}", (step - 1) / 2 + 1, (step + 1) / 2 + 1);

  return (
    <IllustrationFrame title="Notes on the staff" hint="Tap a note to hear it" caption={caption}>
      <svg viewBox="0 0 400 168" className="w-full select-none" role="img" aria-label={t("Notes on the staff")}>
        <Staff x={10} width={370} bottom={BOTTOM} gap={GAP} numbers />
        {cur !== null && (
          <g key={cur} className="ill-pop">
            <path d={`M${X0 + cur * DX - 7} 8 L${X0 + cur * DX + 7} 8 L${X0 + cur * DX} 20 Z`} fill="var(--accent)" />
          </g>
        )}
        {NOTES.map((m, i) => (
          <StaffNote key={i} cx={X0 + i * DX} step={staffStep(m)} bottom={BOTTOM} gap={GAP} active={cur === i} onClick={() => hit(i)} label={letterOf(m)} />
        ))}
        {NOTES.map((m, i) => (
          <text key={i} x={X0 + i * DX} y={158} textAnchor="middle" fontSize={17} fontWeight={800} fill={cur === i ? "var(--primary)" : "var(--muted-foreground)"} opacity={seen.has(i) ? 1 : 0.25}>
            {seen.has(i) ? letterOf(m) : "?"}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={playing ? stop : playAll}>
          {playing ? <Square /> : <Play />} {playing ? t("Stop") : t("Play C D E F G A B C")}
        </Button>
      </div>
      <Explain>
        {cur === null ? (
          <p>{t("The lines are counted from the bottom (1 to 5). Tap each note and say its name out loud.")}</p>
        ) : (
          <p>
            <span className="text-lg font-extrabold text-primary">{letterOf(NOTES[cur])}</span> · {where}
          </p>
        )}
      </Explain>
    </IllustrationFrame>
  );
}
