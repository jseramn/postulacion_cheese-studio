"use client";

import { createMotionPath, createScope, createTimeline, onScroll } from "animejs";
import { useEffect, useRef } from "react";

import { MOUSE_PATH_D, MOUSE_PATH_VIEWBOX, pathPoint } from "@/components/mouse/sprite/mousePath";
import {
  MouseSprite,
  pathFootStyle,
  type MouseSpriteHandle,
} from "@/components/mouse/sprite/MouseSprite";
import { poseFrames } from "@/components/mouse/sprite/clips";
import {
  createScrollPoseState,
  driveScrollPose,
} from "@/components/mouse/sprite/scrollPose";

export function ScrollWalk() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const mouseWrapRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const trackEl = trackRef.current;
    const pathEl = pathRef.current;
    const mouseWrap = mouseWrapRef.current;
    const sprite = spriteRef.current;
    if (!scrollEl || !trackEl || !pathEl || !mouseWrap || !sprite) return;

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
          <div className="relative min-h-0 flex-1">
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
            Deslizá este panel. El progreso 0 a 1 coloca al ratón sobre el
            trazo. Ángulo positivo mira arriba, negativo olfatea.
          </p>
        </div>
      </div>
    </div>
  );
}
