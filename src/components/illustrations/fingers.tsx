"use client";

import { useRef, useState } from "react";
import { Gamepad2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Explain, IllustrationFrame, WOOD } from "./common";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
type Hand = "left" | "right";

const FINGER_NAME: Record<Finger, string> = { thumb: "thumb", index: "index finger", middle: "middle finger", ring: "ring finger", pinky: "little finger" };
const RIGHT: Record<Finger, { sym: string; name: string }> = {
  thumb: { sym: "p", name: "pulgar" },
  index: { sym: "i", name: "indice" },
  middle: { sym: "m", name: "medio" },
  ring: { sym: "a", name: "anular" },
  pinky: { sym: "ch", name: "chico" },
};
const LEFT: Record<Finger, string | null> = { thumb: null, index: "1", middle: "2", ring: "3", pinky: "4" };

/** Back of a left hand (thumb on the right), in local units; the right hand is the mirror image. */
const SHAPE: Record<Exclude<Finger, "thumb">, { x: number; top: number }> = {
  pinky: { x: 10, top: 76 },
  ring: { x: 34, top: 52 },
  middle: { x: 58, top: 40 },
  index: { x: 82, top: 54 },
};
const W = 19;
const THUMB = { from: [98, 168], to: [128, 128] } as const;
/** Fingertip (label) position in local units. */
const tip = (f: Finger): [number, number] => (f === "thumb" ? [THUMB.to[0] + 2, THUMB.to[1] - 2] : [SHAPE[f].x, SHAPE[f].top + 11]);

const QUESTIONS: { hand: Hand; finger: Finger }[] = [
  ...(["thumb", "index", "middle", "ring"] as Finger[]).map((finger) => ({ hand: "right" as Hand, finger })),
  ...(["index", "middle", "ring", "pinky"] as Finger[]).map((finger) => ({ hand: "left" as Hand, finger })),
];
const ROUNDS = 10;
const symbol = (hand: Hand, f: Finger) => (hand === "right" ? RIGHT[f].sym : LEFT[f]);

