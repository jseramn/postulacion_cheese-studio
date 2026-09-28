"use client";

import { FlameWrap } from "@/components/canvasui/FlameWrap";

import { BLAZE_FLAME_COLOR, FLAME_X_RADIUS, FlameXLetter } from "./flameXLetter";

export function FlameXEmber() {
  return (
    <FlameWrap
      color={BLAZE_FLAME_COLOR}
      height={48}
      spread={8}
      intensity={0.7}
      radius={FLAME_X_RADIUS}
      rim={2.8}
      sparks={0.25}
      sparkDensity={0.4}
      sparkSize={0.3}
      melt={1.2}
      distortion={2}
      smoke={0.25}
      ember={1.1}
      scorch={0}
      turbulence={0.28}
      speed={0.22}
    >
      <FlameXLetter className="text-white" />
    </FlameWrap>
  );
}
