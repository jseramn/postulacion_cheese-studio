"use client";

import { useId, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export const BLAZE_FLAME_COLOR: [number, number, number] = [1, 0.4, 0.051];
/** FlameWrap outline is a rounded rect (uRect). Keep near 0 so it hugs the glyph, not a tile. */
export const FLAME_X_RADIUS = 0;

export function FlameXLetter({
  className,
  style,
  fill = "currentColor",
}: {
  className?: string;
  style?: CSSProperties;
  /** SVG paint. `"torch"` is the white→orange display gradient. */
  fill?: string;
}) {
  const gradId = `flame-x-torch-${useId().replace(/:/g, "")}`;
  const paint = fill === "torch" ? `url(#${gradId})` : fill;

  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className={cn(
        "block h-12 w-12 overflow-visible md:h-[4.5rem] md:w-[4.5rem]",
        className,
      )}
      style={style}
    >
      {fill === "torch" ? (
        <defs>
          <linearGradient
            id={gradId}
            x1="32"
            y1="4"
            x2="32"
            y2="60"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="8%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="rgb(255, 102, 13)" />
          </linearGradient>
        </defs>
      ) : null}
      <g
        fill="none"
        stroke={paint}
        strokeWidth="13"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <line x1="12" y1="12" x2="52" y2="52" />
        <line x1="52" y1="12" x2="12" y2="52" />
      </g>
    </svg>
  );
}