export function Fingers({ caption }: { caption?: string }) {
  const t = useT();
  const [sel, setSel] = useState<{ hand: Hand; finger: Finger } | null>(null);
  const [game, setGame] = useState<{ round: number; score: number; q: (typeof QUESTIONS)[number]; result: "right" | "wrong" | null } | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const next = useRef<ReturnType<typeof setTimeout>>(undefined);

  const randomQ = (prev?: (typeof QUESTIONS)[number]) => {
    let q;
    do q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    while (prev && q.hand === prev.hand && q.finger === prev.finger);
    return q;
  };
  const start = () => {
    clearTimeout(next.current);
    setDone(null);
    setSel(null);
    setGame({ round: 1, score: 0, q: randomQ(), result: null });
  };

  const tap = (hand: Hand, finger: Finger) => {
    setSel({ hand, finger });
    if (!game || game.result === "right") return;
    const right = game.q.hand === hand && game.q.finger === finger;
    // Only the first try of a round scores.
    const score = game.score + (right && game.result === null ? 1 : 0);
    setGame({ ...game, score, result: right ? "right" : "wrong" });
    if (right) {
      next.current = setTimeout(() => {
        setSel(null);
        if (game.round >= ROUNDS) {
          setGame(null);
          setDone(score);
        } else setGame({ round: game.round + 1, score, q: randomQ(game.q), result: null });
      }, 900);
    }
  };

  const hand = (h: Hand) => {
    const ox = h === "left" ? 18 : 342;
    const sx = h === "left" ? 1 : -1;
    const X = (x: number) => ox + sx * x;
    const lifted = (f: Finger) => sel?.hand === h && sel.finger === f;
    const color = (f: Finger) => (lifted(f) ? (game?.result === "wrong" ? "var(--danger)" : "var(--primary)") : WOOD.skin);
    return (
      <g>
        <g transform={`translate(${ox} 0) scale(${sx} 1)`}>
          <rect x={-2} y={112} width={96} height={86} rx={26} fill={WOOD.skin} stroke={WOOD.skinEdge} strokeWidth={1.5} />
          {(Object.keys(SHAPE) as Exclude<Finger, "thumb">[]).map((f) => (
            <g key={f} onClick={() => tap(h, f)} className="cursor-pointer" style={{ transform: `translateY(${lifted(f) ? -10 : 0}px)`, transition: "transform 0.15s" }}>
              <rect x={SHAPE[f].x - W / 2} y={SHAPE[f].top} width={W} height={140 - SHAPE[f].top} rx={W / 2} fill={color(f)} stroke={WOOD.skinEdge} strokeWidth={1.5} className="transition-colors" />
              <rect x={SHAPE[f].x - 5.5} y={SHAPE[f].top + 4} width={11} height={13} rx={4} fill="#fbe3cf" opacity={0.85} />
            </g>
          ))}
          <g onClick={() => tap(h, "thumb")} className="cursor-pointer">
            <line x1={THUMB.from[0]} y1={THUMB.from[1]} x2={THUMB.to[0]} y2={THUMB.to[1]} stroke={WOOD.skinEdge} strokeWidth={W + 3} strokeLinecap="round" />
            <line x1={THUMB.from[0]} y1={THUMB.from[1]} x2={THUMB.to[0]} y2={THUMB.to[1]} stroke={color("thumb")} strokeWidth={W} strokeLinecap="round" className="transition-colors" />
          </g>
        </g>
        {(["thumb", "index", "middle", "ring", "pinky"] as Finger[]).map((f) => {
          const s = symbol(h, f);
          if (!s || game) return null;
          const [x, y] = tip(f);
          return (
            <g key={f} pointerEvents="none" style={{ transform: `translateY(${lifted(f) ? -10 : 0}px)`, transition: "transform 0.15s" }}>
              <circle cx={X(x)} cy={y - 26} r={11} fill={lifted(f) ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth={2} />
              <text x={X(x)} y={y - 21.5} textAnchor="middle" fontSize={s.length > 1 ? 11 : 14} fontWeight={800} fill={lifted(f) ? "var(--primary-foreground)" : "var(--primary)"}>
                {s}
              </text>
            </g>
          );
        })}
        <text x={X(58)} y={224} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-foreground">
          {h === "left" ? t("Left hand: numbers") : t("Right hand: letters")}
        </text>
      </g>
    );
  };

  const info = sel && !game && (
    <p>
      {sel.hand === "right" ? (
        <>
          <span className="font-bold">
            {RIGHT[sel.finger].sym} = {RIGHT[sel.finger].name}
          </span>{" "}
          · {t(FINGER_NAME[sel.finger])} · {t("right hand (plucks)")}
        </>
      ) : LEFT[sel.finger] ? (
        <>
          <span className="font-bold">
            {LEFT[sel.finger]} = {t(FINGER_NAME[sel.finger])}
          </span>{" "}
          · {t("left hand (presses)")}
        </>
      ) : (
        t("The left thumb has no number: it rests behind the neck.")
      )}
    </p>
  );

  return (
    <IllustrationFrame title="Finger names" hint="Tap a finger" caption={caption}>
      <svg viewBox="0 0 360 232" className="mx-auto w-full max-w-md select-none" role="img" aria-label={t("Finger names")}>
        {hand("left")}
        {hand("right")}
      </svg>
      {game ? (
        <div className={cn("grid gap-2 rounded-lg p-3 text-center", game.result === "right" ? "bg-success-soft" : game.result === "wrong" ? "bg-danger-soft" : "bg-primary-soft")} aria-live="polite">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("Round {0} of {1}", game.round, ROUNDS)} · {t("Score {0}", game.score)}
          </p>
          <p className="text-sm">{t("Tap the finger:")}</p>
          <p className="text-4xl font-extrabold text-primary">{symbol(game.q.hand, game.q.finger)}</p>
          <p className="min-h-5 text-sm font-semibold">{game.result === "right" ? t("Right! 🎉") : game.result === "wrong" ? t("Not that one, try again!") : ""}</p>
          <Button size="sm" variant="ghost" className="justify-self-center" onClick={() => setGame(null)}>
            <X /> {t("Stop the game")}
          </Button>
        </div>
      ) : (
        <>
          <Explain>
            {info ||
              (done !== null ? (
                <p className="font-semibold">{t("Finished! You got {0} of {1} right on the first try.", done, ROUNDS)}</p>
              ) : (
                <p>{t("Letters (p i m a) = right hand. Numbers (1 2 3 4) = left hand. Tap a finger to see its name.")}</p>
              ))}
          </Explain>
          <Button size="sm" variant="secondary" className="justify-self-start" onClick={start}>
            <Gamepad2 /> {done !== null ? t("Play again") : t("Game: find the finger!")}
          </Button>
        </>
      )}
    </IllustrationFrame>
  );
}
