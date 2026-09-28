import type { AsciiSweepOptions } from "@/components/canvasui/AsciiSweep";
import { FIRE_SPARK } from "@/lib/firePalette";

/**
 * AsciiSweep over gait swaps. Official Canvas UI demo uses duration 2s for
 * tab-sized panels (https://canvasui.dev/docs/components/ascii-sweep).
 * This walk clock swaps clips around STRIDE_PX (3px) / FRAME_MS (55ms),
 * so a 2s band would stack over many poses. Ember ink + 5px glyphs (scale 1)
 * on the 178×155 sprite; duration/band stay short so the trail does not stack.
 */
export const MOUSE_ASCII_SWEEP = {
  band: 0.42,
  softness: 0.9,
  turbulence: 1.15,
  trail: 1.2,
  scale: 1,
  spacing: 0,
  tint: 1,
  glow: 2,
  aberration: 5,
  flicker: 0.28,
  density: 1,
  displace: 4,
  contrast: 1.2,
  brightness: 0,
  invert: 0,
  threshold: 0.04,
  fade: 1,
  charset: "ascii",
  blend: "over",
  color: FIRE_SPARK,
  /** Transparent capture so glyphs follow PNG alpha, not a filled panel. */
  background: "transparent",
  duration: 0.5,
} satisfies AsciiSweepOptions;
