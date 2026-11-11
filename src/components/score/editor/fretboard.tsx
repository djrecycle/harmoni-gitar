"use client";

import { TUNING } from "@/lib/score/musicxml";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const OPEN = ["e", "B", "G", "D", "A", "E"];
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

/** Sounding pitch name of string s (1–6) at fret f, e.g. open string 1 = "E4". */
export function pitchName(s: number, f: number, flats: boolean) {
  const midi = TUNING[s - 1] + f;
  return `${(flats ? FLAT : SHARP)[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/**
 * Tap a string and fret to enter a note (like MuseScore's tab input). The current string (for the keyboard's
 * number keys) is highlighted; the notes of the selected chord are filled in.
 */
export function Fretboard({
  frets,
  string,
  active,
  flats,
  onPick,
  onString,
}: {
  frets: number;
  string: number;
  /** Notes of the selected chord: string -> fret. */
  active: Map<number, number>;
  flats: boolean;
  onPick: (string: number, fret: number) => void;
  onString: (string: number) => void;
}) {
  const t = useT();
  return (
    <div className="overflow-x-auto overscroll-x-contain" role="group" aria-label={t("Fretboard")}>
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card" />
            {Array.from({ length: frets + 1 }, (_, f) => (
              <th key={f} className={cn("h-4 font-semibold text-muted-foreground", [3, 5, 7, 9, 12].includes(f) && "text-foreground")}>
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OPEN.map((name, i) => {
            const s = i + 1;
            return (
              <tr key={s}>
                <th className="sticky left-0 z-10 bg-card pr-0.5">
                  <button
                    type="button"
                    onClick={() => onString(s)}
                    aria-pressed={string === s}
                    title={t("String {0}", s)}
                    className={cn("h-8 w-10 rounded-md text-left text-[0.7rem] font-bold", string === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    <span className="pl-1">{CIRCLED[i]}</span> {name}
                  </button>
                </th>
                {Array.from({ length: frets + 1 }, (_, f) => {
                  const on = active.get(s) === f;
                  return (
                    <td key={f} className="p-0">
                      <button
                        type="button"
                        onClick={() => onPick(s, f)}
                        aria-pressed={on}
                        aria-label={`${t("String {0}", s)}, ${t("fret {0}", f)} (${pitchName(s, f, flats)})`}
                        className={cn(
                          "flex h-8 w-10 flex-col items-center justify-center rounded-md border leading-none transition-colors",
                          on ? "border-sky-600 bg-sky-600 text-white" : string === s ? "border-primary/40 bg-primary-soft/60 hover:bg-primary-soft" : "bg-card hover:bg-muted",
                          f === 0 && !on && "border-dashed",
                        )}
                      >
                        <span className="font-bold">{f}</span>
                        <span className={cn("text-[0.6rem]", on ? "text-white/85" : "text-muted-foreground")}>{pitchName(s, f, flats)}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
