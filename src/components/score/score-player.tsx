"use client";

import { useEffect, useRef, useState } from "react";
import { Guitar, LoaderCircle, Mic, MicOff, Minus, Pause, Play, Plus, Repeat, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { micErrorMessage } from "@/components/audio/use-mic-pitch";
import { Alert } from "@/components/ui/misc";
import { noteName } from "@/lib/pitch";
import type * as AlphaTabTypes from "@coderline/alphatab";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ALPHATAB_BASE as BASE, PLAY_EVENT, loadAlphaTab, prepareScore as prepare, type Api } from "./alphatab";
import { usePitchCheck } from "./use-pitch-check";
import { useT } from "@/i18n/client";

type Score = AlphaTabTypes.model.Score;

/* Notation + tablature player (alphaTab, loaded at runtime: see ./alphatab.ts). */
export type ScorePlayerProps = {
  fileUrl: string;
  /** The tempo written in the file (100% speed). */
  defaultBpm: number;
  /** Tempo per stage, shown as quick buttons. */
  stageBpm?: Record<"1" | "2" | "3", number>;
  /** Start at this tempo (e.g. the next stage to reach). */
  initialBpm?: number;
  /** Controlled tempo (e.g. shared with the practice timer's tempo ladder). */
  bpm?: number;
  onBpmChange?: (bpm: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Practice mode: "guitar sound" on/off (play along with cursor + metronome) and "check my notes" with the microphone. */
  practice?: boolean;
};

export function ScorePlayer({ fileUrl, defaultBpm, stageBpm, initialBpm, bpm: controlledBpm, onBpmChange, onPlayingChange, practice }: ScorePlayerProps) {
  const t = useT();
  const id = useRef(Math.random().toString(36).slice(2));
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const scoreRef = useRef<Score | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ownBpm, setOwnBpm] = useState(initialBpm ?? defaultBpm);
  const bpm = controlledBpm ?? ownBpm;
  const [apiState, setApiState] = useState<Api | null>(null);
  const [renderCount, setRenderCount] = useState(0);
  const [guitarSound, setGuitarSound] = useState(true);
  const [checking, setChecking] = useState(false);
  const [part, setPart] = useState(0);
  const onPlayingRef = useRef(onPlayingChange);
  onPlayingRef.current = onPlayingChange;
  const [showTab, setShowTab] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [countIn, setCountIn] = useState(true);
  const [tracks, setTracks] = useState<{ index: number; name: string; muted: boolean }[]>([]);
  const [bars, setBars] = useState(0);
  const [loop, setLoop] = useState({ on: false, from: 1, to: 1 });

  // Start loading when the player scrolls near the screen (a lesson can hold several scores).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !host.current) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const at = await loadAlphaTab();
        if (cancelled || !host.current) return;
        const a = new at.AlphaTabApi(host.current, {
          core: { fontDirectory: `${BASE}/font/` },
          display: { staveProfile: at.StaveProfile.Default, scale: window.innerWidth < 640 ? 0.75 : 0.95 },
          player: {
            playerMode: at.PlayerMode.EnabledSynthesizer,
            soundFont: `${BASE}/soundfont/sonivox.sf2`,
            enableCursor: true,
            enableUserInteraction: true,
            scrollOffsetY: -90,
          },
        } as AlphaTabTypes.json.SettingsJson);
        api.current = a;
        setApiState(a);
        a.playerReady.on(() => setPlayerReady(true));
        a.playerStateChanged.on((e) => {
          const on = e.state === at.synth.PlayerState.Playing;
          setPlaying(on);
          onPlayingRef.current?.(on);
          if (on) window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id.current }));
        });
        a.renderFinished.on(() => setStatus("ready"));
        // The note check's marks are placed from the bounds, which are complete only after this.
        a.postRenderFinished.on(() => setRenderCount((n) => n + 1));
        a.error.on(() => setStatus("error"));

        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        const score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, a.settings);
        prepare(score, true);
        scoreRef.current = score;
        setTracks(score.tracks.map((tr) => ({ index: tr.index, name: tr.name, muted: false })));
        setBars(score.masterBars.length);
        setLoop({ on: false, from: 1, to: Math.min(2, score.masterBars.length) });
        a.metronomeVolume = 0;
        a.countInVolume = 1;
        a.playbackSpeed = (controlledBpm ?? initialBpm ?? defaultBpm) / defaultBpm;
        a.renderScore(score, score.tracks.map((tr) => tr.index));
      } catch (e) {
        console.error("[score]", e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      api.current?.destroy();
      api.current = null;
      setApiState(null);
    };
    // Tempo props only matter for the first load; changing them later must not reload the score.
  }, [visible, fileUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause when another score on the page starts playing.
  useEffect(() => {
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== id.current) api.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, other);
    return () => window.removeEventListener(PLAY_EVENT, other);
  }, []);

  // The playback speed follows the tempo, also when it is changed from outside (the tempo ladder).
  useEffect(() => {
    if (api.current) api.current.playbackSpeed = bpm / defaultBpm;
  }, [bpm, defaultBpm, apiState]);

  const check = usePitchCheck({ api: apiState, track: part, bpm, playing });

  const setTempo = (n: number) => {
    const v = Math.max(20, Math.min(Math.round(defaultBpm * 2), Math.round(n)));
    if (onBpmChange) onBpmChange(v);
    else setOwnBpm(v);
  };

  const toggleTab = () => {
    const next = !showTab;
    setShowTab(next);
    if (scoreRef.current && api.current) {
      prepare(scoreRef.current, next);
      api.current.render();
    }
  };

  const toggleMetronome = () => {
    const next = !metronome;
    setMetronome(next);
    if (api.current) api.current.metronomeVolume = next ? 1 : 0;
  };

  const toggleCountIn = () => {
    const next = !countIn;
    setCountIn(next);
    if (api.current) api.current.countInVolume = next ? 1 : 0;
  };

  const toggleMute = (index: number) => {
    const a = api.current;
    const score = scoreRef.current;
    const tr = tracks.find((x) => x.index === index);
    if (!a || !score || !tr) return;
    a.changeTrackMute([score.tracks[index]], !tr.muted);
    setTracks(tracks.map((x) => (x.index === index ? { ...x, muted: !x.muted } : x)));
  };

  /** Loop bars from..to (1-based, inclusive), or play everything again. */
  const applyLoop = (next: { on: boolean; from: number; to: number }) => {
    const from = Math.max(1, Math.min(bars, next.from));
    const to = Math.max(from, Math.min(bars, next.to));
    setLoop({ on: next.on, from, to });
    const a = api.current;
    const score = scoreRef.current;
    if (!a || !score) return;
    if (next.on) {
      const last = score.masterBars[to - 1];
      a.playbackRange = { startTick: score.masterBars[from - 1].start, endTick: last.start + last.calculateDuration() } as AlphaTabTypes.synth.PlaybackRange;
      a.isLooping = true;
    } else {
      a.playbackRange = null;
      a.isLooping = false;
    }
  };

  /** Guitar sound on/off for every part: off = play along with the cursor (and metronome). */
  const setGuitar = (on: boolean) => {
    const a = api.current;
    const score = scoreRef.current;
    setGuitarSound(on);
    if (!a || !score) return;
    a.changeTrackMute(score.tracks, !on);
    setTracks((ts) => ts.map((x) => ({ ...x, muted: !on })));
    if (!on && !metronome) toggleMetronome();
  };

  const toggleCheck = async () => {
    if (checking) {
      check.mic.stop();
      setChecking(false);
      return;
    }
    if (guitarSound) {
      setGuitar(false);
      toast.info(t("Guitar sound off, so the microphone only hears your guitar. With earphones you can switch it back on."));
    }
    check.reset();
    setChecking(true);
    await check.mic.start();
  };

  // A new run from the start clears the marks of the last one.
  useEffect(() => {
    if (playing && checking && (api.current?.tickPosition ?? 0) < 10) check.reset();
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where to draw the check marks (recomputed after every render of the score).
  const marks = (() => {
    void renderCount;
    const lookup = apiState?.renderer.boundsLookup;
    if (!checking || !lookup) return [];
    const out: { key: string; x: number; y: number; verdict: string; label: string }[] = [];
    for (const r of check.results.values()) {
      const b = lookup.findBeat(r.beat);
      if (!b) continue;
      const vb = b.visualBounds;
      out.push({
        key: `${r.beat.id}`,
        x: vb.x + vb.w / 2,
        y: Math.min(vb.y, b.barBounds.visualBounds.y) - 4,
        verdict: r.verdict,
        label: r.verdict === "ok" ? t("Right") : r.verdict === "missed" ? t("Not heard") : t("Heard {0}, should be {1}", r.heard !== null ? noteName(r.heard) : "-", r.expected.map((m) => noteName(m)).join("/")),
      });
    }
    return out;
  })();

  const stages = stageBpm ? (["1", "2", "3"] as const) : [];

  return (
    <div ref={wrap} className="grid gap-3">
      <div className="sticky top-14 z-20 grid gap-2 rounded-xl border bg-card/95 p-2.5 shadow-sm backdrop-blur lg:top-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => api.current?.playPause()} disabled={!playerReady} aria-label={playing ? t("Pause") : t("Play")}>
            {!playerReady && status !== "error" ? <LoaderCircle className="animate-spin" /> : playing ? <Pause /> : <Play />}
            {playing ? t("Pause") : t("Play")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              api.current?.stop();
              check.reset();
            }}
            disabled={!playerReady}
            aria-label={t("Stop")}
          >
            <Square />
          </Button>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setTempo(bpm - 4)} aria-label={t("Slower")}>
              <Minus />
            </Button>
            <span className="min-w-16 text-center text-sm font-bold tabular-nums">{bpm} bpm</span>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setTempo(bpm + 4)} aria-label={t("Faster")}>
              <Plus />
            </Button>
          </div>
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTempo(stageBpm![s])}
              aria-pressed={bpm === stageBpm![s]}
              className={cn("h-8 rounded-lg border px-2 text-xs font-semibold", bpm === stageBpm![s] ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted")}
            >
              {t("Stage {0}", s)} · {stageBpm![s]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <Toggle on={metronome} onClick={toggleMetronome}>
            {t("Metronome")}
          </Toggle>
          <Toggle on={countIn} onClick={toggleCountIn}>
            {t("Count-in")}
          </Toggle>
          <Toggle on={showTab} onClick={toggleTab}>
            {t("Tab")}
          </Toggle>
          {bars > 1 && (
            <span className="flex items-center gap-1">
              <Toggle on={loop.on} onClick={() => applyLoop({ ...loop, on: !loop.on })}>
                <Repeat className="size-3.5" /> {t("Loop bars")}
              </Toggle>
              <input
                type="number"
                min={1}
                max={bars}
                value={loop.from}
                onChange={(e) => applyLoop({ ...loop, from: Number(e.target.value) })}
                aria-label={t("From bar")}
                className="h-7 w-12 rounded-md border border-input bg-card px-1 text-center text-xs"
              />
              –
              <input
                type="number"
                min={1}
                max={bars}
                value={loop.to}
                onChange={(e) => applyLoop({ ...loop, to: Number(e.target.value) })}
                aria-label={t("To bar")}
                className="h-7 w-12 rounded-md border border-input bg-card px-1 text-center text-xs"
              />
            </span>
          )}
          {practice && (
            <>
              <Toggle on={guitarSound} onClick={() => setGuitar(!guitarSound)} title={t("Off: play along with the cursor and metronome")}>
                <Guitar className="size-3.5" /> {t("Guitar sound")}
              </Toggle>
              <Toggle on={checking} onClick={toggleCheck} title={t("The microphone listens and checks your notes while the score plays")}>
                {checking ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />} {t("Check my notes")}
              </Toggle>
              {checking && tracks.length > 1 && (
                <select value={part} onChange={(e) => setPart(Number(e.target.value))} aria-label={t("Your part")} className="h-7 rounded-full border border-input bg-card px-2 text-xs font-semibold">
                  {tracks.map((tr) => (
                    <option key={tr.index} value={tr.index}>
                      {t("I play: {0}", tr.name)}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          {tracks.length > 1 &&
            !(practice && !guitarSound) &&
            tracks.map((tr) => (
              <Toggle key={tr.index} on={!tr.muted} onClick={() => toggleMute(tr.index)} title={tr.muted ? t("Unmute {0}", tr.name) : t("Mute {0}", tr.name)}>
                {tr.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />} {tr.name}
              </Toggle>
            ))}
        </div>
      </div>

      {checking && (
        <div className="grid gap-2 rounded-xl border bg-card p-3 text-sm">
          {check.mic.status === "error" ? (
            <Alert kind="error" title={t("The microphone could not start")}>
              {micErrorMessage(check.mic.error, t)}
            </Alert>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                {t("Should be")}: <b>{playing && check.live?.expected?.length ? check.live.expected.map((m) => noteName(m)).join(" / ") : "–"}</b>
              </span>
              <span>
                {t("Heard")}:{" "}
                <b
                  className={cn(
                    check.live?.heard != null && check.live.expected?.length
                      ? check.live.expected.some((e) => Math.abs(e - check.live!.heard!) < 0.5 || Math.abs(Math.abs(e - check.live!.heard!) - 12) < 0.5)
                        ? "text-success"
                        : "text-danger"
                      : "",
                  )}
                >
                  {check.live?.heard != null ? noteName(check.live.heard) : "–"}
                </b>
              </span>
              {check.stats.total > 0 && (
                <span className="ml-auto font-semibold">
                  {t("{0} of {1} notes right ({2}%)", check.stats.ok, check.stats.total, Math.round((check.stats.ok / check.stats.total) * 100))}
                </span>
              )}
              {check.stats.total > 0 && (
                <button type="button" onClick={check.reset} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  <RotateCcw className="size-3.5" /> {t("Clear marks")}
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t("Press Play and play along. Each note gets a mark: green = right, red = wrong note, grey = not heard. One note at a time works best; in a chord any of its notes counts.")}
          </p>
        </div>
      )}

      {/* The notation is drawn black on white, also in the dark theme (like paper). */}
      <div className="relative min-h-40 overflow-hidden rounded-xl border bg-white p-1 text-black">
        <div className="relative">
          <div ref={host} />
          {marks.map((m) => (
            <span
              key={m.key}
              title={m.label}
              aria-label={m.label}
              className={cn(
                "pointer-events-auto absolute z-10 size-3 -translate-x-1/2 -translate-y-full rounded-full ring-2 ring-white",
                m.verdict === "ok" ? "bg-emerald-500" : m.verdict === "wrong" ? "bg-red-500" : "bg-neutral-400",
              )}
              style={{ left: m.x, top: m.y }}
            />
          ))}
        </div>
        {status !== "ready" && (
          <div className="absolute inset-0 grid place-items-center text-sm text-neutral-500">
            {status === "error" ? t("The notation could not be loaded. Try reloading the page.") : <LoaderCircle className="size-6 animate-spin" />}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={cn("inline-flex h-7 items-center gap-1 rounded-full border px-2.5 font-semibold", on ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted")}
    >
      {children}
    </button>
  );
}
