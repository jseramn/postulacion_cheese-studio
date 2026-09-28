"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

const FUR = "#ffffff";
const INK = "#12151c";

export type CheeseMouseParts = {
  svg: SVGSVGElement | null;
  root: SVGGElement | null;
  body: SVGGElement | null;
  frontLeg: SVGGElement | null;
  backLeg: SVGGElement | null;
  tail: SVGGElement | null;
  ears: SVGGElement | null;
  eye: SVGGElement | null;
};

type CheeseMouseRigProps = {
  className?: string;
  title?: string;
};

const hipOrigin = {
  transformBox: "fill-box" as const,
  transformOrigin: "50% 8%",
};

const earOrigin = {
  transformBox: "fill-box" as const,
  transformOrigin: "50% 100%",
};

const tailOrigin = {
  transformBox: "fill-box" as const,
  transformOrigin: "100% 38%",
};

const bodyOrigin = {
  transformBox: "fill-box" as const,
  transformOrigin: "50% 55%",
};

export const CheeseMouseRig = forwardRef<CheeseMouseParts, CheeseMouseRigProps>(
  function CheeseMouseRig(
    { className, title = "Ratón de perfil" },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement>(null);
    const rootRef = useRef<SVGGElement>(null);
    const bodyRef = useRef<SVGGElement>(null);
    const frontLegRef = useRef<SVGGElement>(null);
    const backLegRef = useRef<SVGGElement>(null);
    const tailRef = useRef<SVGGElement>(null);
    const earsRef = useRef<SVGGElement>(null);
    const eyeRef = useRef<SVGGElement>(null);

    useImperativeHandle(ref, () => ({
      svg: svgRef.current,
      root: rootRef.current,
      body: bodyRef.current,
      frontLeg: frontLegRef.current,
      backLeg: backLegRef.current,
      tail: tailRef.current,
      ears: earsRef.current,
      eye: eyeRef.current,
    }));

    return (
      <svg
        ref={svgRef}
        viewBox="0 0 220 150"
        className={cn("overflow-visible", className)}
        overflow="visible"
        role="img"
        aria-labelledby="cheese-mouse-title"
      >
        <title id="cheese-mouse-title">{title}</title>
        <g ref={rootRef} data-mouse-part="root">
          <g ref={tailRef} data-mouse-part="tail" style={tailOrigin}>
            <path
              d="M76 88 C 50 104, 26 106, 10 90 C 6 82, 14 76, 24 80"
              fill="none"
              stroke={FUR}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          <g ref={backLegRef} data-mouse-part="backLeg" style={hipOrigin}>
            <path
              d="M76 106 C 74 116, 73 122, 78 124 C 83 125, 85 118, 82 106 Z"
              fill={FUR}
            />
            <ellipse cx="78" cy="125" rx="6.2" ry="2.8" fill={FUR} />
            <path
              d="M86 104 C 83 116, 82 124, 88 126 C 95 127, 97 118, 93 104 Z"
              fill={FUR}
            />
            <ellipse cx="89" cy="126.5" rx="7.6" ry="3.3" fill={FUR} />
          </g>

          <g ref={bodyRef} data-mouse-part="body" style={bodyOrigin}>
            <path
              d="M64 88 C 62 74, 78 68, 102 70 C 120 72, 134 76, 142 84 C 148 92, 144 106, 126 110 C 106 116, 78 116, 66 104 C 58 96, 58 90, 64 88 Z"
              fill={FUR}
            />
            <circle cx="148" cy="78" r="18" fill={FUR} />
            <path d="M164 70 L 180 76 L 164 82 Z" fill={FUR} />

            <g ref={earsRef} data-mouse-part="ears" style={earOrigin}>
              <circle cx="137" cy="62" r="6.2" fill={FUR} />
              <circle cx="154" cy="60" r="6.5" fill={FUR} />
            </g>

            <g ref={eyeRef} data-mouse-part="eye">
              <circle cx="158" cy="74" r="3.3" fill={INK} />
              <circle cx="159.2" cy="72.9" r="1" fill={FUR} />
            </g>
            <path d="M178 74 L 183 76 L 178 78 Z" fill={INK} />
          </g>

          <g ref={frontLegRef} data-mouse-part="frontLeg" style={hipOrigin}>
            <path
              d="M118 106 C 116 116, 115 122, 120 124 C 125 125, 127 118, 124 106 Z"
              fill={FUR}
            />
            <ellipse cx="121" cy="125" rx="6" ry="2.7" fill={FUR} />
            <path
              d="M128 104 C 125 116, 124 124, 130 126 C 137 127, 139 118, 135 104 Z"
              fill={FUR}
            />
            <ellipse cx="132" cy="126.5" rx="7.4" ry="3.2" fill={FUR} />
          </g>
        </g>
      </svg>
    );
  },
);
