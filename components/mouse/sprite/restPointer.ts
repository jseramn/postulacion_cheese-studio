import { animate } from "animejs";

import { hopClip, poseBlend, poseFrames } from "./clips";
import type { MouseSpriteHandle } from "./MouseSprite";

const BLEND_MS = 90;
const HOP_MS = 520;
const HOP_Y = -28;
const DRAG_PX = 10;

export type PointerPoint = {
  clientX: number;
  clientY: number;
};

export function restFacingFromPointer(
  clientX: number,
  midX: number,
): "left" | "right" {
  return clientX < midX ? "left" : "right";
}

export function restPoseFromPointer(
  clientY: number,
  box: Pick<DOMRect, "top" | "bottom">,
): string {
  if (clientY < box.top) return poseFrames.lookup;
  if (clientY > box.bottom) return poseFrames.sniff;
  return poseFrames.sit;
}

export type RestPointerDriver = {
  /** Sitting rest: pointer owns facing/poses. Walking: no-op. */
  setSitting: (sitting: boolean, box?: DOMRect) => void;
  onPointerMove: (point: PointerPoint, box: DOMRect) => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: (
    event: PointerEvent,
    hopEl: HTMLElement,
    reduceMotion: boolean,
  ) => void;
  dispose: () => void;
};

/**
 * PointerIdle / MouseRest rest behavior, without scaling the motion-path wrap.
 * Facing goes through MouseSprite.setFacing (inner foot origin).
 */
export function createRestPointerDriver(
  sprite: MouseSpriteHandle,
): RestPointerDriver {
  let sitting = false;
  let hopping = false;
  let blendTimer = 0;
  let shown = poseFrames.sit;
  let lastPoint: PointerPoint | null = null;
  let down: PointerPoint | null = null;
  let hopAnim: ReturnType<typeof animate> | undefined;

  const showPose = (next: string) => {
    if (!sitting || hopping || next === shown) return;
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

  const applyPoint = (point: PointerPoint, box: DOMRect) => {
    sprite.setFacing(
      restFacingFromPointer(point.clientX, box.left + box.width / 2),
    );
    if (hopping) return;
    showPose(restPoseFromPointer(point.clientY, box));
  };

  const stopHop = () => {
    hopping = false;
    hopAnim?.revert();
    hopAnim = undefined;
  };

  return {
    setSitting(next, box) {
      if (!next) {
        if (!sitting) return;
        sitting = false;
        window.clearTimeout(blendTimer);
        stopHop();
        down = null;
        shown = poseFrames.sit;
        return;
      }
      const became = !sitting;
      sitting = true;
      if (became) {
        shown = poseFrames.sit;
        if (lastPoint && box) applyPoint(lastPoint, box);
      }
    },
    onPointerMove(point, box) {
      lastPoint = { clientX: point.clientX, clientY: point.clientY };
      if (!sitting) return;
      applyPoint(lastPoint, box);
    },
    onPointerDown(event) {
      if (!sitting) return;
      down = { clientX: event.clientX, clientY: event.clientY };
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        try {
          target.setPointerCapture(event.pointerId);
        } catch {
          /* capture is optional */
        }
      }
    },
    onPointerUp(event, hopEl, reduceMotion) {
      if (!sitting || hopping || !down) {
        down = null;
        return;
      }
      const drag = Math.hypot(
        event.clientX - down.clientX,
        event.clientY - down.clientY,
      );
      down = null;
      if (drag > DRAG_PX || reduceMotion) return;

      hopping = true;
      window.clearTimeout(blendTimer);
      shown = poseFrames.apex;
      sprite.setFrame(hopClip(0));
      hopAnim?.revert();
      hopAnim = animate(hopEl, {
        translateY: [0, HOP_Y, 0],
        duration: HOP_MS,
        ease: "outBack(1.7)",
        onUpdate: (anim) => {
          sprite.setFrame(hopClip(anim.progress));
        },
        onComplete: () => {
          hopping = false;
          hopAnim = undefined;
          shown = poseFrames.sit;
          if (sitting) sprite.setFrame(poseFrames.sit);
        },
      });
    },
    dispose() {
      window.clearTimeout(blendTimer);
      stopHop();
    },
  };
}
