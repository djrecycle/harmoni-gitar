"use client";

import { useEffect, useState } from "react";
import { Explain, IllustrationFrame, WOOD } from "./common";
import { BODY, HEAD, NUT } from "./guitar-parts";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const STEPS: { text: string; at: [number, number] }[] = [
  { text: "Sit up straight and relaxed, at the front edge of a chair without arms. Your back is not bent.", at: [124, 152] },
  { text: "Your left foot goes on the footstool.", at: [240, 360] },
  { text: "The guitar rests on your left thigh.", at: [200, 261] },
  { text: "Your left elbow hangs relaxed beside the guitar body.", at: [224, 192] },
  { text: "Your shoulders stay relaxed, not raised.", at: [112, 120] },
  { text: "The head of the guitar is about as high as your eyes.", at: [292, 86] },
];

const SHIRT = "#6366f1";
const PANTS = "#334155";
const CHAIR = "#a16207";

/** Front view of a child playing, drawn for this app. Numbered dots explain the posture one point at a time. */
export function Sitting({ caption }: { caption?: string }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(id);
  }, [auto]);
  const pick = (i: number) => {
    setAuto(false);
    setStep(i);
  };

  return (
    <IllustrationFrame title="Sitting position" hint="Tap the numbers" caption={caption}>
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 340 390" className="mx-auto w-full max-w-sm select-none" role="img" aria-label={t("Sitting position")}>
          <line x1={0} x2={340} y1={381} y2={381} className="stroke-border" strokeWidth={3} />
          {/* chair */}
          <rect x={104} y={124} width={92} height={132} rx={8} fill={CHAIR} opacity={0.45} />
          <rect x={64} y={252} width={172} height={12} rx={4} fill={CHAIR} />
          <rect x={72} y={262} width={8} height={118} fill={CHAIR} />
          <rect x={220} y={262} width={8} height={118} fill={CHAIR} />
          {/* footstool */}
          <path d="M204 350 L262 340 L262 380 L204 380 Z" fill="#78716c" />
          {/* legs: knees bent and apart, the left foot raised on the footstool */}
          <path d="M132 252 L94 280 L98 366" stroke={PANTS} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <ellipse cx={92} cy={373} rx={20} ry={7} fill="#1f2937" />
          <path d="M170 252 L214 266 L226 334" stroke={PANTS} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <ellipse cx={234} cy={340} rx={20} ry={7} fill="#1f2937" transform="rotate(-10 234 340)" />
          {/* body */}
          <path d="M112 128 Q150 112 188 128 L184 262 L116 262 Z" fill={SHIRT} />
          <rect x={143} y={100} width={14} height={18} fill={WOOD.skin} />
          <circle cx={150} cy={80} r={26} fill={WOOD.skin} stroke={WOOD.skinEdge} strokeWidth={1.5} />
          <path d="M124 76 Q128 50 150 52 Q174 50 177 76 Q166 62 150 64 Q134 62 124 76 Z" fill="#3f2a1d" />
          <circle cx={141} cy={84} r={2.6} fill="#1f2937" />
          <circle cx={159} cy={84} r={2.6} fill="#1f2937" />
          <path d="M142 94 Q150 100 158 94" stroke="#9a3412" strokeWidth={2} fill="none" strokeLinecap="round" />
          {/* guitar: the same drawing as "Parts of the guitar", rotated so its head rises to eye level */}
          <g transform="translate(165 228) rotate(-44) scale(0.44) translate(-164 -120)">
            <path d={`M300 99 L${NUT + 3} 100 L${NUT + 3} 140 L300 141 Z`} fill={WOOD.side} stroke={WOOD.edge} strokeWidth={4} />
            <rect x={262} y={102} width={NUT - 262} height={36} fill={WOOD.board} />
            <path d={HEAD} fill={WOOD.side} stroke={WOOD.edge} strokeWidth={4} />
            <path d={BODY} fill={WOOD.top} stroke={WOOD.edge} strokeWidth={5} />
            <circle cx={230} cy={120} r={29} fill={WOOD.hole} />
            <rect x={78} y={90} width={24} height={60} rx={5} fill={WOOD.side} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line key={i} x1={92} x2={NUT} y1={108 + i * 5} y2={108 + i * 5} stroke={WOOD.string} strokeWidth={1.6} />
            ))}
          </g>
          {/* arms: right arm over the lower bout, left hand on the neck */}
          <path d="M116 132 L100 196 L156 232" stroke={SHIRT} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx={160} cy={234} r={10} fill={WOOD.skin} stroke={WOOD.skinEdge} strokeWidth={1.5} />
          <path d="M184 132 L222 192 L244 152" stroke={SHIRT} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx={247} cy={146} r={10} fill={WOOD.skin} stroke={WOOD.skinEdge} strokeWidth={1.5} />
          {/* eye level */}
          {step === 5 && <line x1={166} x2={300} y1={84} y2={84} stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 4" />}

          {STEPS.map((s, i) => (
            <g key={i} onClick={() => pick(i)} className="cursor-pointer" role="button" aria-label={String(i + 1)}>
              <circle cx={s.at[0]} cy={s.at[1]} r={18} fill="transparent" />
              {step === i && <circle cx={s.at[0]} cy={s.at[1]} r={16} fill="var(--primary)" opacity={0.35} className="ill-pulse" />}
              <circle cx={s.at[0]} cy={s.at[1]} r={11} fill={step === i ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth={2} />
              <text x={s.at[0]} y={s.at[1] + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill={step === i ? "var(--primary-foreground)" : "var(--primary)"}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        <ol className="grid gap-1.5 text-sm">
          {STEPS.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(i)}
                className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors", step === i ? "bg-primary-soft font-semibold" : "hover:bg-muted")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", step === i ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
                {t(s.text)}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <Explain className="sr-only">{t(STEPS[step].text)}</Explain>
    </IllustrationFrame>
  );
}
