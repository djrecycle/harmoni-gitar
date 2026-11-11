import type * as AlphaTabTypes from "@coderline/alphatab";

/*
 * alphaTab is not bundled: it is loaded at runtime from public/alphatab/ (copied there by scripts/copy-alphatab.mjs)
 * so its worker, audio worklet, music font and sound font sit next to it.
 * The "♪ alphaTab.net" mark in the rendered score is required by alphaTab's licence and must stay visible.
 */
export type AlphaTab = typeof AlphaTabTypes;
export type Api = AlphaTabTypes.AlphaTabApi;
export type Score = AlphaTabTypes.model.Score;

export const ALPHATAB_BASE = "/alphatab";
let alphaTabPromise: Promise<AlphaTab> | null = null;
export function loadAlphaTab(): Promise<AlphaTab> {
  const url = `${ALPHATAB_BASE}/alphaTab.mjs`;
  alphaTabPromise ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<AlphaTab>;
  return alphaTabPromise;
}

/** Only one score plays at a time on a page: a player that starts tells the others to pause. */
export const PLAY_EVENT = "hg-score-play";

// alphaTab's Direction values (model.Direction): Fine = 0, JumpDaCapo = 5, JumpDaCapoAlFine = 8.
const DIR_FINE = 0;
const DIR_DA_CAPO = 5;
const DIR_DA_CAPO_AL_FINE = 8;

/** Prepare a loaded score: show notation + tab for every staff, and read "D.C." as "D.C. al Fine" when the piece has a Fine. */
export function prepareScore(score: Score, showTab: boolean) {
  for (const track of score.tracks)
    for (const staff of track.staves) {
      staff.showStandardNotation = true;
      staff.showTablature = showTab && staff.tuning.length > 0;
    }
  const hasFine = score.masterBars.some((mb) => mb.directions?.has(DIR_FINE as AlphaTabTypes.model.Direction));
  if (hasFine)
    for (const mb of score.masterBars)
      if (mb.directions?.has(DIR_DA_CAPO as AlphaTabTypes.model.Direction)) {
        mb.directions.delete(DIR_DA_CAPO as AlphaTabTypes.model.Direction);
        mb.directions.add(DIR_DA_CAPO_AL_FINE as AlphaTabTypes.model.Direction);
      }
}
