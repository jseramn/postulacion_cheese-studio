export type Cheese = { t: number };

/**
 * Rest waypoints in module-progress units.
 * Dots sit on the winding rail: first RIGHT, then LEFT (then the tiled snake).
 * Place each dot so it crosses ~50vh on the walk rail when progress ~= cheese.t.
 * The mouse stays on the 50vh pin; it sits when that pin along matches the dot.
 */
export const CHEESES: readonly Cheese[] = [{ t: 0.34 }, { t: 0.84 }];

/**
 * Sit when the 50vh walk-pin along is within this rail gap of a cheese along.
 * One letter height in SVG user units (ScrollLab LETTER_SIZE), not a progress band.
 */
export const REST_ALONG_GAP = 34;

/** Legacy progress band for mouseFromProgress. Lab rest is spatial (REST_ALONG_GAP). */
export const REST_WINDOW = 0.04;

export function restSide(index: number): "left" | "right" {
  return index % 2 === 0 ? "right" : "left";
}
