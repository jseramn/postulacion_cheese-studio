"use client";

import { createScope, createTimeline, onScroll } from "animejs";
import { useEffect, useRef } from "react";

import {
  MouseSprite,
  type MouseSpriteHandle,
} from "@/components/mouse/sprite/MouseSprite";
import {
  MOUSE_FOOT_PAD,
  MOUSE_FRAME_SIZE,
  poseFrames,
} from "@/components/mouse/sprite/clips";
import {
  createScrollPoseState,
  driveScrollPose,
} from "@/components/mouse/sprite/scrollPose";

export function WalkCycle() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const trackEl = trackRef.current;
    const stageEl = stageRef.current;
    const mouseEl = mouseRef.current;
    const sprite = spriteRef.current;
    if (!scrollEl || !trackEl || !stageEl || !mouseEl || !sprite) return;

    const scope = createScope({
      root: scrollRef,
      mediaQueries: {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
    }).add((self) => {
      const reduce = Boolean(self?.matches.reduceMotion);
      const state = createScrollPoseState();
      const clock = { t: 0 };
      let lastProgress = 0;
      let lastX = 0;
      let lastY = 0;
      let placed = false;

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
          const delta = progress - lastProgress;
          lastProgress = progress;

          const maxX = Math.max(0, stageEl.clientWidth - mouseEl.offsetWidth);
          const inset = Math.min(maxX / 2, stageEl.clientWidth * 0.1);
          const travel = Math.max(0, maxX - inset * 2);
          const x = inset + progress * travel;
          const y = Math.sin(progress * Math.PI * 2.4) * 72;
          mouseEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;

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

          const moving = Math.abs(delta) >= 0.0004;
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
      }).add(clock, { t: 1 }, 0);
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
      <div ref={trackRef} className="relative min-h-[800vh]">
        <div className="sticky top-0 flex h-[min(68dvh,560px)] flex-col">
          <div ref={stageRef} className="relative min-h-0 flex-1">
            <div
              aria-hidden
              className="pointer-events-none absolute right-[10%] left-[10%] h-px bg-rind/70"
              style={{ bottom: `calc(38% + ${MOUSE_FOOT_PAD}px)` }}
            />
            <div
              ref={mouseRef}
              className="absolute left-0 will-change-transform"
              style={{
                bottom: "38%",
                width: MOUSE_FRAME_SIZE.width,
                height: MOUSE_FRAME_SIZE.height,
              }}
            >
              <MouseSprite ref={spriteRef} />
            </div>
          </div>
          <p className="shrink-0 px-6 pb-4 text-center font-sans text-sm text-fog">
            Deslizá este panel. El ciclo avanza con el scroll: subir mira
            arriba, bajar olfatea.
          </p>
        </div>
      </div>
    </div>
  );
}
