"use client";

import { animate, createMotionPath, createScope, createTimeline, onScroll } from "animejs";
import { useEffect, useRef } from "react";

import { MOUSE_PATH_D, MOUSE_PATH_VIEWBOX, pathPoint } from "@/components/mouse/sprite/mousePath";
import {
  MOUSE_FOOT_PAD,
  MOUSE_FOOT_X,
  MOUSE_FRAME_SIZE,
  poseFrames,
} from "@/components/mouse/sprite/clips";
import {
  MouseSprite,
  pathFootStyle,
  type MouseSpriteHandle,
} from "@/components/mouse/sprite/MouseSprite";
import {
  createScrollPoseState,
  driveScrollPose,
} from "@/components/mouse/sprite/scrollPose";

const MAX_CRUMBS = 28;

export function PathWalk() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const mouseWrapRef = useRef<HTMLDivElement>(null);
  const crumbsRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const trackEl = trackRef.current;
    const stageEl = stageRef.current;
    const pathEl = pathRef.current;
    const mouseWrap = mouseWrapRef.current;
    const crumbs = crumbsRef.current;
    const sprite = spriteRef.current;
    if (
      !scrollEl ||
      !trackEl ||
      !stageEl ||
      !pathEl ||
      !mouseWrap ||
      !crumbs ||
      !sprite
    ) {
      return;
    }

    const dropCrumb = () => {
      const stageBox = stageEl.getBoundingClientRect();
      const footX = (MOUSE_FOOT_X * mouseWrap.offsetWidth) / MOUSE_FRAME_SIZE.width;
      const footY =
        mouseWrap.offsetHeight -
        (MOUSE_FOOT_PAD * mouseWrap.offsetHeight) / MOUSE_FRAME_SIZE.height;
      const style = getComputedStyle(mouseWrap);
      const matrix = new DOMMatrix(style.transform);
      const [ox, oy] = style.transformOrigin.split(" ").map((part) => parseFloat(part));
      const shifted = new DOMPoint(footX - ox, footY - oy).matrixTransform(matrix);
      const origin = new DOMPoint(0, 0).matrixTransform(matrix);
      const parent = mouseWrap.offsetParent?.getBoundingClientRect();
      const x =
        (parent?.left ?? 0) +
        mouseWrap.offsetLeft +
        ox +
        (shifted.x - origin.x) -
        stageBox.left;
      const y =
        (parent?.top ?? 0) +
        mouseWrap.offsetTop +
        oy +
        (shifted.y - origin.y) -
        stageBox.top;
      const crumb = document.createElement("div");
      crumb.className =
        "pointer-events-none absolute size-1.5 rounded-full bg-whey";
      crumb.style.left = `${x}px`;
      crumb.style.top = `${y}px`;
      crumbs.appendChild(crumb);
      animate(crumb, {
        opacity: [1, 0.25],
        scale: [1, 0.65],
        duration: 2200,
        ease: "out(2)",
      });
      while (crumbs.childElementCount > MAX_CRUMBS) {
        crumbs.firstElementChild?.remove();
      }
    };

    const scope = createScope({
      root: scrollRef,
      mediaQueries: {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
    }).add((self) => {
      const reduce = Boolean(self?.matches.reduceMotion);
      const motion = createMotionPath(pathEl);
      const state = createScrollPoseState();
      let lastX = 0;
      let lastY = 0;
      let placed = false;
      let lastProgress = 0;

      sprite.setStride({ moving: false, hold: "walk" });

      createTimeline({
        defaults: { ease: "linear", duration: 1000 },
        autoplay: onScroll({
          container: scrollEl,
          target: trackEl,
          sync: true,
          enter: "top top",
          leave: "bottom bottom",
        }),
        onUpdate: (timeline) => {
          const progress = timeline.progress;
          const { x, y } = pathPoint(pathEl, progress);
          const delta = progress - lastProgress;
          lastProgress = progress;

          if (!placed) {
            lastX = x;
            lastY = y;
            placed = true;
            return;
          }

          const dx = x - lastX;
          const dy = y - lastY;
          lastX = x;
          lastY = y;
          const dist = Math.hypot(dx, dy);

          if (reduce) {
            sprite.setFrame(poseFrames.sit);
            return;
          }

          const moving = Math.abs(delta) >= 0.0004 && dist >= 0.05;
          driveScrollPose({
            sprite,
            dx,
            dy,
            dist: moving ? Math.min(dist, 48) : 0,
            dtMs: 16,
            moving,
            progressDelta: delta,
            state,
            onStride: moving ? dropCrumb : undefined,
          });
        },
      }).add(
        mouseWrap,
        {
          translateX: motion.translateX,
          translateY: motion.translateY,
          rotate: motion.rotate,
        },
        0,
      );

      return () => {
        crumbs.replaceChildren();
      };
    });

    return () => {
      scope.revert();
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 overflow-y-auto overscroll-contain"
    >
      <div ref={trackRef} className="relative min-h-[1400vh]">
        <div className="sticky top-0 flex h-[min(68dvh,560px)] flex-col">
          <div ref={stageRef} className="relative min-h-0 flex-1">
            <div
              ref={crumbsRef}
              className="pointer-events-none absolute inset-0"
            />
            <svg
              viewBox={MOUSE_PATH_VIEWBOX}
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <path
                ref={pathRef}
                d={MOUSE_PATH_D}
                fill="none"
                stroke="#d4b45a"
                strokeWidth="2"
                strokeDasharray="7 9"
                opacity="0.55"
              />
            </svg>
            <div
              ref={mouseWrapRef}
              className="absolute top-0 left-0 will-change-transform"
              style={pathFootStyle()}
            >
              <MouseSprite ref={spriteRef} />
            </div>
          </div>
          <p className="shrink-0 px-6 pb-4 text-center font-sans text-sm text-fog">
            Deslizá este panel. El ratón recorre el trazo y suelta migas en
            cada paso.
          </p>
        </div>
      </div>
    </div>
  );
}
