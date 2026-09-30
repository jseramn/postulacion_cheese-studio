import type { EdgeRail, Point } from "./pattern";
import { EDGE_RAIL } from "./pattern";

/** Mask reveal anchor (trail tip). Keep paint() on this value. */
export const DRAW_ANCHOR = 0.8;
/**
 * Mouse rail-clock fraction of the viewport (scrollY + anchor·vh).
 * Was 0.5 (mid-right at load). 0.08 = top-left entry; behind DRAW_ANCHOR 0.8.
 */
export const MOUSE_ANCHOR = 0.08;

/**
 * Path-length along the rail from page scroll.
 * Shared by mask dash (DRAW_ANCHOR) and mouse (MOUSE_ANCHOR).
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

/**
 * Keep CSS bank angle from putting the sprite head screen-down.
 * Same idea as ScrollLab: when cos(θ) is badly negative, add 180° (no scaleY).
 */
export function uprightAngle(deg: number): number {
  const rad = (deg * Math.PI) / 180;
  // Keep lateral/bend banks (±90-ish); only un-invert near screen-up/down.
  if (Math.abs(Math.sin(rad)) > 0.55) return deg;
  if (Math.cos(rad) >= -0.05) return deg;
  return deg + 180;
}

/**
 * Soft screen-containment nudge budget (px). Larger overflowFix deltas
 * glue the mouse to bezels and break rail composition — skip those.
 * Composition > clamp (brief off-screen on flats OK).
 */
export const MAX_SOFT_NUDGE = 40;

/** Translate delta so a screen AABB sits inside the inset frame. */
export function overflowFix(
  box: { left: number; top: number; right: number; bottom: number },
  vw: number,
  vh: number,
  inset: number,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  // ceil so subpixel tops like 7.2 still clear an integer inset of 8
  if (box.left < inset) x += Math.ceil(inset - box.left);
  if (box.right > vw - inset) x -= Math.ceil(box.right - (vw - inset));
  if (box.top < inset) y += Math.ceil(inset - box.top);
  if (box.bottom > vh - inset) y -= Math.ceil(box.bottom - (vh - inset));
  return { x, y };
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
