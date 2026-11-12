"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CIRCLED, Chips, Explain, IllustrationFrame, OPEN_MIDI, ROMAN, WOOD, pluck, r2 } from "./common";
import { useT } from "@/i18n/client";

const NUT_X = 34;
const LEN = 960;
const FRETS = 15;
const fx = (n: number) => r2(NUT_X + LEN * (1 - 2 ** (-n / 12)));
/** Where a finger presses in fret n: close to the fret wire on its right. */
const pressX = (n: number) => r2(fx(n - 1) + (fx(n) - fx(n - 1)) * 0.68);
const sy = (s: number) => 40 + (6 - s) * 22; // ⑥ on top, ① at the bottom
const MARKS = [3, 5, 7, 9, 12];
const DRILLS: [number, number][] = [
  [4, 5],
  [6, 2],
  [9, 3],
  [7, 6],
  [11, 4],
  [5, 1],
];

export function BlockPosition({ caption }: { caption?: string }) {
  const t = useT();
  const [pos, setPos] = useState(5);
  const [str, setStr] = useState(1);
  const [lit, setLit] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const playBlock = () => {
    timers.current.forEach(clearTimeout);
    const order = [1, 2, 3, 4, 3, 2, 1];
    timers.current = [
      ...order.map((f, i) =>
        setTimeout(() => {
          setLit(f);
          void pluck(OPEN_MIDI[str] + pos + f - 1, 1.2);
        }, i * 520),
      ),
      setTimeout(() => setLit(null), order.length * 520),
    ];
  };

  return (
    <IllustrationFrame title="Block position" hint="Choose a position and a string" caption={caption}>
      <div className="overflow-x-auto [contain:inline-size]">
        <svg viewBox="0 0 640 200" className="w-full min-w-[520px] select-none" role="img" aria-label={t("Block position")}>
          <rect x={NUT_X} y={26} width={fx(FRETS) - NUT_X + 10} height={128} fill={WOOD.board} rx={3} />
          {MARKS.map((n) => (
            <g key={n}>
              {n === 12 ? (
                <>
                  <circle cx={(fx(11) + fx(12)) / 2} cy={62} r={4.5} fill="#d6d3d1" />
                  <circle cx={(fx(11) + fx(12)) / 2} cy={118} r={4.5} fill="#d6d3d1" />
                </>
              ) : (
                <circle cx={(fx(n - 1) + fx(n)) / 2} cy={90} r={4.5} fill="#d6d3d1" />
              )}
            </g>
          ))}
          <rect x={NUT_X - 6} y={24} width={7} height={132} fill={WOOD.bone} rx={2} />
          {Array.from({ length: FRETS }, (_, i) => i + 1).map((n) => (
            <g key={n}>
              <line x1={fx(n)} x2={fx(n)} y1={26} y2={154} stroke="#c9ccd1" strokeWidth={2.5} />
              <text x={(fx(n - 1) + fx(n)) / 2} y={176} textAnchor="middle" fontSize={11} fontWeight={n >= pos && n < pos + 4 ? 800 : 500} fill={n === pos ? "var(--primary)" : "var(--muted-foreground)"}>
                {ROMAN[n]}
              </text>
            </g>
          ))}
          {/* the four frets of the block */}
          <rect x={fx(pos - 1)} y={20} width={fx(pos + 3) - fx(pos - 1)} height={140} rx={6} fill="var(--primary)" opacity={0.18} />
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <g key={s} onClick={() => setStr(s)} className="cursor-pointer">
              <rect x={0} y={sy(s) - 10} width={640} height={20} fill="transparent" />
              <line x1={NUT_X - 6} x2={fx(FRETS) + 10} y1={sy(s)} y2={sy(s)} stroke={s >= 4 ? WOOD.bass : WOOD.string} strokeWidth={0.9 + s * 0.45} opacity={s === str ? 1 : 0.55} />
              <text x={14} y={sy(s) + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill={s === str ? "var(--primary)" : "var(--muted-foreground)"}>
                {CIRCLED[s]}
              </text>
            </g>
          ))}
          {[1, 2, 3, 4].map((f) => {
            const x = pressX(pos + f - 1);
            return (
              <g key={f} style={{ transform: `translate(${x}px, ${sy(str)}px)`, transition: "transform 0.45s cubic-bezier(.3,1.4,.5,1)" }} pointerEvents="none">
                <g className={lit === f ? "ill-pop" : undefined} key={lit === f ? `on${f}` : f}>
                  <circle r={11} fill={lit === f ? "var(--accent)" : f === 1 ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth={2.5} />
                  <text y={4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill={f === 1 && lit !== f ? "var(--primary-foreground)" : "var(--foreground)"}>
                    {f}
                  </text>
                </g>
              </g>
            );
          })}
          <text x={(fx(pos - 1) + fx(pos + 3)) / 2} y={194} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--primary)">
            {t("Position {0}", ROMAN[pos])}
          </text>
        </svg>
      </div>
      <div className="grid gap-2">
        <Chips items={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: ROMAN[i + 1] }))} value={pos} onChange={setPos} />
        <Chips items={[1, 2, 3, 4, 5, 6].map((s) => ({ value: s, label: CIRCLED[s] }))} value={str} onChange={setStr} />
      </div>
      <Explain>
        <p>
          <span className="font-bold">{t("Position {0}", ROMAN[pos])}</span>: {t("finger 1 in fret {0}, finger 2 in fret {1}, finger 3 in fret {2}, finger 4 in fret {3}.", pos, pos + 1, pos + 2, pos + 3)}
        </p>
        <p className="text-muted-foreground">{t("The position is named after where the index finger (1) is.")}</p>
      </Explain>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={playBlock}>
          <Play /> {t("Pluck 1 → 4 → 1")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("Exercises:")}</span>
        {DRILLS.map(([p, s], i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setPos(p);
              setStr(s);
            }}
            className="rounded-full border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
          >
            {i + 1}. {ROMAN[p]} {CIRCLED[s]}
          </button>
        ))}
      </div>
    </IllustrationFrame>
  );
}
