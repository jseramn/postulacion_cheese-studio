"use client";

import { createScope } from "animejs";
import { useEffect, useRef } from "react";

import type { TextPreset } from "@/components/text/presets";

const DEFAULT_SAMPLE = "Un ratón de agujeros";

export function TextStage({
  preset,
  text,
}: {
  preset: TextPreset;
  text: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const textEl = textRef.current;
    if (!root || !textEl) return;

    textEl.textContent = text.trim() || DEFAULT_SAMPLE;

    let unmount: void | (() => void);
    const scope = createScope({
      root: rootRef,
      mediaQueries: {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
    }).add((self) => {
      const reduceMotion = Boolean(self?.matches.reduceMotion);
      unmount = preset.mount({ root, textEl, reduceMotion });
      return unmount;
    });

    return () => {
      unmount?.();
      scope.revert();
    };
  }, [preset, text]);

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col items-center justify-center px-6 py-10"
    >
      <div className="w-full">
        <h2
          ref={textRef}
          className="mx-auto w-full max-w-[14ch] text-center font-heading text-4xl font-semibold leading-[1.15] tracking-tight text-milk md:text-6xl"
        />
      </div>
    </div>
  );
}
