"use client";

import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chips, Explain, IllustrationFrame } from "./common";
import { startMetronome, unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const BPM = 76;

export function TimeSignature({ caption }: { caption?: string }) {
  const t = useT();
  const [beats, setBeats] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<{ i: number; n: number } | null>(null);

  useEffect(() => {
    if (!playing) return;
    let n = 0;
    const stop = startMetronome(() => BPM, beats, (i) => setBeat({ i, n: ++n }));
    return () => {
      stop();
      setBeat(null);
    };
  }, [playing, beats]);

  const toggle = async () => {
    await unlockAudio();
    setPlaying((p) => !p);
  };

  return (
    <IllustrationFrame title="Time signatures" hint="Press Play and tap your foot" caption={caption}>
      <Chips items={[4, 3, 2].map((b) => ({ value: b, label: `${b}/4` }))} value={beats} onChange={setBeats} />
      <div className="flex items-center gap-4">
        <div className="grid shrink-0 place-items-center rounded-xl border bg-muted px-3 py-1 font-music text-5xl leading-none" aria-label={`${beats}/4`}>
          <span className="leading-[0.85]">{String.fromCodePoint(0xe080 + beats)}</span>
          <span className="leading-[0.85]">{String.fromCodePoint(0xe084)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-around gap-2">
          {Array.from({ length: beats }, (_, i) => {
            const on = beat?.i === i;
            return (
              <div key={`${i}-${on ? beat!.n : 0}`} className="grid justify-items-center gap-1">
                <span
                  className={cn(
                    "grid place-items-center rounded-full font-extrabold transition-colors",
                    i === 0 ? "size-14 text-2xl" : "size-10 text-lg",
                    on ? (i === 0 ? "ill-pop bg-accent text-accent-foreground" : "ill-pop bg-primary text-primary-foreground") : i === 0 ? "bg-warning-soft ring-2 ring-accent" : "bg-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">{i === 0 ? t("strong") : t("light")}</span>
              </div>
            );
          })}
        </div>
        {/* a foot that taps every beat */}
        <svg viewBox="0 0 70 60" className="w-16 shrink-0" aria-hidden>
          <line x1={4} x2={66} y1={56} y2={56} className="stroke-border" strokeWidth={3} />
          <g className={beat ? "ill-foot" : undefined} style={{ transformOrigin: "14px 52px", transform: "rotate(-18deg)" }} key={beat?.n}>
            <path d="M8 54 Q6 40 16 38 L22 20 L34 20 L32 40 Q56 42 62 50 Q64 54 58 55 Z" className="fill-foreground" />
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={toggle}>
          {playing ? <Square /> : <Play />} {playing ? t("Stop") : t("Play")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("{0} bpm · the first click is higher", BPM)}</span>
      </div>
      <Explain>
        <p>
          <span className="font-bold">{beats}/4</span>: {t("{0} beats in every bar. Count", beats)}{" "}
          {Array.from({ length: beats }, (_, i) => (
            <span key={i} className={cn(beat?.i === i && "font-extrabold text-primary", i === 0 && "font-bold")}>
              {i ? " – " : ""}
              {i + 1}
            </span>
          ))}
          . {t("Beat 1 is always the strongest.")}
        </p>
      </Explain>
    </IllustrationFrame>
  );
}
