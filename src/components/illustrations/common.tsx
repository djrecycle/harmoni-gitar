"use client";

import { Sparkles } from "lucide-react";
import { playPluck, unlockAudio } from "@/lib/audio";
import { midiToFreq } from "@/lib/pitch";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** Sounding MIDI note of each open string, index 1..6 (① = E4 … ⑥ = E2). */
export const OPEN_MIDI = [0, 64, 59, 55, 50, 45, 40] as const;
export const CIRCLED = ["", "①", "②", "③", "④", "⑤", "⑥"] as const;
export const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"] as const;

/** Guitar colours: the instrument looks the same in light and dark mode. */
export const WOOD = { top: "#e9bd82", side: "#c88a4a", edge: "#8a5a2b", board: "#3b2a1e", bone: "#f3ead7", hole: "#2a1c12", string: "#e7e5e4", bass: "#b9b3a8", skin: "#f2c39b", skinEdge: "#c98f68" };

/** Round to 1/100: server and browser may differ in the last digit of Math.pow & co (hydration mismatch). */
export const r2 = (v: number) => Math.round(v * 100) / 100;

/** Play a plucked note (sounding MIDI number). Must be called from a tap. */
export async function pluck(midi: number, seconds = 1.8) {
  await unlockAudio();
  playPluck(midiToFreq(midi), seconds);
}

/** Card around an illustration: a small header, the drawing, then the caption. */
export function IllustrationFrame({ title, hint, caption, children }: { title: string; hint?: string; caption?: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <figure className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-primary-soft/60 px-3 py-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm font-bold">{t(title)}</p>
        {hint && <p className="hidden text-xs text-muted-foreground sm:block">{t(hint)}</p>}
      </div>
      <div className="grid gap-3 p-3 sm:p-4">{children}</div>
      {caption && <figcaption className="border-t px-3 py-2 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/** A row of toggle chips (one active). */
export function Chips<T extends string | number>({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: T; label: React.ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((it) => (
        <button
          key={String(it.value)}
          type="button"
          onClick={() => onChange(it.value)}
          aria-pressed={value === it.value}
          className={cn(
            "min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors",
            value === it.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** A short line of explanation under a drawing, highlighted. */
export function Explain({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-12 rounded-lg bg-muted px-3 py-2 text-sm", className)} aria-live="polite">{children}</div>;
}

/* ---------- Staff (G clef) helpers ---------- */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

/** Letter of a natural note (C D E … B) from its MIDI number. */
export const letterOf = (midi: number) => LETTERS[NATURAL_PC.indexOf(((midi % 12) + 12) % 12)] ?? "?";

/** Staff step of a natural written note, counted from the bottom line (E4 = 0, F4 = 1, G4 = 2 …). */
export function staffStep(writtenMidi: number) {
  const octave = Math.floor(writtenMidi / 12) - 1;
  const idx = NATURAL_PC.indexOf(((writtenMidi % 12) + 12) % 12);
  return (octave - 4) * 7 + idx - 2;
}

/** The five staff lines, the G clef (Bravura font) and the line numbers 1–5 counted from the bottom. */
export function Staff({ x, width, bottom, gap, numbers }: { x: number; width: number; bottom: number; gap: number; numbers?: boolean }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={x} x2={x + width} y1={bottom - i * gap} y2={bottom - i * gap} className="stroke-foreground" strokeWidth={1.3} />
      ))}
      <text x={x + 4} y={bottom - gap} fontSize={gap * 4} className="font-music fill-foreground">
        {""}
      </text>
      {numbers &&
        [0, 1, 2, 3, 4].map((i) => (
          <text key={i} x={x + width + 6} y={bottom - i * gap + 4} fontSize={11} className="fill-muted-foreground font-semibold">
            {i + 1}
          </text>
        ))}
    </g>
  );
}

/** A quarter note on the staff at `step` (see staffStep), with ledger lines when needed. */
export function StaffNote({
  cx,
  step,
  bottom,
  gap,
  active,
  onClick,
  label,
}: {
  cx: number;
  step: number;
  bottom: number;
  gap: number;
  active?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const y = bottom - (step * gap) / 2;
  const ledgers: number[] = [];
  for (let s = -2; s >= step; s -= 2) ledgers.push(s);
  for (let s = 10; s <= step; s += 2) ledgers.push(s);
  const up = step < 4; // below the middle line: stem up on the right
  const color = active ? "var(--primary)" : "var(--foreground)";
  return (
    <g onClick={onClick} className={cn(onClick && "cursor-pointer")} role={onClick ? "button" : undefined} aria-label={label}>
      {/* A larger invisible target, easier to tap on a phone. */}
      {onClick && <rect x={cx - 14} y={y - 26} width={28} height={52} fill="transparent" />}
      {ledgers.map((s) => (
        <line key={s} x1={cx - gap} x2={cx + gap} y1={bottom - (s * gap) / 2} y2={bottom - (s * gap) / 2} className="stroke-foreground" strokeWidth={1.3} />
      ))}
      <g className={cn(active && "ill-pop")}>
        <ellipse cx={cx} cy={y} rx={gap * 0.62} ry={gap * 0.44} transform={`rotate(-20 ${cx} ${y})`} fill={color} className="transition-colors" />
      </g>
      <line x1={up ? cx + gap * 0.56 : cx - gap * 0.56} x2={up ? cx + gap * 0.56 : cx - gap * 0.56} y1={y} y2={up ? y - gap * 3 : y + gap * 3} stroke={color} strokeWidth={1.5} />
    </g>
  );
}
