"use client";

import { FlameWrap } from "@/components/canvasui/FlameWrap";
import { BLAZE_FLAME_COLOR, FLAME_X_RADIUS, FlameXLetter } from "./flameXLetter";

export function FlameXTorch() {
  return (
    <FlameWrap
      className="w-fit overflow-visible"
      color={BLAZE_FLAME_COLOR}
      height={230}
      // Much less spread, flame extremely clingy to X, almost outlining it
      spread={2.15}
      // Intense, bright and lively flame pinned tightly to the X
      intensity={4.0}
      // Even tighter radius so the flame tightly hugs the shape
      radius={FLAME_X_RADIUS * 0.250}
      // Really tight rim for extremely accentuated flame edge
      rim={4.6}
      // Sparks energetic but rare, not distracting, staying close
      sparks={2.1}
      sparkDensity={0.55}
      // Tiny sparks
      sparkSize={0.45}
      sparkSpeed={3.9}
      // Very subtle ember diffusion, no halo
      ember={0.85}
      // Smoke barely visible, for crisp edge
      smoke={0.50}
      // Slight melt for edging, but less shimmer
      melt={1.4}
      // Slight distortion so the X burns fiercely but doesn't blur
      distortion={8}
      // Smaller scale, sharper turbulence
      turbulence={1.1}
      turbulenceScale={0.95}
      // Flicker quickly, as if licking at the X
      speed={0.25}
    >
      <FlameXLetter fill="#ffffff" />
    </FlameWrap>
  );
}
