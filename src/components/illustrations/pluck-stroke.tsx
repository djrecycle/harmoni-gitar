"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Turtle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chips, Explain, IllustrationFrame, WOOD, r2 } from "./common";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Kind = "apoyando" | "tirando";
type Pt = [number, number];

/* Side view: the strings are dots (③ on top, ① at the bottom), the guitar top is the bar on the right. */
const S: Record<1 | 2 | 3, Pt> = { 3: [258, 66], 2: [258, 120], 1: [258, 174] };
const BOARD_X = 300;
const KNUCKLE: Pt = [118, 34];
const SEG = 84;
const TIP_R = 11;
const P0: Pt = [242, 128]; // touching ② from outside
const END: Record<Kind, Pt> = { apoyando: [254, 84], tirando: [204, 78] };
const LIFT: Pt = [196, 118];

const CYCLE = 3600;
const PHASES = [
  { until: 900, phase: 1 },
  { until: 1300, phase: 2 },
  { until: 2500, phase: 3 },
  { until: CYCLE, phase: 0 },
];

const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** Fingertip position at time `ms` of the loop. */
function tipAt(kind: Kind, ms: number): Pt {
  if (ms < 900) return P0;
  if (ms < 1300) return lerp(P0, END[kind], ease((ms - 900) / 400));
  if (ms < 2500) return END[kind];
  if (ms < 3050) return lerp(END[kind], LIFT, ease((ms - 2500) / 550));
  return lerp(LIFT, P0, ease((ms - 3050) / 550));
}

/** Middle joint of a two-segment finger from the knuckle to the tip (the joint bulges outward). */
function joint(tip: Pt): Pt {
  const dx = tip[0] - KNUCKLE[0];
  const dy = tip[1] - KNUCKLE[1];
  const d = Math.min(Math.hypot(dx, dy), SEG * 2 - 0.01);
  const a = Math.atan2(dy, dx) - Math.acos(d / (2 * SEG));
  return [r2(KNUCKLE[0] + SEG * Math.cos(a)), r2(KNUCKLE[1] + SEG * Math.sin(a))];
}

const STATIC_MS: Record<1 | 2 | 3, number> = { 1: 400, 2: 1100, 3: 2000 };

