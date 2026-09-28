"use client";

import { animate, createDrawable, createMotionPath, createScope, onScroll } from "animejs";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { CHEESES, REST_ALONG_GAP, restSide } from "@/components/scroll/cheeses";
import {
  BAND_TOP_VH,
  COPIES_PER_MODULE,
  VIEW_W,
  buildRailLut,
  layoutMetrics,
  modulePathD,
  pinOnRailFromLut,
  pointOnRailNearY,
  svgCssHeight,
  tiledCopy,
  viewBoxFor,
  type RailLut,
} from "@/components/scroll/pathCopy";
import {
  TRACK_VH_PER_MODULE,
  mouseFromProgress,
  mousePathAmount,
  progressFromScroll,
  restIndexFromAlong,
  revealAmount,
} from "@/components/scroll/scrollClock";
import {
  MouseSprite,
  pathFootStyle,
  type MouseSpriteHandle,
} from "@/components/mouse/sprite/MouseSprite";
import { poseFrames } from "@/components/mouse/sprite/clips";
import { createRestPointerDriver } from "@/components/mouse/sprite/restPointer";
import {
  createScrollPoseState,
  driveScrollPose,
} from "@/components/mouse/sprite/scrollPose";

const INITIAL_MODULES = 2;
const TAIL_MODULES = 0.35;
const LETTER_FILL = "#ebe4d4";
const LETTER_SIZE = 34;
/** Walk pin: stay on the letter rail at this viewport Y (José Ramón's mark). */
const WALK_PIN_VH = 0.5;
const COPY_UNIT = 380;
/** Extra lift so the belly clears letter caps. Rest y adds this back. */
const FOOT_LIFT = 36;
const SCROLL_DIR_EPS = 1;
/** Browser-restored scrollTop on remount. Typical wheel is ~100–150px. */
const REMOUNT_SCROLL_EPS = 400;

type AnimHandle = {
  seek: (time: number) => unknown;
  revert: () => unknown;
};

function copiesForLength(totalLength: number): number {
  return Math.max(8, Math.round(totalLength / COPY_UNIT));
}

function uprightAngle(deg: number): number {
  if (Math.cos((deg * Math.PI) / 180) >= -0.05) return deg;
  return deg + 180;
}

/** Path tangent, then +180 only when the heading disagrees with last scroll dir. */
function travelAngle(tangentDeg: number, scrollDir: number): number {
  const headingDown = Math.sin((tangentDeg * Math.PI) / 180) >= 0;
  const wantDown = scrollDir >= 0;
  if (headingDown === wantDown) return tangentDeg;
  return tangentDeg + 180;
}

/** Keep createMotionPath tangent, then add 180° when the head would point down. */
function applyUprightBank(el: HTMLElement) {
  const matrix = new DOMMatrix(getComputedStyle(el).transform);
  const angle = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  const banked = uprightAngle(angle);
  if (banked === angle) return;
  el.style.transform = `translate(${matrix.e}px, ${matrix.f}px) rotate(${banked}deg)`;
}

