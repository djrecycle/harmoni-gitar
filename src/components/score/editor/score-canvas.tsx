"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type * as AlphaTabTypes from "@coderline/alphatab";
import { docToMusicXml, type ScoreDoc } from "@/lib/score/doc";
import { ScoreError } from "@/lib/score/musicxml";
import { useT } from "@/i18n/client";
import { ALPHATAB_BASE, loadAlphaTab, prepareScore, type Api, type Score } from "../alphatab";
import type { Cursor } from "./edit";

type Rect = { x: number; y: number; w: number; h: number };

export type CanvasHandle = {
  api: Api | null;
  score: Score | null;
  playerReady: boolean;
};

/**
 * The editor's score: the doc drawn by alphaTab (notation + tab), redrawn after every change, with the cursor
 * shown as a blue box like in MuseScore. A click on a note or rest selects it (and its string, for a note).
 */
export function ScoreCanvas({
  doc,
  title,
  cursor,
  showTab,
  onSelect,
  handle,
  onPlayer,
}: {
  doc: ScoreDoc;
  title: string;
  cursor: Cursor;
  showTab: boolean;
  onSelect: (c: Cursor, string: number | null) => void;
  handle: React.RefObject<CanvasHandle>;
  onPlayer: (s: { ready: boolean; playing: boolean }) => void;
}) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const at = useRef<typeof AlphaTabTypes | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState<{ beat: Rect | null; bar: Rect | null }>({ beat: null, bar: null });
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const docRef = useRef(doc);
  docRef.current = doc;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPlayerRef = useRef(onPlayer);
  onPlayerRef.current = onPlayer;

  /** Where the cursor is on the rendered score. */
  const place = () => {
    const a = handle.current.api;
    const score = handle.current.score;
    const lookup = a?.renderer.boundsLookup;
    if (!a || !score || !lookup) return setBox({ beat: null, bar: null });
    const c = cursorRef.current;
    const bar = score.tracks[c.part]?.staves[0]?.bars[c.measure];
    const voice = bar?.voices[c.voice];
    const beat = voice?.beats[c.index] ?? null;
    const bb = beat && !beat.isEmpty ? lookup.findBeat(beat) : null;
    if (bb) {
      const barR = bb.barBounds.visualBounds;
      const vb = bb.visualBounds;
      return setBox({ beat: { x: vb.x - 3, y: barR.y, w: Math.max(14, vb.w + 6), h: barR.h }, bar: { x: barR.x, y: barR.y, w: barR.w, h: barR.h } });
    }
    // No beat to point at (e.g. an empty voice 2): mark the whole bar.
    const mb = lookup.findMasterBarByIndex(c.measure);
    const sb = mb?.bars[c.part]?.visualBounds ?? mb?.visualBounds;
    setBox({ beat: null, bar: sb ? { x: sb.x, y: sb.y, w: sb.w, h: sb.h } : null });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await loadAlphaTab();
      if (cancelled || !host.current) return;
      at.current = lib;
      const a = new lib.AlphaTabApi(host.current, {
        core: { fontDirectory: `${ALPHATAB_BASE}/font/`, includeNoteBounds: true },
        display: { staveProfile: lib.StaveProfile.Default, scale: window.innerWidth < 640 ? 0.8 : 1 },
        player: {
          playerMode: lib.PlayerMode.EnabledSynthesizer,
          soundFont: `${ALPHATAB_BASE}/soundfont/sonivox.sf2`,
          enableCursor: true,
          enableUserInteraction: false,
          scrollMode: lib.ScrollMode.Off,
        },
      } as AlphaTabTypes.json.SettingsJson);
      handle.current.api = a;
      a.metronomeVolume = 0;
      a.countInVolume = 0;
      a.playerReady.on(() => {
        handle.current.playerReady = true;
        onPlayerRef.current({ ready: true, playing: false });
      });
      a.playerStateChanged.on((e) => onPlayerRef.current({ ready: true, playing: e.state === lib.synth.PlayerState.Playing }));
      // The bounds lookup is complete only after every renderFinished handler ran.
      a.postRenderFinished.on(() => {
        setReady(true);
        place();
      });
      setReady(false);
      draw();
    })();
    return () => {
      cancelled = true;
      handle.current.api?.destroy();
      handle.current.api = null;
      handle.current.score = null;
      handle.current.playerReady = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = () => {
    const a = handle.current.api;
    const lib = at.current;
    if (!a || !lib) return;
    try {
      const xml = docToMusicXml(docRef.current, { title });
      const score = lib.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml), a.settings);
      prepareScore(score, showTab);
      handle.current.score = score;
      setError(null);
      a.renderScore(score, score.tracks.map((tr) => tr.index));
    } catch (e) {
      console.error("[score-editor]", e);
      setError(e instanceof ScoreError ? e.message : t("The notation could not be drawn."));
    }
  };

  // Redraw shortly after the last change (typing several notes quickly redraws once).
  useEffect(() => {
    const id = setTimeout(draw, 60);
    return () => clearTimeout(id);
  }, [doc, title, showTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(place, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const click = (e: React.MouseEvent) => {
    const a = handle.current.api;
    const lookup = a?.renderer.boundsLookup;
    if (!host.current || !lookup) return;
    const r = host.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const beat = lookup.getBeatAtPos(x, y);
    if (!beat) return;
    const voice = beat.voice.index;
    if (voice > 1) return;
    const note = lookup.getNoteAtPos(beat, x, y);
    const c: Cursor = { part: beat.voice.bar.staff.track.index, voice: voice as 0 | 1, measure: beat.voice.bar.index, index: beat.index };
    // alphaTab counts strings from the lowest (1 = low E); ours count from the highest (1 = high E).
    onSelectRef.current(c, note ? 7 - note.string : null);
  };

  return (
    // The notation is drawn black on white, also in the dark theme (like paper).
    <div className="relative min-h-48 overflow-x-auto rounded-xl border bg-white p-1 text-black">
      <div className="relative">
        <div ref={host} onClick={click} className="cursor-pointer" />
        {box.bar && (
          <div
            className="pointer-events-none absolute rounded-sm bg-sky-500/5 ring-1 ring-sky-500/30"
            style={{ left: box.bar.x, top: box.bar.y, width: box.bar.w, height: box.bar.h }}
          />
        )}
        {box.beat && (
          <div
            className="pointer-events-none absolute rounded-sm bg-sky-500/20 ring-2 ring-sky-600"
            style={{ left: box.beat.x, top: box.beat.y, width: box.beat.w, height: box.beat.h }}
          />
        )}
      </div>
      {(!ready || error) && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-neutral-500">
          {error ?? <LoaderCircle className="size-6 animate-spin" />}
        </div>
      )}
    </div>
  );
}
