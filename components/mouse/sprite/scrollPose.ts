import { STRIDE_PX, type WalkDirection } from "./clips";
import type { MouseSpriteHandle } from "./MouseSprite";

/** ~15° so gentle flats still walk instead of flickering lookup/sniff. */
export const ANGLE_EPS = (15 * Math.PI) / 180;

/** AsciiSweep: 0 = X (left→right), 90 = Y (bottom→top). XY inverted vs the first pass. */
export const VERTICAL_SWEEP_DEG = 0;
export const WALK_SWEEP_DEG = 90;

export type VerticalHold = "up" | "down" | "walk";

export type ScrollPoseState = {
  hold: VerticalHold;
  facing: WalkDirection;
  walkIndex: number;
  carry: number;
  distanceSinceIdle: number;
};

export function createScrollPoseState(): ScrollPoseState {
  return {
    hold: "walk",
    facing: "right",
    walkIndex: 0,
    carry: 0,
    distanceSinceIdle: 0,
  };
}

export function scrollAngle(dx: number, dyCss: number): number {
  /** CSS Y grows down. Keep that sign so a downward move looks down (sniff). */
  return Math.atan2(dyCss, dx);
}

/**
 * While moving: steep screen-down → sniff, steep screen-up → lookup, else walk.
 * Idle callers should skip this and keep `last` (never sit).
 */
export function heldVerticalPose(angle: number, last: VerticalHold): VerticalHold {
  if (!Number.isFinite(angle)) return last;
  if (angle > ANGLE_EPS) return "up";
  if (angle < -ANGLE_EPS) return "down";
  return "walk";
}

export function poseFromDeltaProgress(
  delta: number,
  hold: VerticalHold,
): VerticalHold {
  if (delta < -1e-4) return "up";
  if (delta > 1e-4) return "down";
  return hold;
}

export function driveScrollPose(input: {
  sprite: MouseSpriteHandle;
  dx: number;
  dy: number;
  dist: number;
  dtMs: number;
  moving: boolean;
  /** Scroll (or path) signed delta. When set, hold skips pin/path angle. */
  progressDelta?: number;
  state: ScrollPoseState;
  onStride?: () => void;
}): void {
  const { sprite, dx, dy, dist, moving, progressDelta, state, onStride } =
    input;

  if (moving) {
    const scrollDelta =
      progressDelta != null && Number.isFinite(progressDelta)
        ? progressDelta
        : null;

    // Scroll/path delta owns hold when provided (down→down, up→up, idle keeps
    // last). Pin dx/dy angle flickers on a 50vh sample and must not gate walk.
    state.hold =
      scrollDelta != null
        ? poseFromDeltaProgress(scrollDelta, state.hold)
        : heldVerticalPose(scrollAngle(dx, dy), state.hold);

    // The trail is parameterized left → right (sampled 100 steps, 0 negative
    // dx). Per-frame path dx flips at peaks and reads as a facing bug. Follow
    // scroll instead: down the page faces right, up the page faces left.
    const along = scrollDelta != null ? scrollDelta : dx;
    if (Math.abs(along) > 1e-6) {
      state.facing = along > 0 ? "right" : "left";
    }
    state.distanceSinceIdle += dist;
    state.carry += dist;
    while (state.carry >= STRIDE_PX) {
      state.carry -= STRIDE_PX;
      state.walkIndex += 1;
      onStride?.();
    }
  }

  // Slopes tilt the silhouette. The stride sheet keeps stepping in MouseSprite.
  sprite.setFacing(state.facing);
  sprite.setStride({ moving, hold: state.hold });
}
