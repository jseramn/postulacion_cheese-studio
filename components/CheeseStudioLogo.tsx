"use client";

import { GlassObject } from "@/components/canvasui/GlassObject";

export function CheeseStudioLogo() {
  return (
    <GlassObject
      className="h-full w-full"
      src="/cheese-studio-logo.png"
      ior={1.49}
      thickness={2.2}
      roughness={0.04}
      dispersion={0.35}
      clearcoat={1}
      tint=""
      tintDensity={2}
      depth={0.08}
      bevel={0.22}
      highlight="#ff6a18"
      environmentIntensity={1.75}
      background=""
      backgroundImage="/background.jpg"
      scale={3}
      xOffset={0}
      yOffset={0}
      floatIntensity={1.05}
      rotationIntensity={0.85}
      floatSpeed={1.15}
      orbit
      zoom={false}
      autoRotate={false}
      fov={55}
      cameraDistance={4}
    />
  );
}
