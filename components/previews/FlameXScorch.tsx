"use client";

import { FlameWrap } from "@/components/canvasui/FlameWrap";

import { BLAZE_FLAME_COLOR, FLAME_X_RADIUS, FlameXLetter } from "./flameXLetter";

export function FlameXScorch() {
  return (
    <FlameWrap
      color={BLAZE_FLAME_COLOR}
      height={64}
      spread={9}
      intensity={0.85}
      radius={FLAME_X_RADIUS}
      scorch={1.6}
      melt={8}
      speed={0.12}
      turbulence={0.85}
      turbulenceScale={1.2}
      turbulenceReach={32}
      distortion={12}
      sparks={0.8}
      ember={1.6}
      smoke={0.8}
      rim={2}
    >
      <FlameXLetter className="text-white" />
    </FlameWrap>
  );
}
