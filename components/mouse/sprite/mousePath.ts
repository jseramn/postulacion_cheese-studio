/** Shared SVG path: viewBox 800×360, clear climbs (up) and drops (down). */
export const MOUSE_PATH_VIEWBOX = "0 0 800 360";

export const MOUSE_PATH_D =
  "M56 250 C 130 250, 160 72, 248 72 S 330 72, 392 268 S 490 328, 572 96 S 668 36, 748 208";

export function pathPoint(path: SVGPathElement, progress: number): { x: number; y: number } {
  const len = path.getTotalLength();
  const p = path.getPointAtLength(Math.min(1, Math.max(0, progress)) * len);
  return { x: p.x, y: p.y };
}
