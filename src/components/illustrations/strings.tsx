"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CIRCLED, Explain, IllustrationFrame, OPEN_MIDI, WOOD, pluck } from "./common";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const NOTE = ["", "E", "B", "G", "D", "A", "E"];
const WORD = ["", "Engkau", "Bisa", "Gitar", "Dengan", "Asyik,", "Enak!"];
// Drawn as the child holds the guitar: ⑥ (thickest) on top, ① (thinnest) closest to the floor.
const Y = (s: number) => 34 + (6 - s) * 30;

export function Strings({ caption }: { caption?: string }) {
  const t = useT();
  const [hit, setHit] = useState<{ s: number; n: number } | null>(null);
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = (s: number) => {
    seq.current += 1;
    setHit({ s, n: seq.current });
    void pluck(OPEN_MIDI[s]);
  };
  const playAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [6, 5, 4, 3, 2, 1].map((s, i) => setTimeout(() => play(s), i * 450));
  };

  return (
    <IllustrationFrame title="The six strings" hint="Tap a string to hear it" caption={caption}>
      <svg viewBox="0 0 360 230" className="mx-auto w-full max-w-md select-none" role="img" aria-label={t("The six strings")}>
        <rect x={40} y={16} width={270} height={186} rx={6} fill={WOOD.board} />
        {[110, 190, 262].map((x) => (
          <line key={x} x1={x} x2={x} y1={16} y2={202} stroke="#9ca3af" strokeWidth={2} />
        ))}
        {[6, 5, 4, 3, 2, 1].map((s) => {
          const y = Y(s);
          const w = 0.9 + (s - 1) * 0.55;
          const on = hit?.s === s;
          return (
            <g key={s} onClick={() => play(s)} className="cursor-pointer" role="button" aria-label={t("String {0}", s)}>
              <rect x={0} y={y - 14} width={360} height={28} fill="transparent" />
              {on && <path key={hit.n} d={`M40 ${y} Q175 ${y - 9} 310 ${y} Q175 ${y + 9} 40 ${y} Z`} fill={s >= 4 ? WOOD.bass : WOOD.string} className="ill-vibrate" />}
              <line key={on ? `w${hit.n}` : "w"} x1={40} x2={310} y1={y} y2={y} stroke={s >= 4 ? WOOD.bass : WOOD.string} strokeWidth={w * 2} className={cn(on && "ill-wobble")} />
              <circle cx={20} cy={y} r={13} fill={on ? "var(--primary)" : "var(--muted)"} className="transition-colors" />
              <text x={20} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={on ? "var(--primary-foreground)" : "var(--foreground)"}>
                {s}
              </text>
              <text x={334} y={y + 6} textAnchor="middle" fontSize={18} fontWeight={800} fill={on ? "var(--primary)" : "var(--foreground)"}>
                {NOTE[s]}
              </text>
            </g>
          );
        })}
        <text x={175} y={222} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
          {t("▼ floor side (string ① is the thinnest)")}
        </text>
      </svg>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={playAll}>
          <Play /> {t("Play ⑥ to ①")}
        </Button>
      </div>
      <Explain>
        {hit ? (
          <p>
            <span className="font-bold">
              {t("String {0}", CIRCLED[hit.s])} = {NOTE[hit.s]}
            </span>
            {hit.s === 1 && ` · ${t("the thinnest")}`}
            {hit.s === 6 && ` · ${t("the thickest")}`}
          </p>
        ) : (
          <p>{t("Tap a string to hear it")}.</p>
        )}
        <p className="mt-1 flex flex-wrap gap-x-1.5 text-muted-foreground">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <span key={s} className={cn(hit?.s === s && "font-bold text-primary")}>
              <b>{WORD[s][0]}</b>
              {WORD[s].slice(1)}
            </span>
          ))}
        </p>
      </Explain>
    </IllustrationFrame>
  );
}
