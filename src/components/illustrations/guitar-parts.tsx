"use client";

import { useEffect, useState } from "react";
import { Chips, Explain, IllustrationFrame, WOOD, r2 } from "./common";
import { useT } from "@/i18n/client";

type Part = "head" | "pegs" | "nut" | "neck" | "fingerboard" | "frets" | "body" | "soundhole" | "bridge";

const PARTS: { id: Part; name: string; desc: string; at: [number, number] }[] = [
  { id: "head", name: "Head", desc: "The top end of the guitar. The tuning pegs sit here.", at: [600, 120] },
  { id: "pegs", name: "Tuning pegs", desc: "Turn them to tighten or loosen a string. Tighter sounds higher.", at: [585, 88] },
  { id: "nut", name: "Nut", desc: "The small white bar at the top of the neck where the strings rest.", at: [534, 104] },
  { id: "neck", name: "Neck", desc: "The long part your left hand holds.", at: [470, 140] },
  { id: "fingerboard", name: "Fingerboard", desc: "The dark front of the neck. Your left-hand fingers press the strings here.", at: [400, 106] },
  { id: "frets", name: "Frets", desc: "The metal wires across the fingerboard. Fret 1 is the one closest to the nut.", at: [495, 104] },
  { id: "body", name: "Body", desc: "The big hollow part. It makes the sound loud.", at: [70, 60] },
  { id: "soundhole", name: "Sound hole", desc: "The round hole. The sound comes out here.", at: [230, 92] },
  { id: "bridge", name: "Bridge", desc: "Where the strings are tied to the body.", at: [90, 92] },
];

export const NUT = 533;
const SCALE = 441; // nut to saddle
export const fretX = (n: number) => r2(NUT - SCALE * (1 - 2 ** (-n / 12)));
const FRETS = Array.from({ length: 16 }, (_, i) => fretX(i + 1));
export const BODY =
  "M310 120 C310 75 285 48 250 48 C220 48 205 62 185 62 C165 62 145 28 95 28 C45 28 18 70 18 120 C18 170 45 212 95 212 C145 212 165 178 185 178 C205 178 220 192 250 192 C285 192 310 165 310 120 Z";
export const HEAD = "M536 103 L625 97 Q633 97 633 105 L633 135 Q633 143 625 143 L536 137 Z";
const PEG_X = [565, 588, 611];
/** String y on the fingerboard at x (they fan out a little toward the bridge). ⑥ is drawn on top. */
const stringY = (s: number, x: number) => {
  const k = (NUT - x) / (NUT - 92);
  const spread = 4.6 + k * 1.6;
  return r2(120 + (s - 3.5) * -spread);
};

function shape(part: Part, p: React.SVGProps<SVGElement>) {
  const q = p as Record<string, unknown>;
  switch (part) {
    case "body":
      return <path d={BODY} {...q} />;
    case "head":
      return <path d={HEAD} {...q} />;
    case "pegs":
      return (
        <g {...q}>
          {PEG_X.map((x) => (
            <g key={x}>
              <rect x={x - 6} y={80} width={12} height={14} rx={4} />
              <rect x={x - 6} y={146} width={12} height={14} rx={4} />
            </g>
          ))}
        </g>
      );
    case "nut":
      return <rect x={NUT - 1} y={101} width={7} height={38} rx={1.5} {...q} />;
    case "neck":
      return <path d={`M300 99 L${NUT + 3} 100 L${NUT + 3} 140 L300 141 Z`} {...q} />;
    case "fingerboard":
      return <rect x={262} y={102} width={NUT - 262} height={36} {...q} />;
    case "frets":
      return (
        <g {...q} fill="none">
          {FRETS.filter((x) => x > 264).map((x) => (
            <line key={x} x1={x} x2={x} y1={102} y2={138} strokeWidth={4} />
          ))}
        </g>
      );
    case "soundhole":
      return <circle cx={230} cy={120} r={29} {...q} />;
    case "bridge":
      return <rect x={78} y={90} width={24} height={60} rx={5} {...q} />;
  }
}