export function PluckStroke({ initial, caption }: { initial: Kind; caption?: string }) {
  const t = useT();
  const [kind, setKind] = useState<Kind>(initial);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const [ms, setMs] = useState(0);
  const [cycle, setCycle] = useState(0);
  const clock = useRef({ start: 0, slow: false });

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setMs(STATIC_MS[3]);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const speed = slow ? 2 : 1;
    clock.current.start = performance.now() - ms * speed;
    const tick = (now: number) => {
      const total = (now - clock.current.start) / speed;
      setMs(total % CYCLE);
      setCycle(Math.floor(total / CYCLE));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart the clock only when play/speed changes
  }, [playing, slow]);

  const phase = PHASES.find((p) => ms < p.until)!.phase;
  const tip = tipAt(kind, ms);
  const j = joint(tip);
  // ② is pushed by the tip during the first part of the stroke, then slips off and vibrates.
  const pushing = ms >= 900 && ms < 1100;
  const s2: Pt = pushing ? [S[2][0] + (tip[0] - P0[0]) * 0.5, S[2][1] + (tip[1] - P0[1]) * 0.35] : S[2];
  const ringing = ms >= 1100 && ms < 2900;
  const resting = kind === "apoyando" && ms >= 1300 && ms < 2500;

  const show = (p: 1 | 2 | 3) => {
    setPlaying(false);
    setMs(STATIC_MS[p]);
  };

  const steps: Record<1 | 2 | 3, string> = {
    1: "Prepare: the fingertip touches the string.",
    2: "Pluck: push the string toward the guitar body.",
    3: kind === "apoyando" ? "Finish: the finger rests on the next string (the one above)." : "Finish: the finger lifts away and touches no other string.",
  };

  return (
    <IllustrationFrame title={kind === "apoyando" ? "Apoyando stroke" : "Tirando stroke"} hint="Seen from the side: the dots are strings" caption={caption}>
      <Chips
        items={[
          { value: "apoyando" as Kind, label: "Apoyando" },
          { value: "tirando" as Kind, label: "Tirando" },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setMs(0);
          setPlaying(true);
        }}
      />
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 360 230" className="mx-auto w-full max-w-sm select-none" role="img" aria-label={t(kind === "apoyando" ? "Apoyando stroke" : "Tirando stroke")}>
          {/* guitar top */}
          <rect x={BOARD_X} y={10} width={20} height={210} rx={3} fill={WOOD.top} stroke={WOOD.edge} strokeWidth={2} />
          <text x={340} y={115} fontSize={11} className="fill-muted-foreground" textAnchor="middle" transform="rotate(90 340 115)">
            {t("guitar body")}
          </text>
          {/* direction of the push */}
          {phase === 2 && (
            <path d={kind === "apoyando" ? "M222 150 Q250 120 246 92" : "M222 150 Q226 110 196 92"} stroke="var(--accent)" strokeWidth={3} fill="none" strokeLinecap="round" markerEnd="url(#ill-arrow)" />
          )}
          <defs>
            <marker id="ill-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)" />
            </marker>
          </defs>
          {/* strings */}
          {([3, 2, 1] as const).map((n) => {
            const [x, y] = n === 2 ? s2 : S[n];
            const touched = n === 3 && resting;
            const free = n === 3 && kind === "tirando" && phase === 3;
            return (
              <g key={n}>
                {n === 2 && ringing && <ellipse key={cycle} cx={x} cy={y} rx={14} ry={5} fill={WOOD.bass} className="ill-vibrate" />}
                {(touched || free) && <circle cx={x} cy={y} r={13} fill="none" stroke={touched ? "var(--primary)" : "var(--success)"} strokeWidth={2.5} strokeDasharray={free ? "3 3" : undefined} />}
                <circle cx={x} cy={y} r={6} fill={n === 2 ? "var(--accent)" : WOOD.bass} stroke="#57534e" strokeWidth={1.5} />
                <text x={283} y={S[n][1] + 4} fontSize={13} fontWeight={800} className="fill-foreground" textAnchor="middle">
                  {["", "①", "②", "③"][n]}
                </text>
              </g>
            );
          })}
          {/* hand + finger */}
          <ellipse cx={86} cy={14} rx={60} ry={34} fill={WOOD.skin} stroke={WOOD.skinEdge} strokeWidth={1.5} />
          <polyline points={`${KNUCKLE} ${j} ${tip}`} fill="none" stroke={WOOD.skinEdge} strokeWidth={TIP_R * 2 + 3} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={`${KNUCKLE} ${j} ${tip}`} fill="none" stroke={WOOD.skin} strokeWidth={TIP_R * 2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={j[0]} cy={j[1]} r={2.5} fill={WOOD.skinEdge} />
          <text x={KNUCKLE[0] - 30} y={20} fontSize={12} fontWeight={800} className="fill-foreground">
            i / m
          </text>
        </svg>
        <ol className="grid gap-1.5 text-sm">
          {([1, 2, 3] as const).map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => show(p)}
                className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors", phase === p ? "bg-primary-soft font-semibold" : "hover:bg-muted")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", phase === p ? "bg-primary text-primary-foreground" : "bg-muted")}>{p}</span>
                {t(steps[p])}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause /> : <Play />} {playing ? t("Pause") : t("Play")}
        </Button>
        <Button size="sm" variant={slow ? "default" : "outline"} onClick={() => setSlow((s) => !s)} aria-pressed={slow}>
          <Turtle /> {t("Slow")}
        </Button>
      </div>
      <Explain>
        {kind === "apoyando"
          ? t("Apoyando (resting stroke) is used for melody: the note sounds full and strong.")
          : t("Tirando (free stroke) is used for chords and accompaniment: the other strings keep ringing.")}
      </Explain>
    </IllustrationFrame>
  );
}
