"use client";

import { animate, createScope, createTimeline } from "animejs";
import { useEffect, useRef } from "react";

import {
  MOUSE_FRAME_SIZE,
  hopClip,
  poseBlend,
  poseFrames,
} from "@/components/mouse/sprite/clips";
import {
  MouseSprite,
  type MouseSpriteHandle,
} from "@/components/mouse/sprite/MouseSprite";

const HOP_MS = 520;
const BLEND_MS = 90;

export function PointerIdle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const breatheRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);

  useEffect(() => {
    const stage = rootRef.current;
    const hop = hopRef.current;
    const breathe = breatheRef.current;
    const face = faceRef.current;
    const sprite = spriteRef.current;
    if (!stage || !hop || !breathe || !face || !sprite) return;

    let hopping = false;
    let blendTimer = 0;
    let shown = poseFrames.sit;

    const showPose = (next: string) => {
      if (hopping || next === shown) return;
      const blend = poseBlend(shown, next);
      shown = next;
      window.clearTimeout(blendTimer);
      if (blend) {
        sprite.setFrame(blend);
        blendTimer = window.setTimeout(() => {
          sprite.setFrame(next);
        }, BLEND_MS);
        return;
      }
      sprite.setFrame(next);
    };

    const scope = createScope({
      root: rootRef,
      mediaQueries: {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
    }).add((self) => {
      const reduce = Boolean(self?.matches.reduceMotion);
      sprite.setFrame(poseFrames.sit);

      if (!reduce) {
        createTimeline({
          defaults: { ease: "inOutSine", duration: 1400 },
          loop: true,
          alternate: true,
        }).add(breathe, { scale: [1, 1.035] }, 0);
      }

      const onMove = (event: PointerEvent) => {
        const box = face.getBoundingClientRect();
        const midX = box.left + box.width / 2;
        face.style.transform = event.clientX < midX ? "scaleX(-1)" : "scaleX(1)";
        if (hopping) return;

        if (event.clientY < box.top) showPose(poseFrames.lookup);
        else if (event.clientY > box.bottom) showPose(poseFrames.sniff);
        else showPose(poseFrames.sit);
      };

      const onClick = () => {
        if (reduce) return;
        hopping = true;
        window.clearTimeout(blendTimer);
        shown = poseFrames.apex;
        sprite.setFrame(hopClip(0));
        animate(hop, {
          translateY: [0, -28, 0],
          duration: HOP_MS,
          ease: "outBack(1.7)",
          onUpdate: (anim) => {
            sprite.setFrame(hopClip(anim.progress));
          },
          onComplete: () => {
            hopping = false;
            shown = poseFrames.sit;
            sprite.setFrame(poseFrames.sit);
          },
        });
      };

      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("click", onClick);

      return () => {
        window.clearTimeout(blendTimer);
        stage.removeEventListener("pointermove", onMove);
        stage.removeEventListener("click", onClick);
      };
    });

    return () => {
      scope.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 cursor-pointer flex-col items-center justify-center gap-8 px-6"
    >
      <div ref={hopRef} className="will-change-transform">
        <div ref={breatheRef} className="will-change-transform">
          <div
            ref={faceRef}
            className="origin-center"
            style={{
              width: MOUSE_FRAME_SIZE.width,
              height: MOUSE_FRAME_SIZE.height,
            }}
          >
            <MouseSprite ref={spriteRef} />
          </div>
        </div>
      </div>
      <p className="max-w-sm text-center font-sans text-sm text-fog">
        Respira sentado. El puntero cambia la pose. Un clic lo hace saltar.
      </p>
    </div>
  );
}
