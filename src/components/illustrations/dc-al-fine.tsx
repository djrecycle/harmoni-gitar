"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IllustrationFrame } from "./common";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const BAR_W = 88;
const X0 = 22;
const barX = (b: number) => X0 + b * BAR_W; // left edge of bar b (0-based)
const BAR_MS = 800;
const JUMP_MS = 1100;
const HOLD_MS = 1600;
const T_JUMP = 4 * BAR_MS;
const T_AGAIN = T_JUMP + JUMP_MS;
const T_END = T_AGAIN + 2 * BAR_MS;
const CYCLE = T_END + HOLD_MS;
const Y = 92;

/** Where the ball is at `ms`, which bar it is in, and which step of the explanation applies. */
function at(ms: number): { x: number; y: number; bar: number | null; step: 1 | 2 | 3; pass: 1 | 2 } {
  if (ms < T_JUMP) {
    const p = ms / BAR_MS;
    const k = p % 1;
    return { x: barX(0) + p * BAR_W, y: Y - Math.sin(k * Math.PI) * 26, bar: Math.floor(p), step: 1, pass: 1 };
  }
  if (ms < T_AGAIN) {
    const k = (ms - T_JUMP) / JUMP_MS;
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const x = barX(4) + (barX(0) - barX(4)) * e;
    return { x, y: Y - 8 - Math.sin(e * Math.PI) * 70, bar: null, step: 2, pass: 2 };
  }
  if (ms < T_END) {
    const p = (ms - T_AGAIN) / BAR_MS;
    return { x: barX(0) + p * BAR_W, y: Y - Math.sin((p % 1) * Math.PI) * 26, bar: Math.floor(p), step: 3, pass: 2 };
  }
  return { x: barX(2), y: Y, bar: null, step: 3, pass: 2 };
}

export function DcAlFine({ caption }: { caption?: string }) {
  const t = useT();
  const [ms, setMs] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - ms;
    const tick = (now: number) => {
      setMs((now - start) % CYCLE);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only on play/pause
  }, [playing]);

  const a = at(ms);
  const finished = ms >= T_END;
  const played = [1, 2, 3, 4].filter((b) => a.pass === 2 || (a.bar !== null && b <= a.bar + 1));
  const again = a.pass === 2 ? [1, 2].filter((b) => finished || (a.bar !== null && b <= a.bar + 1)) : [];
  const steps = [
    { n: 1, text: "Play until you reach D.C. al Fine." },
    { n: 2, text: "Go back to the beginning (Da Capo = from the head)." },
    { n: 3, text: "Play again and stop at Fine." },
  ];

  return (
    <IllustrationFrame title="D.C. al Fine" hint="Follow the ball" caption={caption}>
      <svg viewBox="0 0 400 150" className="mx-auto w-full max-w-lg select-none" role="img" aria-label="D.C. al Fine">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={barX(0)} x2={barX(4)} y1={100 + i * 8 - 16} y2={100 + i * 8 - 16} className="stroke-muted-foreground" strokeWidth={1} opacity={0.6} />
        ))}
        {[0, 1, 2, 3].map((b) => (
          <g key={b}>
            <rect x={barX(b) + 1} y={82} width={BAR_W - 2} height={34} fill={a.bar === b ? "var(--primary)" : "transparent"} opacity={0.18} />
            <text x={barX(b) + BAR_W / 2} y={138} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-muted-foreground">
              {t("bar {0}", b + 1)}
            </text>
          </g>
        ))}
        {[0, 1, 3].map((b) => (
          <line key={b} x1={barX(b)} x2={barX(b)} y1={84} y2={116} className="stroke-foreground" strokeWidth={1.5} />
        ))}
        <line x1={barX(2) - 3} x2={barX(2) - 3} y1={84} y2={116} className="stroke-foreground" strokeWidth={1.5} />
        <line x1={barX(2)} x2={barX(2)} y1={84} y2={116} className="stroke-foreground" strokeWidth={1.5} />
        <line x1={barX(4) - 5} x2={barX(4) - 5} y1={84} y2={116} className="stroke-foreground" strokeWidth={1.5} />
        <rect x={barX(4) - 3} y={84} width={4} height={32} className="fill-foreground" />
        <text x={barX(2) - 2} y={76} textAnchor="end" fontSize={15} fontStyle="italic" fontWeight={800} fill={finished ? "var(--success)" : "var(--foreground)"}>
          Fine
        </text>
        <text x={barX(4)} y={76} textAnchor="end" fontSize={13} fontStyle="italic" fontWeight={800} fill={a.step === 2 ? "var(--accent)" : "var(--foreground)"}>
          D.C. al Fine
        </text>
        {a.step === 2 && <path d={`M${barX(4) - 6} 62 Q${(barX(0) + barX(4)) / 2} -6 ${barX(0) + 6} 62`} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="6 5" />}
        {finished ? (
          <g className="ill-pop">
            <circle cx={barX(2) - 2} cy={Y + 8} r={14} fill="var(--success)" />
            <path d={`M${barX(2) - 9} ${Y + 8} l5 5 l9 -10`} stroke="white" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : (
          <circle cx={a.x} cy={a.y} r={9} fill="var(--accent)" stroke="var(--accent-foreground)" strokeWidth={1.5} />
        )}
      </svg>
      <p className="text-center text-sm font-bold tracking-wide" aria-live="polite">
        {played.join(" ")}
        {a.pass === 2 && <span className="text-primary"> ↩ </span>}
        {again.join(" ")}
        {finished && <span className="text-success"> · {t("Finished!")}</span>}
      </p>
      <ol className="grid gap-1 text-sm">
        {steps.map((s) => (
          <li key={s.n} className={cn("flex items-start gap-2 rounded-lg px-2 py-1.5", a.step === s.n && "bg-primary-soft font-semibold")}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", a.step === s.n ? "bg-primary text-primary-foreground" : "bg-muted")}>{s.n}</span>
            {t(s.text)}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="justify-self-start" onClick={() => setPlaying((p) => !p)}>
        {playing ? <Pause /> : <Play />} {playing ? t("Pause") : t("Play")}
      </Button>
    </IllustrationFrame>
  );
}
