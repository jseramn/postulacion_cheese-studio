"use client";

import { createTimer } from "animejs";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";

import { AsciiSweep } from "@/components/canvasui/AsciiSweep";
import { cn } from "@/lib/utils";

import {
  MOUSE_FOOT_PAD,
  MOUSE_FOOT_X,
  MOUSE_FRAME_SIZE,
  STRIDE_POSE_MS,
  allMouseFrames,
  poseFrames,
  walkRightFrames,
} from "./clips";
import { MOUSE_ASCII_SWEEP } from "./scrollSweep";

export type MouseSpriteHandle = {
  setFrame: (src: string, opts?: { angle?: number }) => void;
  setFacing: (direction: "left" | "right") => void;
  /** Scroll walk. Steps the existing stride drawings at 15fps while moving. */
  setStride: (input: { moving: boolean; hold: "up" | "down" | "walk" }) => void;
};

type MouseSpriteProps = {
  className?: string;
};

export const PATH_MOUSE_SIZE = {
  width: 148,
  height: Math.round((148 * MOUSE_FRAME_SIZE.height) / MOUSE_FRAME_SIZE.width),
} as const;

/** Put the paw contact on a motion-path point. Rotation pivots there, so the body stays above the stroke. */
export function pathFootStyle(
  width: number = PATH_MOUSE_SIZE.width,
  height: number = PATH_MOUSE_SIZE.height,
) {
  const footX = (MOUSE_FOOT_X * width) / MOUSE_FRAME_SIZE.width;
  const footPad = (MOUSE_FOOT_PAD * height) / MOUSE_FRAME_SIZE.height;
  return {
    width,
    height,
    marginLeft: -footX,
    marginTop: -(height - footPad),
    transformOrigin: `${footX}px ${height - footPad}px`,
  };
}

function MouseFrame({
  imgRef,
  src,
}: {
  imgRef: RefObject<HTMLImageElement | null>;
  src: string;
}) {
  return (
    <img
      ref={imgRef}
      src={src}
      alt=""
      width={MOUSE_FRAME_SIZE.width}
      height={MOUSE_FRAME_SIZE.height}
      draggable={false}
      className="h-full w-full select-none"
    />
  );
}

export const MouseSprite = forwardRef<MouseSpriteHandle, MouseSpriteProps>(
  function MouseSprite({ className }, ref) {
    const imgA = useRef<HTMLImageElement>(null);
    const imgB = useRef<HTMLImageElement>(null);
    const indexRef = useRef(0);
    const shownRef = useRef(poseFrames.sit);
    const facingRef = useRef<"left" | "right">("right");
    const [index, setIndex] = useState(0);
    const [srcA, setSrcA] = useState(poseFrames.sit);
    const [srcB, setSrcB] = useState(poseFrames.sit);
    const [maskSrc, setMaskSrc] = useState(poseFrames.sit);
    const [facing, setFacingState] = useState<"left" | "right">("right");
    const [angle, setAngle] = useState(0);
    const [reduce, setReduce] = useState(false);
    const strideLive = useRef(false);
    const poseIndex = useRef(0);
    const movingUntil = useRef(0);
    const swapGen = useRef(0);
    const swapToRef = useRef<(src: string) => void>(() => {});

    useEffect(() => {
      for (const src of allMouseFrames) {
        const preload = new Image();
        preload.src = src;
      }
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const sync = () => setReduce(motion.matches);
      sync();
      motion.addEventListener("change", sync);
      return () => motion.removeEventListener("change", sync);
    }, []);

    const showHeld = (src: string) => {
      shownRef.current = src;
      if (indexRef.current === 0) setSrcA(src);
      else setSrcB(src);
      setMaskSrc(src);
    };

    // Same slot swap as Reposo: the hidden panel takes the next drawing, then
    // index flips so AsciiSweep runs the band. A newer swap cancels a stale load.
    const swapTo = (src: string) => {
      if (shownRef.current === src) return;

      const gen = ++swapGen.current;
      const next = indexRef.current === 0 ? 1 : 0;
      if (next === 0) setSrcA(src);
      else setSrcB(src);

      const img = next === 0 ? imgA.current : imgB.current;
      const finish = () => {
        if (swapGen.current !== gen) return;
        shownRef.current = src;
        indexRef.current = next;
        setMaskSrc(src);
        setIndex(next);
      };

      if (!img) {
        finish();
        return;
      }

      const ready = () => {
        img.removeEventListener("load", ready);
        requestAnimationFrame(() => {
          finish();
        });
      };
      img.addEventListener("load", ready);
      img.src = src;
      if (img.complete && img.naturalWidth > 0) ready();
    };
    swapToRef.current = swapTo;

    useEffect(() => {
      const timer = createTimer({
        duration: STRIDE_POSE_MS,
        loop: true,
        autoplay: true,
        onLoop: () => {
          if (!strideLive.current) return;
          if (performance.now() > movingUntil.current) return;
          poseIndex.current = (poseIndex.current + 1) % walkRightFrames.length;
          swapToRef.current(walkRightFrames[poseIndex.current]);
        },
      });
      return () => {
        timer.cancel();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      setFrame(src, opts) {
        strideLive.current = false;
        if (opts?.angle != null) setAngle(opts.angle);
        swapTo(src);
      },
      setFacing(direction) {
        if (facingRef.current === direction) return;
        facingRef.current = direction;
        setFacingState(direction);
      },
      setStride(input) {
        const arm = !strideLive.current;
        strideLive.current = true;
        if (input.moving) {
          movingUntil.current = performance.now() + STRIDE_POSE_MS * 2;
        }
        if (arm) showHeld(walkRightFrames[poseIndex.current]);
      },
    }));

    return (
      <div
        className={cn("h-full w-full", className)}
        style={{
          transform: facing === "left" ? "scaleX(-1)" : "scaleX(1)",
          transformOrigin: `${(MOUSE_FOOT_X / MOUSE_FRAME_SIZE.width) * 100}% ${((MOUSE_FRAME_SIZE.height - MOUSE_FOOT_PAD) / MOUSE_FRAME_SIZE.height) * 100}%`,
          WebkitMaskImage: `url("${maskSrc}")`,
          maskImage: `url("${maskSrc}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          maskMode: "alpha",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      >
        <AsciiSweep
          {...MOUSE_ASCII_SWEEP}
          className="h-full w-full"
          index={index}
          directional
          angle={angle}
          duration={reduce ? 0.01 : MOUSE_ASCII_SWEEP.duration}
          alternate={<MouseFrame imgRef={imgB} src={srcB} />}
        >
          <MouseFrame imgRef={imgA} src={srcA} />
        </AsciiSweep>
      </div>
    );
  },
);
