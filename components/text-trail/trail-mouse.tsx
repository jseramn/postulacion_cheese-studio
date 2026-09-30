"use client";

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MutableRefObject,
  type RefObject,
} from "react";

import {
  MouseSprite,
  pathFootStyle,
} from "@/components/mouse/sprite/MouseSprite";
import { poseFrames } from "@/components/mouse/sprite/clips";
import { createRestPointerDriver } from "@/components/mouse/sprite/restPointer";
import {
  createScrollPoseState,
  driveScrollPose,
} from "@/components/mouse/sprite/scrollPose";
import type { MouseSpriteHandle } from "@/components/mouse/sprite/MouseSprite";

import {
  MOUSE_FOOT_PAD,
  MOUSE_FOOT_X,
  MOUSE_FRAME_SIZE,
} from "@/components/mouse/sprite/clips";
import { PATH_MOUSE_SIZE } from "@/components/mouse/sprite/MouseSprite";
import {
  MAX_SOFT_NUDGE,
  MOUSE_ANCHOR,
  alongAt,
  overflowFix,
  restMotifTargets,
  uprightAngle,
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
const CAP_RATIO = 0.48;
/**
 * Clearance past ink far edge (px). Keep tiny: pathFootStyle already
 * pivots on the paw. Large values float the sprite above glyphs.
 */
const FOOT_GAP = 1;
/**
 * Sidewalk on columns only (px along n). Prior 64→12 still read ~28px sole
 * gap; sole-on-ink target is ≈10–18px letter↔body.
 */
const COLUMN_PAD = 2;
/** AsciiSweep halo past sole toward the letter wall (px along n). */
const SWEEP_BLOOM = 0;
/**
 * Vertical blend above this: snap n to toward-center (column sidewalk).
 * ~0.55 keeps ±90 banks through the upper bend so down-travel still
 * reads as a column (0.72 flipped to screen-up too early → “looks up”).
 */
const VERTICAL_FACE = 0.55;
/** Extra sole lift — leave 0; pivot is already the paw contact. */
const SOLE_EXTENT = 0;
/** Keep wrap AABB inside the viewport by this margin (px). */
const SCREEN_INSET = 8;
/** Path sample half-width for tangent (user units). */
const TANGENT_EPS = 2;
/** Hysteresis band for normal blend score near zero. */
const NORMAL_HYST = 0.08;
const SCROLL_DIR_EPS = 0.5;

const FOOT_LOCAL_X =
  (MOUSE_FOOT_X * PATH_MOUSE_SIZE.width) / MOUSE_FRAME_SIZE.width;
const FOOT_LOCAL_Y =
  PATH_MOUSE_SIZE.height -
  (MOUSE_FOOT_PAD * PATH_MOUSE_SIZE.height) / MOUSE_FRAME_SIZE.height;

/** Screen AABB of the path-footed wrap after translate(foot)+rotate. */
function wrapAabbAtFoot(
  footSx: number,
  footSy: number,
  rotateDeg: number,
): { left: number; top: number; right: number; bottom: number } {
  const w = PATH_MOUSE_SIZE.width;
  const h = PATH_MOUSE_SIZE.height;
  const ox = FOOT_LOCAL_X;
  const oy = FOOT_LOCAL_Y;
  const rad = (rotateDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const locals = [
    { x: -ox, y: -oy },
    { x: w - ox, y: -oy },
    { x: -ox, y: h - oy },
    { x: w - ox, y: h - oy },
  ];
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const p of locals) {
    // CSS rotate (y-down): x' = x cos − y sin, y' = x sin + y cos.
    const x = footSx + p.x * c - p.y * s;
    const y = footSy + p.x * s + p.y * c;
    if (x < left) left = x;
    if (y < top) top = y;
    if (x > right) right = x;
    if (y > bottom) bottom = y;
  }
  return { left, top, right, bottom };
}

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
   * Optional CSS filter on the TrailMouse wrap only (not MouseSprite).
   * Omitted by default so lab AsciiSweep / ember colors stay visible.
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
  mouseTint,
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

      if (baseAlongs.length !== targets.length) {
        baseAlongs = targets.map((pt) => alongNearest(samplePath, pt));
        baseAlongs.sort((a, b) => a - b);
      }

      // Pure clock → path: along tracks scrollY; foot stays on the sample.
      const mouseAlong = alongAt(
        scrollY,
        vh,
        MOUSE_ANCHOR,
        tileLen,
        pitchPx,
      );
      const tileIndex = Math.floor(mouseAlong / tileLen);
      let local = mouseAlong - tileIndex * tileLen;
      if (local < 0) local = 0;
      if (local > tileLen) local = tileLen;

      const p = samplePath.getPointAtLength(local);
      const xSvg = p.x;

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
      // Flats: screen-up. Mid text path is L→R upright (buildInfiniteTextPath),
      // so ink sits above the rail; sample guy still points down on R→L walk.
      const towardScreenUp =
        -nRightY >= 0
          ? { x: nRightX, y: nRightY }
          : { x: -nRightX, y: -nRightY };

      const absTx = Math.abs(tx);
      const absTy = Math.abs(ty);
      const verticalness =
        absTx + absTy > 0 ? absTy / (absTx + absTy) : 0;
      // Columns: snap n to toward-center (letter-parallel ±90, feet→ink).
      // Flats + curves: screen-up only. Blending towardCenter on the
      // top-right quarter shoved the mouse into the L-hole (user-no A).
      let nx: number;
      let ny: number;
      if (verticalness > VERTICAL_FACE) {
        nx = towardCenter.x;
        ny = towardCenter.y;
      } else {
        nx = towardScreenUp.x;
        ny = towardScreenUp.y;
      }

      const sideDot = nx * nRightX + ny * nRightY;
      if (Math.abs(sideDot) < NORMAL_HYST && lastClearSign != null) {
        nx = lastClearSign * nRightX;
        ny = lastClearSign * nRightY;
      } else {
        lastClearSign = sideDot >= 0 ? 1 : -1;
      }

      // Ink band: columns use sample glyph-up; flats use screen-up (text L→R).
      const inkFar = (TEXTPATH_DY + CAP_RATIO * fontSize) * scale;
      const inkX = verticalness * gux + (1 - verticalness) * 0;
      const inkY = verticalness * guy + (1 - verticalness) * -1;
      const onGlyphFace = nx * inkX + ny * inkY > 0;
      const columnPad = verticalness * COLUMN_PAD;
      const bloom = verticalness * SWEEP_BLOOM;
      // Sidewalk only: never add inkFar on the center-side column face —
      // ink grows outward; feet stay beside the inner glyph edge.
      const alongN = onGlyphFace
        ? inkFar + FOOT_GAP + SOLE_EXTENT + columnPad + bloom
        : FOOT_GAP + SOLE_EXTENT + columnPad + bloom;

      // Local -Y (dorsal/ears) → clearance normal n (toward center on columns).
      // Columns: ±90 so spine is parallel to the rail, feet on the letter wall.
      // Upright: if dorsal would point screen-down (R→L mid), +180.
      const rotateDeg = uprightAngle((Math.atan2(nx, -ny) * 180) / Math.PI);
      const travelX = tx * lastDir;
      const travelY = ty * lastDir;
      const rad = (rotateDeg * Math.PI) / 180;
      const localX = Math.cos(rad);
      const localY = Math.sin(rad);
      const faceDot = travelX * localX + travelY * localY;
      /**
       * Nose leads travel everywhere (columns + bends). Former screen-up
       * column flip made “goes down / looks up” on the right rail.
       * Sit uses rotate(0) below and ignores this bank facing.
       */
      let facing: "left" | "right" = faceDot >= 0 ? "right" : "left";
      {
        const radV = (rotateDeg * Math.PI) / 180;
        const noseX =
          facing === "right" ? Math.cos(radV) : -Math.cos(radV);
        const noseY =
          facing === "right" ? Math.sin(radV) : -Math.sin(radV);
        if (travelX * noseX + travelY * noseY < -0.02) {
          facing = facing === "right" ? "left" : "right";
        }
      }

      const gate = gateRef.current;
      const sitting = gate.sitting;
      wrap.dataset.sitting = sitting ? "1" : "0";

      // Sit is rotate(0): banked alongN (column pad + sole along n) leaves a
      // float gap once the spine is upright. Recompute clearance for the
      // upright sole (local +Y = screen down) without column bloom.
      let placeNx = nx;
      let placeNy = ny;
      let placeAlong = alongN;
      let displayRotate = rotateDeg;
      if (sitting) {
        displayRotate = 0;
        placeAlong = onGlyphFace
          ? inkFar + FOOT_GAP + SOLE_EXTENT
          : FOOT_GAP + SOLE_EXTENT;
        if (verticalness > VERTICAL_FACE) {
          // Column sit: keep sidewalk side, drop vertical bank lift.
          placeNx = nx;
          placeNy = 0;
          const pLen = Math.abs(placeNx) || 1;
          placeNx /= pLen;
        } else {
          // Flat sit: stand on ink from screen-up.
          placeNx = 0;
          placeNy = -1;
        }
      }

      const ox = placeNx * placeAlong;
      const oy = placeNy * placeAlong;

      // Absolute-in-track from SVG origin: path sample + clearance along n.
      let trackX = p.x * scale + ox;
      let trackY = (p.y + tileIndex * t.pitch) * scale + oy;

      const mouseTransform = (x: number, y: number, rot: number) =>
        `translate(${x}px, ${y}px) rotate(${rot}deg)`;

      wrap.dataset.along = String(mouseAlong);
      wrap.dataset.tileLen = String(tileLen);
      wrap.dataset.pitchPx = String(pitchPx);
      wrap.dataset.bank = `${displayRotate.toFixed(2)},${placeNx.toFixed(3)},${placeNy.toFixed(3)},${facing}`;
      wrap.dataset.scaleY = "1";

      // Soft screen containment: toward-rail (−n) only, columns only.
      // On flats, top-clip → toward-rail is +Y and yanks the foot off the
      // glyphs (desplazamiento). Composition > clamp; brief off-screen OK.
      // Screen nudge ≠ along-clock pin. Never grow +n into the void.
      // AABB uses displayRotate so sit (0°) matches the upright pose.
      {
        const vw = window.innerWidth || 1;
        const svgRect = svg.getBoundingClientRect();
        const pathX = trackX;
        const pathY = trackY;
        wrap.style.transform = mouseTransform(pathX, pathY, displayRotate);
        void wrap.offsetWidth;
        let nudgeX = 0;
        let nudgeY = 0;
        let nudgeSkipped = "";
        if (verticalness > VERTICAL_FACE) {
          const measured = wrap.getBoundingClientRect();
          const analytic = wrapAabbAtFoot(
            svgRect.left + pathX,
            svgRect.top + pathY,
            displayRotate,
          );
          const aabb = {
            left: Math.min(analytic.left, measured.left),
            top: Math.min(analytic.top, measured.top),
            right: Math.max(analytic.right, measured.right),
            bottom: Math.max(analytic.bottom, measured.bottom),
          };
          // +6 absorbs gBCR/compositor shortfall observed on flats (~4–6px).
          const inset = SCREEN_INSET + 6;
          const fix = overflowFix(aabb, vw, vh, inset);
          const nDot = fix.x * placeNx + fix.y * placeNy;
          // Only the component that pulls toward the rail (−n). No axis follow-up.
          const towardRail = Math.min(0, nDot);
          nudgeX = placeNx * towardRail;
          nudgeY = placeNy * towardRail;
          const nudgeMag = Math.hypot(nudgeX, nudgeY);
          if (nudgeMag > MAX_SOFT_NUDGE && nudgeMag > 0) {
            const s = MAX_SOFT_NUDGE / nudgeMag;
            nudgeX *= s;
            nudgeY *= s;
            wrap.dataset.nudgeClamped = nudgeMag.toFixed(1);
          } else {
            wrap.dataset.nudgeClamped = "";
          }
          nudgeSkipped =
            Math.abs(towardRail) < 1e-3 && (fix.x || fix.y) ? "axis" : "";
        } else {
          wrap.dataset.nudgeClamped = "";
          nudgeSkipped = "flat";
        }
        trackX += nudgeX;
        trackY += nudgeY;
        wrap.dataset.screenNudge = `${nudgeX.toFixed(1)},${nudgeY.toFixed(1)}`;
        wrap.dataset.nudgeSkipped = nudgeSkipped;
        wrap.dataset.clearance = placeAlong.toFixed(1);
      }

      wrap.style.transform = mouseTransform(trackX, trackY, displayRotate);
      wrap.dataset.bank = `${displayRotate.toFixed(2)},${placeNx.toFixed(3)},${placeNy.toFixed(3)},${facing}`;

      if (sitting) {
        enterSit();
        lastAlong = mouseAlong;
        lastX = trackX;
        lastY = trackY;
        return;
      }

      leaveSit();

      const dx = trackX - lastX;
      const dyCss = trackY - lastY;
      const dist = Number.isFinite(lastAlong)
        ? Math.hypot(dx, dyCss)
        : 0;
      const deltaAlong = Number.isFinite(lastAlong)
        ? mouseAlong - lastAlong
        : 0;
      lastAlong = mouseAlong;
      lastX = trackX;
      lastY = trackY;

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