function railTangentDeg(
  rail: SVGPathElement,
  along: number,
  total: number,
): number {
  const length = Math.max(0, total);
  const eps = Math.min(12, Math.max(2, length * 0.0008));
  const a0 = Math.max(0, along - eps);
  const a1 = Math.min(length, along + eps);
  const p0 = rail.getPointAtLength(a0);
  const p1 = rail.getPointAtLength(a1);
  return (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
}

export function ScrollLab() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const railRef = useRef<SVGPathElement>(null);
  const drawRef = useRef<SVGPathElement>(null);
  const textPathRef = useRef<SVGTextPathElement>(null);
  const cheeseRefs = useRef<Array<SVGCircleElement | null>>([]);
  const mouseWrapRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);
  const modulesRef = useRef(INITIAL_MODULES);
  const modulePxRef = useRef(1);
  const cheeseAlongRef = useRef<number[]>([]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const trackEl = trackRef.current;
    const svgEl = svgRef.current;
    const railEl = railRef.current;
    const drawEl = drawRef.current;
    const textPathEl = textPathRef.current;
    const mouseWrap = mouseWrapRef.current;
    const hop = hopRef.current;
    const sprite = spriteRef.current;
    if (
      !scrollEl ||
      !trackEl ||
      !svgEl ||
      !railEl ||
      !drawEl ||
      !textPathEl ||
      !mouseWrap ||
      !hop ||
      !sprite
    ) {
      return;
    }

    const svgToTrack = (x: number, y: number) => {
      const pt = svgEl.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const ctm = svgEl.getScreenCTM();
      const trackBox = trackEl.getBoundingClientRect();
      if (!ctm) {
        const scale = trackEl.clientWidth / VIEW_W;
        return { x: x * scale, y: y * scale };
      }
      const screen = pt.matrixTransform(ctm);
      return { x: screen.x - trackBox.left, y: screen.y - trackBox.top };
    };

    const svgToScreen = (x: number, y: number) => {
      const pt = svgEl.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) {
        const track = svgToTrack(x, y);
        const trackBox = trackEl.getBoundingClientRect();
        return { x: trackBox.left + track.x, y: trackBox.top + track.y };
      }
      const screen = pt.matrixTransform(ctm);
      return { x: screen.x, y: screen.y };
    };

    let railLut: RailLut = { samples: [], totalLength: 0, pathD: "" };

    const applyGeometry = () => {
      const modules = modulesRef.current;
      const layout = layoutMetrics(
        scrollEl.clientWidth,
        scrollEl.clientHeight,
        TRACK_VH_PER_MODULE,
      );
      const d = modulePathD(modules, layout.dropY, layout.moduleH);
      railEl.setAttribute("d", d);
      drawEl.setAttribute("d", d);
      const svgH = svgCssHeight(
        modules,
        scrollEl.clientWidth,
        layout.dropY,
        layout.moduleH,
      );
      svgEl.setAttribute("viewBox", viewBoxFor(modules, layout.dropY, layout.moduleH));
      svgEl.style.marginTop = "0px";
      svgEl.style.height = `${svgH}px`;
      trackEl.style.height = `${svgH}px`;
      modulePxRef.current = (layout.moduleH * scrollEl.clientWidth) / VIEW_W;

      if (d !== railLut.pathD) {
        railLut = buildRailLut(railEl, d);
      }
      const total = railLut.totalLength;
      textPathEl.textContent = tiledCopy(copiesForLength(total));

      CHEESES.forEach((cheese, index) => {
        if (total <= 0) return;
        const moduleLen = total / Math.max(1, modules);
        const moduleIndex = Math.floor(cheese.t);
        const targetScreenY =
          scrollEl.clientHeight * WALK_PIN_VH +
          cheese.t * modulePxRef.current -
          scrollEl.scrollTop;
        const point = pointOnRailNearY(
          railEl,
          targetScreenY,
          restSide(index),
          moduleIndex * moduleLen,
          (moduleIndex + 1) * moduleLen,
          VIEW_W / 2,
          (sample) => svgToScreen(sample.x, sample.y).y,
        );
        cheeseAlongRef.current[index] = point.along;
        const el = cheeseRefs.current[index];
        if (!el) return;
        el.setAttribute("cx", String(point.x));
        el.setAttribute("cy", String(point.y));
      });
    };

    const scope = createScope({
      root: scrollEl,
      mediaQueries: {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
    }).add((self) => {
      const reduce = Boolean(self?.matches.reduceMotion);
      const state = createScrollPoseState();
      const restPointer = createRestPointerDriver(sprite);
      let lastX = 0;
      let lastY = 0;
      let lastAlong = 0;
      let lastDir = 1;
      let lastClearSign: number | null = null;
      let lastScrollTop = scrollEl.scrollTop;
      let walkPinSeeded = false;
      let lastTravelRotate: number | null = null;
      let sitLanded = reduce;
      let sitHold = false;
      let drawAnim: AnimHandle | undefined;
      let mouseAnim: AnimHandle | undefined;

      const placeMouseOnRail = (along: number, rotateDeg: number) => {
        const total = railLut.totalLength;
        const clamped = Math.max(0, Math.min(total, along));
        const svgPoint = railEl.getPointAtLength(clamped);
        const { x, y } = svgToTrack(svgPoint.x, svgPoint.y);
        const letterPx = LETTER_SIZE * (trackEl.clientWidth / VIEW_W);
        // Letter + FOOT_LIFT along the signed rail normal (viewport-center scoring).
        // Rejected: sole fire-center-normal, 102px center-fire, always-left, blend vector.
        const cssClear = letterPx + FOOT_LIFT;
        const tangentDeg = railTangentDeg(railEl, clamped, total);
        const rad = (tangentDeg * Math.PI) / 180;
        const nx = -Math.sin(rad);
        const ny = Math.cos(rad);
        const walking = rotateDeg !== 0;
        const cheeseRest =
          restIndexFromAlong(clamped, cheeseAlongRef.current, REST_ALONG_GAP) !=
          null;
        const applyClear = walking || (rotateDeg === 0 && !cheeseRest);
        const verticalRail = Math.abs(Math.sin(rad)) >= Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        const absCos = Math.abs(Math.cos(rad));
        const verticalness = absSin + absCos > 0 ? absSin / (absSin + absCos) : 0;
        const screen = svgToScreen(svgPoint.x, svgPoint.y);
        const scrollBox = scrollEl.getBoundingClientRect();
        const viewCX = scrollBox.left + scrollEl.clientWidth / 2;
        const viewCY = scrollBox.top + scrollEl.clientHeight / 2;
        const toCenterX = viewCX - screen.x;
        const toCenterY = viewCY - screen.y;
        const centerLen = Math.hypot(toCenterX, toCenterY) || 1;
        const cX = toCenterX / centerLen;
        const cY = toCenterY / centerLen;
        const scoreUp = -ny;
        const scoreCenter = nx * cX + ny * cY;
        const score =
          (1 - verticalness) * scoreUp + verticalness * scoreCenter;
        let nSign: number;
        if (Math.abs(score) < 0.08 && lastClearSign != null) {
          nSign = lastClearSign;
        } else {
          nSign = score >= 0 ? 1 : -1;
          lastClearSign = nSign;
        }
        // Offset is always a signed rail-normal * cssClear (never bx/by).
        let ox = applyClear ? nSign * nx * cssClear : 0;
        let oy = applyClear ? nSign * ny * cssClear : 0;
        // Down: scaleY(-1) on the parent wrap (flip across the path / local X).
        // CSS applies right-to-left: scaleY, then rotate (heading), then translate (foot).
        // Curve +180 heading inverts local body onto the glyphs; parent scaleY(-1)
        // around the foot restores the down-walk hang. Toggle remains vertical-only.
        // Sit/rest (rotateDeg === 0): never invent scaleY. Do not invert with child setFacing.
        const headingFlipped = Math.abs(rotateDeg - tangentDeg) > 90;
        let parentScaleY = walking && (verticalRail ? lastDir >= 0 : headingFlipped);
        const applyMouseTransform = () => {
          mouseWrap.style.transform = parentScaleY
            ? `translate(${x + ox}px, ${y + oy}px) rotate(${rotateDeg}deg) scaleY(-1)`
            : `translate(${x + ox}px, ${y + oy}px) rotate(${rotateDeg}deg)`;
        };
        applyMouseTransform();
        const letterHalf = letterPx / 2;
        const wrapMeasure = mouseWrap.getBoundingClientRect();
        const xInside = Math.min(
          screen.x - wrapMeasure.left,
          wrapMeasure.right - screen.x,
        );
        const yInside = Math.min(
          screen.y - wrapMeasure.top,
          wrapMeasure.bottom - screen.y,
        );
        const glyphHit = xInside >= -letterHalf && yInside >= -letterHalf;
        // Sit/rest uses rotateDeg === 0 (walking=false); do not invent scaleY there.
        if (walking && verticalRail && glyphHit && Math.max(xInside, yInside) > 40) {
          parentScaleY = !parentScaleY;
          applyMouseTransform();
        }
        return {
          along,
          x: svgPoint.x,
          y: svgPoint.y,
        };
      };

      const sitBox = () => hop.getBoundingClientRect();

      const holdSit = () => {
        if (sitLanded || sitHold) return;
        sitHold = true;
        sprite.setFrame(poseFrames.sit);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            sitHold = false;
            sitLanded = true;
          });
        });
      };

      const enterSit = () => {
        holdSit();
        restPointer.setSitting(true, sitBox());
      };

      const leaveSit = () => {
        restPointer.setSitting(false);
        sitLanded = false;
        sitHold = false;
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

      applyGeometry();

      const bindMotors = () => {
        drawAnim?.revert();
        mouseAnim?.revert();
        const [drawable] = createDrawable(drawEl);
        drawAnim = animate(drawable, {
          draw: ["0 0", "0 1"],
          ease: "linear",
          duration: 1000,
          autoplay: false,
        });
        const motion = createMotionPath(railEl);
        if (motion) {
          mouseAnim = animate(mouseWrap, {
            translateX: motion.translateX,
            translateY: motion.translateY,
            rotate: motion.rotate,
            ease: "linear",
            duration: 1000,
            autoplay: false,
          });
        }
      };

      const seekMotors = (draw01: number, mouse01: number) => {
        const drawT = Math.max(0, Math.min(1, draw01)) * 1000;
        const mouseT = Math.max(0, Math.min(1, mouse01)) * 1000;
        drawAnim?.seek(drawT);
        mouseAnim?.seek(mouseT);
        applyUprightBank(mouseWrap);
      };

      bindMotors();
      {
        const n0 = modulesRef.current;
        const mouse0 = mouseFromProgress(0, CHEESES[0]?.t ?? 0, reduce);
        seekMotors(reduce ? 1 : revealAmount(0, n0), mousePathAmount(mouse0, n0));
        enterSit();
      }

      let observer: ReturnType<typeof onScroll> | undefined;

      const tick = () => {
        const scrollTop = scrollEl.scrollTop;
        const scrollDelta = scrollTop - lastScrollTop;
        if (Math.abs(scrollDelta) > SCROLL_DIR_EPS) {
          lastDir = scrollDelta > 0 ? 1 : -1;
        }
        lastScrollTop = scrollTop;

        const progress = progressFromScroll(scrollTop, modulePxRef.current);
        const modules = modulesRef.current;
        const remaining =
          scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
        const appended = remaining < modulePxRef.current * TAIL_MODULES;
        if (appended) {
          const totalLengthBefore = railLut.totalLength;
          const revealBefore = reduce ? 1 : revealAmount(progress, modules);
          modulesRef.current = modules + 1;
          applyGeometry();
          bindMotors();
          const totalLengthAfter = railLut.totalLength;
          const nAfter = modulesRef.current;
          const lengthRatio =
            totalLengthAfter > 0 ? totalLengthBefore / totalLengthAfter : 1;
          const revealAfter = reduce
            ? 1
            : Math.min(1, revealBefore * lengthRatio);
          const mouseAfter = mouseFromProgress(
            progress,
            CHEESES[0]?.t ?? 0,
            reduce,
          );
          seekMotors(revealAfter, mousePathAmount(mouseAfter, nAfter));
          observer?.refresh();
          return;
        }

        const n = modulesRef.current;
        const cheeseT = CHEESES[0]?.t ?? 0;
        const mouse = mouseFromProgress(progress, cheeseT, reduce);
        const reveal = reduce ? 1 : revealAmount(progress, n);
        const total = railLut.totalLength;

        drawAnim?.seek(reveal * 1000);

        if (progress <= 1e-8) {
          const pathT = mousePathAmount(mouse, n);
          const along = pathT * total;
          const seated = placeMouseOnRail(along, 0);
          enterSit();
          lastAlong = seated.along;
          lastX = seated.x;
          lastY = seated.y;
          lastTravelRotate = null;
          return;
        }

        const targetViewY = scrollEl.clientHeight * WALK_PIN_VH;
        const svgBox = svgEl.getBoundingClientRect();
        const scale = svgEl.clientWidth / VIEW_W;
        const maxAlong = Math.max(1, reveal * total);
        // Remount/restore only: first pin, no wheel this tick, scrollTop already large.
        // A real 681px wheel (scrollDelta != 0) is NOT leftoverSeed — pin with that delta.
        const leftoverSeed =
          !walkPinSeeded &&
          Math.abs(scrollDelta) <= SCROLL_DIR_EPS &&
          scrollTop > REMOUNT_SCROLL_EPS;
        if (leftoverSeed) {
          lastAlong = Math.max(
            0,
            Math.min(maxAlong, mousePathAmount(mouse, n) * total),
          );
          lastScrollTop = scrollTop;
        }
        const pin = pinOnRailFromLut(
          railLut,
          targetViewY,
          svgBox.top,
          scale,
          lastAlong,
          maxAlong,
          leftoverSeed ? 0 : scrollDelta,
        );
        if (leftoverSeed) {
          lastX = pin.x;
          lastY = pin.y;
        }
        walkPinSeeded = true;
        const dx = pin.x - lastX;
        const dy = pin.y - lastY;

        const restIndex = reduce
          ? null
          : restIndexFromAlong(
              pin.along,
              cheeseAlongRef.current,
              REST_ALONG_GAP,
            );

        if (restIndex != null || reduce) {
          const seated = placeMouseOnRail(pin.along, 0);
          enterSit();
          lastAlong = seated.along;
          lastX = seated.x;
          lastY = seated.y;
          lastTravelRotate = null;
          return;
        }

        leaveSit();

        const tangentDeg = railTangentDeg(railEl, pin.along, total);
        const scrolling = Math.abs(scrollDelta) > SCROLL_DIR_EPS;
        if (scrolling || lastTravelRotate == null) {
          lastTravelRotate = travelAngle(tangentDeg, lastDir);
        }
        const rotateDeg = lastTravelRotate;
        placeMouseOnRail(pin.along, rotateDeg);

        const deltaAlong = pin.along - lastAlong;
        lastAlong = pin.along;
        lastX = pin.x;
        lastY = pin.y;
        const dist = Math.hypot(dx, dy);
        const pinMoving = Math.abs(deltaAlong) >= 0.4 && dist >= 0.05;
        const walking = pinMoving || scrolling;
        driveScrollPose({
          sprite,
          dx,
          dy,
          dist: pinMoving ? Math.min(dist, 48) : 0,
          dtMs: 16,
          moving: walking,
          progressDelta: lastDir,
          state,
        });
      };

      observer = onScroll({
        container: scrollEl,
        target: trackEl,
        sync: true,
        enter: "top top",
        leave: "bottom bottom",
        onUpdate: tick,
        onResize: () => {
          applyGeometry();
          bindMotors();
          const nNow = modulesRef.current;
          const pNow = progressFromScroll(scrollEl.scrollTop, modulePxRef.current);
          const mouseNow = mouseFromProgress(pNow, CHEESES[0]?.t ?? 0, reduce);
          seekMotors(
            reduce ? 1 : revealAmount(pNow, nNow),
            mousePathAmount(mouseNow, nNow),
          );
          tick();
        },
      });

      tick();

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        hop.removeEventListener("pointerdown", onPointerDown);
        hop.removeEventListener("pointerup", onPointerUp);
        restPointer.dispose();
        drawAnim?.revert();
        mouseAnim?.revert();
        observer?.revert();
      };
    });

    return () => {
      scope.revert();
    };
  }, []);

  const initialD = modulePathD(INITIAL_MODULES, 0);
  const foot = pathFootStyle();
  const initialMinH = `calc(${INITIAL_MODULES * TRACK_VH_PER_MODULE}vh + ${BAND_TOP_VH}vh)`;

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={scrollRef}
        className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        aria-label="Sendero de letras. El ratón camina y se sienta en el queso."
      >
        <div
          ref={trackRef}
          className="relative w-full"
          style={{ minHeight: initialMinH }}
        >
          <svg
            ref={svgRef}
            viewBox={viewBoxFor(INITIAL_MODULES, 0)}
            className="block w-full"
            preserveAspectRatio="xMidYMin meet"
            aria-hidden
            style={{ marginTop: `${BAND_TOP_VH}vh` }}
          >
            <defs>
              <path id="scroll-rail" ref={railRef} d={initialD} fill="none" />
              <mask
                id="scroll-reveal"
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
              >
                <path
                  ref={drawRef}
                  d={initialD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="96"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </mask>
            </defs>
            <g mask="url(#scroll-reveal)">
              <text
                className="font-heading font-semibold tracking-tighter"
                fill={LETTER_FILL}
                fontSize={LETTER_SIZE}
                letterSpacing={-2.4}
                style={{ fontFamily: "var(--font-heading), ui-sans-serif, sans-serif" }}
              >
                <textPath
                  ref={textPathRef}
                  href="#scroll-rail"
                  spacing="auto"
                  dy="-6"
                >
                  {tiledCopy(INITIAL_MODULES * COPIES_PER_MODULE)}
                </textPath>
              </text>
            </g>
            {CHEESES.map((cheese, index) => (
              <circle
                key={cheese.t}
                ref={(el) => {
                  cheeseRefs.current[index] = el;
                }}
                r="8"
                fill="#ffffff"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
            <div
              ref={mouseWrapRef}
              className="absolute top-0 left-0 will-change-transform"
              style={foot}
            >
              <div
                ref={hopRef}
                className="pointer-events-auto h-full w-full cursor-pointer will-change-transform"
              >
                <MouseSprite ref={spriteRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 md:p-5">
        <Link
          href="/"
          className="pointer-events-auto w-fit font-sans text-xs text-fog underline-offset-4 hover:text-milk hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-whey"
        >
          Volver
        </Link>
        <p className="pointer-events-auto max-w-[22ch] font-sans text-[11px] leading-relaxed text-fog">
          Construcción del trazo según{" "}
          <a
            href="https://skiper-ui.com"
            className="underline-offset-4 hover:text-milk hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-whey"
          >
            Skiper UI
          </a>{" "}
          (free).
        </p>
      </div>
    </div>
  );
}
