"use client";

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MutableRefObject,
  type RefObject,
} from "react";

import { MouseSprite, pathFootStyle } from "@/components/mouse/sprite/MouseSprite";
import { poseFrames } from "@/components/mouse/sprite/clips";
import { createRestPointerDriver } from "@/components/mouse/sprite/restPointer";
import {
  createScrollPoseState,
  driveScrollPose,
} from "@/components/mouse/sprite/scrollPose";
import type { MouseSpriteHandle } from "@/components/mouse/sprite/MouseSprite";

import {
  MOUSE_ANCHOR,
  alongAt,
  restMotifTargets,
} from "./rail-clock";
import {
  EDGE_PATTERN,
  buildInfinitePath,
  type Pattern,
} from "./pattern";

/**
 * Matches InfiniteTextTrail textPath dy="-6": glyphs shift this many user
 * units toward glyphUp (screen: (ty, -tx) for tangent (tx,ty), y-down).
 */
const TEXTPATH_DY = 6;
/** Cap height as a fraction of CSS fontSize (visual ink, not em-box). */
const CAP_RATIO = 0.40;
/** Clearance between the visual sole and the nearest ink edge (px). */
const FOOT_GAP = 2;
/**
 * Opaque sprite past the pathFootStyle pivot toward local +Y (= −n after
 * rotate). Pivot is shifted along +n by this so the sole, not the origin,
 * meets the ink edge.
 */
const SOLE_EXTENT = 6;
/** Path sample half-width for tangent (user units). */
const TANGENT_EPS = 2;
/** Hysteresis band for normal blend score near zero. */
const NORMAL_HYST = 0.08;
const SCROLL_DIR_EPS = 0.5;

/** Dark silhouette so the light sprite reads on white (~text #1A1A1A). */
export const DEFAULT_MOUSE_TINT =
  "brightness(0) saturate(100%) opacity(0.9)";

export type GatePaintState = {
  sitting: boolean;
  /** 0..1 rest-meter fill while pinned. */
  meter: number;
};

export type TrailMouseProps = {
  svgRef: RefObject<SVGSVGElement | null>;
  pattern?: Pattern;
  fontSize: number;
  /** Imperative gate snapshot from InfiniteTextTrail (no React render). */
  gateRef: MutableRefObject<GatePaintState>;
  /** Tile count so rest along list stays covered. */
  tiles: number;
  /**
   * CSS filter on the TrailMouse wrap only (not MouseSprite).
   * Default darkens the light frames for a white page.
   */
  mouseTint?: string;
};

function alongNearest(path: SVGPathElement, target: { x: number; y: number }): number {
  const total = path.getTotalLength();
  if (total <= 0) return 0;
  const samples = 500;
  let bestU = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= samples; i++) {
    const u = (i / samples) * total;
    const p = path.getPointAtLength(u);
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestD) {
      bestD = d;
      bestU = u;
    }
  }
  const refine = Math.max(total / samples, 0.5);
  const lo = Math.max(0, bestU - refine);
  const hi = Math.min(total, bestU + refine);
  const fine = 40;
  for (let i = 0; i <= fine; i++) {
    const u = lo + ((hi - lo) * i) / fine;
    const p = path.getPointAtLength(u);
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestD) {
      bestD = d;
      bestU = u;
    }
  }
  return bestU;
}