export function GuitarParts({ caption }: { caption?: string }) {
  const t = useT();
  const [sel, setSel] = useState<Part>("head");
  const [auto, setAuto] = useState(true);
  // A slow tour of all the parts until the child taps something.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setSel((s) => PARTS[(PARTS.findIndex((p) => p.id === s) + 1) % PARTS.length].id), 2600);
    return () => clearInterval(id);
  }, [auto]);
  const pick = (p: Part) => {
    setAuto(false);
    setSel(p);
  };
  const cur = PARTS.find((p) => p.id === sel)!;
  const lx = Math.min(580, Math.max(60, cur.at[0]));
  const below = cur.at[1] > 130;

  return (
    <IllustrationFrame title="Parts of the guitar" hint="Tap a part of the guitar" caption={caption}>
      <svg viewBox="0 0 640 240" className="w-full select-none" role="img" aria-label={t("Parts of the guitar")}>
        {/* body */}
        <path d={BODY} fill={WOOD.top} stroke={WOOD.edge} strokeWidth={3} onClick={() => pick("body")} className="cursor-pointer" />
        <circle cx={230} cy={120} r={35} fill="none" stroke={WOOD.side} strokeWidth={5} strokeDasharray="3 2" />
        <circle cx={230} cy={120} r={29} fill={WOOD.hole} onClick={() => pick("soundhole")} className="cursor-pointer" />
        <rect x={78} y={90} width={24} height={60} rx={5} fill={WOOD.side} stroke={WOOD.edge} strokeWidth={2} onClick={() => pick("bridge")} className="cursor-pointer" />
        <line x1={92} x2={92} y1={95} y2={145} stroke={WOOD.bone} strokeWidth={3} />
        {/* neck + fingerboard + frets */}
        <path d={`M300 99 L${NUT + 3} 100 L${NUT + 3} 140 L300 141 Z`} fill={WOOD.side} stroke={WOOD.edge} strokeWidth={2} onClick={() => pick("neck")} className="cursor-pointer" />
        <rect x={262} y={102} width={NUT - 262} height={36} fill={WOOD.board} onClick={() => pick("fingerboard")} className="cursor-pointer" />
        {FRETS.filter((x) => x > 264).map((x) => (
          <line key={x} x1={x} x2={x} y1={102} y2={138} stroke="#c9ccd1" strokeWidth={2} onClick={() => pick("frets")} className="cursor-pointer" />
        ))}
        <rect x={NUT - 1} y={101} width={7} height={38} rx={1.5} fill={WOOD.bone} onClick={() => pick("nut")} className="cursor-pointer" />
        {/* head + pegs */}
        <path d={HEAD} fill={WOOD.side} stroke={WOOD.edge} strokeWidth={2} onClick={() => pick("head")} className="cursor-pointer" />
        <rect x={552} y={107} width={68} height={8} rx={4} fill={WOOD.hole} />
        <rect x={552} y={125} width={68} height={8} rx={4} fill={WOOD.hole} />
        {PEG_X.map((x) => (
          <g key={x} onClick={() => pick("pegs")} className="cursor-pointer">
            <line x1={x} x2={x} y1={94} y2={146} stroke="#d6d3d1" strokeWidth={2} />
            <rect x={x - 6} y={80} width={12} height={14} rx={4} fill={WOOD.bone} stroke={WOOD.edge} strokeWidth={1.5} />
            <rect x={x - 6} y={146} width={12} height={14} rx={4} fill={WOOD.bone} stroke={WOOD.edge} strokeWidth={1.5} />
          </g>
        ))}
        {/* strings */}
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <polyline
            key={s}
            points={`92,${stringY(s, 92)} ${NUT},${stringY(s, NUT)} ${PEG_X[(s - 1) % 3]},${s <= 3 ? 129 : 111}`}
            fill="none"
            stroke={s >= 4 ? WOOD.bass : WOOD.string}
            strokeWidth={s >= 4 ? 1.8 : 1.2}
            pointerEvents="none"
          />
        ))}

        {/* highlight of the chosen part */}
        <g key={sel} className="ill-pulse" pointerEvents="none">
          {shape(sel, { fill: "var(--primary)", fillOpacity: sel === "frets" ? 1 : 0.3, stroke: "var(--primary)", strokeWidth: 3 })}
        </g>
        <line x1={lx} y1={below ? 212 : 28} x2={cur.at[0]} y2={cur.at[1]} stroke="var(--primary)" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
        <circle cx={cur.at[0]} cy={cur.at[1]} r={4} fill="var(--primary)" pointerEvents="none" />
        <g pointerEvents="none">
          <rect x={lx - 62} y={below ? 210 : 6} width={124} height={26} rx={13} fill="var(--primary)" />
          <text x={lx} y={below ? 228 : 24} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--primary-foreground)">
            {t(cur.name)}
          </text>
        </g>
      </svg>
      <Chips items={PARTS.map((p) => ({ value: p.id, label: t(p.name) }))} value={sel} onChange={pick} />
      <Explain>
        <span className="font-bold">{t(cur.name)}</span>: {t(cur.desc)}
      </Explain>
    </IllustrationFrame>
  );
}
