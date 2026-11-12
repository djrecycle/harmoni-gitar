"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CIRCLED, Explain, IllustrationFrame, OPEN_MIDI, Staff, StaffNote, WOOD, letterOf, pluck, staffStep } from "./common";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

export type FretboardSet = "1-2" | "3-4" | "5-6";
type Spot = { s: number; f: number };

const SETS: Record<FretboardSet, { strings: [number, number]; notes: Spot[] }> = {
  "1-2": { strings: [1, 2], notes: [ { s: 2, f: 0 }, { s: 2, f: 1 }, { s: 2, f: 3 }, { s: 1, f: 0 }, { s: 1, f: 1 }, { s: 1, f: 3 } ] },
  "3-4": { strings: [3, 4], notes: [ { s: 4, f: 0 }, { s: 4, f: 2 }, { s: 4, f: 3 }, { s: 3, f: 0 }, { s: 3, f: 2 } ] },
  "5-6": { strings: [5, 6], notes: [ { s: 6, f: 0 }, { s: 6, f: 1 }, { s: 6, f: 3 }, { s: 5, f: 0 }, { s: 5, f: 2 }, { s: 5, f: 3 } ] },
};

const NUT_X = 62;
const FRET_W = 70;
const fretMid = (f: number) => (f === 0 ? 34 : NUT_X + (f - 0.5) * FRET_W);
const sy = (s: number) => 22 + (6 - s) * 24;
const sounding = (n: Spot) => OPEN_MIDI[n.s] + n.f;

export function FretboardNotes({ set, caption }: { set: FretboardSet; caption?: string }) {
  const t = useT();
  const { strings, notes } = SETS[set];
  const [cur, setCur] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const hit = (i: number) => {
    setCur(i);
    void pluck(sounding(notes[i]), 1.6);
  };
  const playAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = notes.map((_, i) => setTimeout(() => hit(i), i * 650));
  };
  const n = cur === null ? null : notes[cur];
  const title = set === "1-2" ? "Notes on strings ① and ②" : set === "3-4" ? "Notes on strings ③ and ④" : "Notes on strings ⑤ and ⑥";

  return (
    <IllustrationFrame title={title} hint="Tap a note to hear it" caption={caption}>
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <svg viewBox="0 0 360 178" className="w-full select-none" role="img" aria-label={t(title)}>
          <rect x={NUT_X} y={10} width={4 * FRET_W + 14} height={144} fill={WOOD.board} rx={3} />
          <rect x={NUT_X - 5} y={8} width={7} height={148} fill={WOOD.bone} rx={2} />
          {[1, 2, 3, 4].map((f) => (
            <line key={f} x1={NUT_X + f * FRET_W} x2={NUT_X + f * FRET_W} y1={10} y2={154} stroke="#c9ccd1" strokeWidth={2.5} />
          ))}
          {[0, 1, 2, 3, 4].map((f) => (
            <text key={f} x={fretMid(f)} y={172} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-muted-foreground">
              {f === 0 ? t("open") : `${t("fret")} ${f}`}
            </text>
          ))}
          {[1, 2, 3, 4, 5, 6].map((s) => {
            const mine = strings.includes(s);
            return (
              <g key={s} opacity={mine ? 1 : 0.35}>
                <line x1={NUT_X - 5} x2={NUT_X + 4 * FRET_W + 14} y1={sy(s)} y2={sy(s)} stroke={s >= 4 ? WOOD.bass : WOOD.string} strokeWidth={0.9 + s * 0.45} />
                <text x={10} y={sy(s) + 4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill={mine ? "var(--primary)" : "var(--muted-foreground)"}>
                  {CIRCLED[s]}
                </text>
              </g>
            );
          })}
          {notes.map((spot, i) => {
            const on = cur === i;
            const x = fretMid(spot.f);
            const y = sy(spot.s);
            return (
              <g key={i} onClick={() => hit(i)} className="cursor-pointer" role="button" aria-label={letterOf(sounding(spot))}>
                <g className={on ? "ill-pop" : undefined} key={on ? `on${i}` : i}>
                  <circle cx={x} cy={y} r={13} fill={on ? "var(--accent)" : spot.f === 0 ? "var(--card)" : "var(--primary)"} stroke="var(--primary)" strokeWidth={2} />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={on ? "var(--accent-foreground)" : spot.f === 0 ? "var(--primary)" : "var(--primary-foreground)"}>
                    {letterOf(sounding(spot))}
                  </text>
                </g>
                {spot.f > 0 && (
                  <g pointerEvents="none">
                    <circle cx={x + 22} cy={y} r={7} fill="var(--card)" stroke="var(--foreground)" strokeWidth={1} />
                    <text x={x + 22} y={y + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={800} className="fill-foreground">
                      {spot.f}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <svg viewBox="0 0 200 170" className="mx-auto w-full max-w-60 select-none" aria-hidden>
          <Staff x={8} width={184} bottom={108} gap={12} />
          {n && <StaffNote key={cur} cx={128} step={staffStep(sounding(n) + 12)} bottom={108} gap={12} active />}
          {!n && (
            <text x={128} y={84} textAnchor="middle" fontSize={22} className="fill-muted-foreground">
              ?
            </text>
          )}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={playAll}>
          <Play /> {t("Play all, low to high")}
        </Button>
      </div>
      <Explain>
        {n ? (
          <p>
            <span className="text-lg font-extrabold text-primary">{letterOf(sounding(n))}</span> · {t("String {0}", CIRCLED[n.s])} ·{" "}
            {n.f === 0 ? t("open string (0): press nothing") : t("fret {0}, pressed with finger {1}", n.f, n.f)}
            {set === "5-6" && <span className={cn("text-muted-foreground")}> · {t("pluck with p (thumb)")}</span>}
          </p>
        ) : (
          <p>{t("Small number = left-hand finger. Tap a note: you see where it is written on the staff.")}</p>
        )}
      </Explain>
    </IllustrationFrame>
  );
}