export function TrailMouse({
  svgRef,
  pattern = EDGE_PATTERN,
  fontSize,
  gateRef,
  tiles,
  mouseTint = DEFAULT_MOUSE_TINT,
}: TrailMouseProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);
  const samplePathRef = useRef<SVGPathElement>(null);
  const tilesRef = useRef(tiles);

  const sampleD = buildInfinitePath(pattern, 1);
  const foot = pathFootStyle();
  const wrapStyle: CSSProperties = {
    ...foot,
    ...(mouseTint ? { filter: mouseTint } : null),
  };

  useLayoutEffect(() => {
    tilesRef.current = tiles;
  });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const hop = hopRef.current;
    const samplePath = samplePathRef.current;
    const sprite = spriteRef.current;
    if (!wrap || !hop || !samplePath || !sprite) return;

    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reduceMq.matches;
    const onReduce = () => {
      reduce = reduceMq.matches;
    };
    reduceMq.addEventListener("change", onReduce);

    const poseState = createScrollPoseState();
    const restPointer = createRestPointerDriver(sprite);
    const targets = restMotifTargets();
    let baseAlongs = targets.map((t) => alongNearest(samplePath, t));
    baseAlongs.sort((a, b) => a - b);

    let lastX = 0;
    let lastY = 0;
    let lastAlong = Number.NaN;
    let lastDir = 1;
    let lastScrollY = window.scrollY;
    let lastClearSign: number | null = null;
    let wasSitting = false;
    let rafId: number | null = null;

    const sitBox = () => hop.getBoundingClientRect();

    const enterSit = () => {
      if (wasSitting) return;
      wasSitting = true;
      // Stop stride timer so setFrame(sit) is not overwritten by walk frames.
      sprite.setStride({ moving: false, hold: poseState.hold });
      sprite.setFrame(poseFrames.sit);
      restPointer.setSitting(true, sitBox());
    };

    const leaveSit = () => {
      if (!wasSitting) return;
      wasSitting = false;
      restPointer.setSitting(false);
    };

    const onPointerMove = (event: PointerEvent) => {
      restPointer.onPointerMove(event, sitBox());
    };
    const onPointerDown = (event: PointerEvent) => {
      restPointer.onPointerDown(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      restPointer.onPointerUp(event, hop, reduce);
    };

    window.addEventListener("pointermove", onPointerMove);
    hop.addEventListener("pointerdown", onPointerDown);
    hop.addEventListener("pointerup", onPointerUp);

    const paint = () => {
      const svg = svgRef.current;
      if (!svg || !samplePath) return;

      const tileLen = samplePath.getTotalLength();
      if (tileLen <= 0) return;

      const t = pattern.tiling;
      const cw = svg.clientWidth || t.width;
      const scale = cw / t.width;
      const pitchPx = t.pitch * scale;
      if (pitchPx <= 0 || scale <= 0) return;

      const scrollY = window.scrollY;
      const vh = window.innerHeight || 1;
      const scrollDelta = scrollY - lastScrollY;
      if (Math.abs(scrollDelta) > SCROLL_DIR_EPS) {
        lastDir = scrollDelta > 0 ? 1 : -1;
      }
      lastScrollY = scrollY;

      const mouseAlong = alongAt(
        scrollY,
        vh,
        MOUSE_ANCHOR,
        tileLen,
        pitchPx,
      );

      if (baseAlongs.length !== targets.length) {
        baseAlongs = targets.map((pt) => alongNearest(samplePath, pt));
        baseAlongs.sort((a, b) => a - b);
      }

      const tileIndex = Math.floor(mouseAlong / tileLen);
      let local = mouseAlong - tileIndex * tileLen;
      if (local < 0) local = 0;
      if (local > tileLen) local = tileLen;

      const p = samplePath.getPointAtLength(local);
      const xSvg = p.x;
      const ySvg = p.y + tileIndex * t.pitch;
      const x = xSvg * scale;
      const y = ySvg * scale;

      const a0 = Math.max(0, local - TANGENT_EPS);
      const a1 = Math.min(tileLen, local + TANGENT_EPS);
      const p0 = samplePath.getPointAtLength(a0);
      const p1 = samplePath.getPointAtLength(a1);
      let tx = p1.x - p0.x;
      let ty = p1.y - p0.y;
      const tLen = Math.hypot(tx, ty) || 1;
      tx /= tLen;
      ty /= tLen;

      // SVG textPath glyph-up (y-down): rotate tangent CW 90° → (ty, -tx).
      // Right-down → east; L→R cross → up; R→L cross → down.
      const gux = ty;
      const guy = -tx;

      // Body normal n: toward page center on columns, screen-up on crossings.
      const midX = t.width / 2;
      let cx = midX - xSvg;
      let cy = 0;
      const cLen = Math.hypot(cx, cy) || 1;
      cx /= cLen;
      cy /= cLen;
      const nRightX = -ty;
      const nRightY = tx;
      const towardCenter =
        nRightX * cx + nRightY * cy >= 0
          ? { x: nRightX, y: nRightY }
          : { x: -nRightX, y: -nRightY };
      const towardUp =
        -nRightY >= 0
          ? { x: nRightX, y: nRightY }
          : { x: -nRightX, y: -nRightY };

      const absTx = Math.abs(tx);
      const absTy = Math.abs(ty);
      const verticalness =
        absTx + absTy > 0 ? absTy / (absTx + absTy) : 0;
      let nx =
        verticalness * towardCenter.x + (1 - verticalness) * towardUp.x;
      let ny =
        verticalness * towardCenter.y + (1 - verticalness) * towardUp.y;
      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;

      const sideDot = nx * nRightX + ny * nRightY;
      if (Math.abs(sideDot) < NORMAL_HYST && lastClearSign != null) {
        nx = lastClearSign * nRightX;
        ny = lastClearSign * nRightY;
      } else {
        lastClearSign = sideDot >= 0 ? 1 : -1;
      }

      // Ink band along glyphUp from path: [dy, dy+cap]*scale.
      // Sole (pivot − n·SOLE_EXTENT) sits on the ink edge; body extends along +n.
      const inkFar = (TEXTPATH_DY + CAP_RATIO * fontSize) * scale;
      const onGlyphFace = nx * gux + ny * guy > 0;
      const alongN = onGlyphFace
        ? inkFar + FOOT_GAP + SOLE_EXTENT
        : FOOT_GAP + SOLE_EXTENT;
      const ox = nx * alongN;
      const oy = ny * alongN;

      // Local -Y (sprite head) → n. Facing is scaleX only (MouseSprite).
      const rotateDeg = (Math.atan2(nx, -ny) * 180) / Math.PI;
      const travelX = tx * lastDir;
      const travelY = ty * lastDir;
      const localX = -ny;
      const localY = nx;
      const faceDot = travelX * localX + travelY * localY;
      const facing: "left" | "right" = faceDot >= 0 ? "right" : "left";

      wrap.style.transform = `translate(${x + ox}px, ${y + oy}px) rotate(${rotateDeg}deg)`;

      const gate = gateRef.current;
      const sitting = gate.sitting;

      if (sitting) {
        enterSit();
        lastAlong = mouseAlong;
        lastX = x;
        lastY = y;
        return;
      }

      leaveSit();

      const dx = x - lastX;
      const dyCss = y - lastY;
      const dist = Number.isFinite(lastAlong)
        ? Math.hypot(dx, dyCss)
        : 0;
      const deltaAlong = Number.isFinite(lastAlong)
        ? mouseAlong - lastAlong
        : 0;
      lastAlong = mouseAlong;
      lastX = x;
      lastY = y;

      const moving =
        Math.abs(scrollDelta) > SCROLL_DIR_EPS || Math.abs(deltaAlong) >= 0.4;

      driveScrollPose({
        sprite,
        dx,
        dy: dyCss,
        dist: moving ? Math.min(dist, 48) : 0,
        dtMs: 16,
        moving,
        progressDelta: lastDir,
        state: poseState,
      });
      poseState.facing = facing;
      sprite.setFacing(facing);
    };

    const loop = () => {
      paint();
      rafId = requestAnimationFrame(loop);
    };
    paint();
    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      hop.removeEventListener("pointerdown", onPointerDown);
      hop.removeEventListener("pointerup", onPointerUp);
      reduceMq.removeEventListener("change", onReduce);
      restPointer.dispose();
    };
  }, [svgRef, pattern, fontSize, gateRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      <svg
        aria-hidden
        width={0}
        height={0}
        style={{ position: "absolute", overflow: "hidden" }}
      >
        <path ref={samplePathRef} d={sampleD} fill="none" />
      </svg>
      <div
        ref={wrapRef}
        className="absolute top-0 left-0 will-change-transform"
        style={wrapStyle}
      >
        <div
          ref={hopRef}
          className="pointer-events-auto h-full w-full cursor-pointer will-change-transform"
        >
          <MouseSprite ref={spriteRef} />
        </div>
      </div>
    </div>
  );
}
