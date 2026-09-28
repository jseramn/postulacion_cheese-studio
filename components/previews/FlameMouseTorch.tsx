"use client";

import type { ReactNode } from "react";

import { FlameWrap } from "@/components/canvasui/FlameWrap";
import { BLAZE_FLAME_COLOR, FLAME_X_RADIUS } from "./flameXLetter";

/** Same cling recipe as the X torch, shortened so it outlines the sprite. */
export function FlameMouseTorch({ children }: { children: ReactNode }) {
  return (
    <FlameWrap
      className="h-full w-full overflow-visible"
      color={BLAZE_FLAME_COLOR}
      height={230}
      spread={2.15}
      intensity={4}
      radius={FLAME_X_RADIUS * 0.25}
      rim={4.6}
      sparks={2.1}
      sparkDensity={0.55}
      sparkSize={0.45}
      sparkSpeed={3.9}
      ember={0.85}
      smoke={0.5}
      melt={1.4}
      distortion={8}
      turbulence={1.1}
      turbulenceScale={0.95}
      speed={0.25}
    >
      {children}
    </FlameWrap>
  );
}
