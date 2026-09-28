"use client";

import { animate, createScope } from "animejs";
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
import { FlameMouseTorch } from "@/components/previews/FlameMouseTorch";
import { cn } from "@/lib/utils";

const HOP_MS = 520;
const BLEND_MS = 90;

export function MouseRest({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<MouseSpriteHandle>(null);

  useEffect(() => {
    const hop = hopRef.current;
    const face = faceRef.current;
    const sprite = spriteRef.current;
    const root = rootRef.current;
    if (!hop || !face || !sprite || !root) return;

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

      const onMove = (event: PointerEvent) => {
        const box = face.getBoundingClientRect();
        const midX = box.left + box.width / 2;
        face.style.transform =
          event.clientX < midX ? "scaleX(-1)" : "scaleX(1)";
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
          translateY: [0, -36, 0],
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

      window.addEventListener("pointermove", onMove);
      root.addEventListener("click", onClick);

      return () => {
        window.clearTimeout(blendTimer);
        window.removeEventListener("pointermove", onMove);
        root.removeEventListener("click", onClick);
      };
    });

    return () => {
      scope.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("cursor-pointer", className)}
      role="img"
      aria-label="Ratón de queso en reposo. El puntero cambia la pose. Clic para saltar."
    >
      <div ref={hopRef} className="will-change-transform">
        <div
          ref={faceRef}
          className="origin-center"
          style={{
            width: "100%",
            aspectRatio: `${MOUSE_FRAME_SIZE.width} / ${MOUSE_FRAME_SIZE.height}`,
          }}
        >
          <FlameMouseTorch>
            <MouseSprite ref={spriteRef} />
          </FlameMouseTorch>
        </div>
      </div>
    </div>
  );
}
