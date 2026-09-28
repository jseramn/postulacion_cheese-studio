"use client";

import { AsciiObject } from "@/components/canvasui/AsciiObject";

/** Dense printable ramp so small cells still resolve volume. */
const DENSE_CHARSET =
  " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

const BUST_INK = "#ffffff";

export function JoseAsciiBust() {
  return (
    <div className="h-full w-full">
      <AsciiObject
        className="h-full w-full"
        src="/jose-portrait.png"
        ascii
        cellSize={3}
        cellAspect={0.42}
        charset={DENSE_CHARSET}
        colored={false}
        color={BUST_INK}
        contrast={2.6}
        edgeContrast={3.4}
        exposure={2.1}
        invert={false}
        background=""
        highlight={BUST_INK}
        environmentIntensity={1.35}
        roughness={0.55}
        scale={2.78}
        xOffset={0}
        yOffset={0.04}
        floatIntensity={0.8}
        rotationIntensity={0.7}
        floatSpeed={0.95}
        orbit
        zoom={false}
        autoRotate={false}
        fov={52}
        cameraDistance={4.8}
      />
    </div>
  );
}
