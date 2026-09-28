import { CHEESES, REST_WINDOW, restSide, type Cheese } from "./cheeses";
import {
  MODULE_PATH,
  SCROLL_COPY,
  type PathState,
} from "./pathCopy";

export type MouseMode =
  | { kind: "walk"; t: number }
  | { kind: "rest"; t: number; index: number };

export type ScrollLab = {
  copy: string;
  path: PathState;
  cheeses: readonly Cheese[];
  progress: number;
  mouse: MouseMode;
};

/**
 * PathWalk maps one full path to min-h-[1400vh].
 * This lab is 2× heavier: one vertical winding module is 2800vh of scroll.
 */
export const TRACK_VH_PER_MODULE = 2800;

/**
 * Paw start is the first visible letters of the opening wave (~78vh).
 * Tiny epsilon so getPointAtLength is well-defined; the mouse sits on-rail at t≈0.
 */
export const START_T = 0.002;

/** Revealed stroke runs this many times farther along the rail than the mouse. */
export const REVEAL_LEAD = 2.5;

/** Floor in module units so the opening wave exists at progress 0 (START_T≈0). */
const OPENING_REVEAL_T = 0.05;

export function progressFromScroll(scrollTop: number, modulePx: number): number {
  if (modulePx <= 0) return 0;
  return Math.max(0, scrollTop / modulePx);
}

/** Nearest cheese whose rest window still contains progress. No sticky latch. */
export function restIndexFromProgress(
  progress: number,
  cheeses: readonly Cheese[] = CHEESES,
  window = REST_WINDOW,
): number | null {
  let index: number | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cheeses.length; i++) {
    const dist = Math.abs(progress - cheeses[i].t);
    if (dist <= window && dist < best) {
      index = i;
      best = dist;
    }
  }
  return index;
}

/**
 * Sit only when the 50vh walk pin is within `maxGap` rail units of a cheese.
 * Does not teleport: a progress hint alone is not enough.
 */
export function restIndexFromAlong(
  pinAlong: number,
  cheeseAlongs: readonly number[],
  maxGap: number,
): number | null {
  let index: number | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cheeseAlongs.length; i++) {
    const gap = Math.abs(pinAlong - cheeseAlongs[i]);
    if (gap <= maxGap && gap < best) {
      index = i;
      best = gap;
    }
  }
  return index;
}

function nearestCheeseIndex(
  progress: number,
  cheeses: readonly Cheese[],
): number {
  let index = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cheeses.length; i++) {
    const dist = Math.abs(progress - cheeses[i].t);
    if (dist < best) {
      index = i;
      best = dist;
    }
  }
  return index;
}

export function mouseFromProgress(
  progress: number,
  cheeseT: number,
  reduceMotion: boolean,
  cheeses: readonly Cheese[] = CHEESES,
): MouseMode {
  const hit = restIndexFromProgress(progress, cheeses);
  if (hit != null) {
    return { kind: "rest", t: cheeses[hit].t, index: hit };
  }
  if (reduceMotion) {
    const index = nearestCheeseIndex(progress, cheeses);
    return { kind: "rest", t: cheeses[index]?.t ?? cheeseT, index };
  }
  return { kind: "walk", t: progress };
}

export function railMouseT(progress: number): number {
  return START_T + Math.max(0, progress);
}

/** Module-0 cheese, in path-length units of the current tiled string. */
export function cheeseDistance(
  cheeseT: number,
  modules: number,
  totalLength: number,
): number {
  if (modules <= 0 || totalLength <= 0) return 0;
  return cheeseT * (totalLength / modules);
}

export function revealAmount(progress: number, modules: number): number {
  if (modules <= 0) return 0;
  const t = Math.max(railMouseT(progress), OPENING_REVEAL_T);
  return Math.max(0, Math.min(1, (t * REVEAL_LEAD) / modules));
}

export function mousePathAmount(mouse: MouseMode, modules: number): number {
  if (modules <= 0) return 0;
  return Math.max(0, Math.min(1, railMouseT(mouse.t) / modules));
}

export function scrollLabAt(
  progress: number,
  reduceMotion: boolean,
): Pick<ScrollLab, "copy" | "path" | "cheeses" | "progress" | "mouse"> {
  const cheeseT = CHEESES[0]?.t ?? 0;
  return {
    copy: SCROLL_COPY,
    path: MODULE_PATH,
    cheeses: CHEESES,
    progress,
    mouse: mouseFromProgress(progress, cheeseT, reduceMotion),
  };
}

export { restSide };
