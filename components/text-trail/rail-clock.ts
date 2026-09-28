import type { EdgeRail, Point } from "./pattern";
import { EDGE_RAIL } from "./pattern";

/** Mask reveal anchor (trail tip). Keep paint() on this value. */
export const DRAW_ANCHOR = 0.8;
/** Mouse sits on letters already revealed; center of the viewport. */
export const MOUSE_ANCHOR = 0.5;

/**
 * Path-length along the rail from page scroll.
 * Shared by mask dash (anchor 0.8) and mouse (anchor 0.5).
 */
export function alongAt(
  scrollY: number,
  vh: number,
  anchor: number,
  tileLen: number,
  pitchPx: number,
): number {
  if (pitchPx <= 0 || tileLen <= 0) return 0;
  return (tileLen * (scrollY + anchor * vh)) / pitchPx;
}

/** Inverse of alongAt: scrollY that places `along` at the given anchor. */
export function scrollYForAlong(
  along: number,
  vh: number,
  anchor: number,
  tileLen: number,
  pitchPx: number,
): number {
  if (pitchPx <= 0 || tileLen <= 0) return 0;
  return (along * pitchPx) / tileLen - anchor * vh;
}

/**
 * Motif-space rest targets: middle of each EDGE_RAIL column.
 * Right column (T+rad → M-rad), left column (M+tilt+rad → pitch).
 */
export function restMotifTargets(rail: EdgeRail = EDGE_RAIL): Point[] {
  const { left: L, right: R, radius: rad, topCrossY: T, midCrossY: M, tilt, pitch } =
    rail;
  const rightMidY = (T + rad + (M - rad)) / 2;
  const leftMidY = (M + tilt + rad + pitch) / 2;
  return [
    { x: R, y: rightMidY },
    { x: L, y: leftMidY },
  ];
}

/** Rest alongs inside tile `i`, given tile-0 base alongs. */
export function restAlongsInTile(
  baseAlongs: readonly number[],
  tileIndex: number,
  tileLen: number,
): number[] {
  return baseAlongs.map((a) => a + tileIndex * tileLen);
}

/** All rest alongs for tiles `[0, tileCount)`, ascending. */
export function listRestAlongs(
  baseAlongs: readonly number[],
  tileCount: number,
  tileLen: number,
): number[] {
  const out: number[] = [];
  const n = Math.max(0, Math.floor(tileCount));
  for (let i = 0; i < n; i++) {
    out.push(...restAlongsInTile(baseAlongs, i, tileLen));
  }
  return out;
}

/** ScrollY where the mouse (anchor 0.5) reaches a rest along. */
export function gateScrollY(
  along: number,
  vh: number,
  tileLen: number,
  pitchPx: number,
): number {
  return scrollYForAlong(along, vh, MOUSE_ANCHOR, tileLen, pitchPx);
}

/**
 * Next rest along strictly ahead of `mouseAlong` (down the path).
 * Returns null when none remain in the listed set.
 */
export function nextRestAlong(
  mouseAlong: number,
  rests: readonly number[],
  eps = 1e-3,
): number | null {
  for (const a of rests) {
    if (a > mouseAlong + eps) return a;
  }
  return null;
}
