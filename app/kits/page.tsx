"use client";

import Link from "next/link";
import { useState } from "react";

import AnimatedBeamDemo from "@/app/kits/demos/animated-beam-demo";
import { MultiStepLoaderDemo } from "@/app/kits/demos/multi-step-loader-demo";
import { Skiper19Demo } from "@/app/kits/demos/skiper19-demo";
import { Skiper67Demo } from "@/app/kits/demos/skiper67-demo";
import { SmoothCursorDemo } from "@/app/kits/demos/smooth-cursor-demo";
import { TerminalDemo } from "@/app/kits/demos/terminal-demo";
import { ThemeTogglerDemo } from "@/app/kits/demos/theme-toggler-demo";
import { TimelineDemo } from "@/app/kits/demos/timeline-demo";
import { TweetCardDemo } from "@/app/kits/demos/tweet-card-demo";
import { WisprFlowDemo } from "@/app/kits/demos/wispr-flow-demo";
import { cn } from "@/lib/utils";

const KITS = [
  { id: "theme-toggler", label: "Theme toggler", Demo: ThemeTogglerDemo },
  { id: "animated-beam", label: "Animated beam", Demo: AnimatedBeamDemo },
  { id: "smooth-cursor", label: "Smooth cursor", Demo: SmoothCursorDemo },
  { id: "tweet-card", label: "Tweet card", Demo: TweetCardDemo },
  { id: "terminal", label: "Terminal", Demo: TerminalDemo },
  { id: "wispr-flow", label: "Wispr Flow", Demo: WisprFlowDemo },
  { id: "timeline", label: "Timeline", Demo: TimelineDemo },
  { id: "multi-step-loader", label: "Multi-step loader", Demo: MultiStepLoaderDemo },
  { id: "skiper67", label: "Skiper67", Demo: Skiper67Demo },
  { id: "skiper19", label: "Skiper19", Demo: Skiper19Demo },
] as const;

export default function KitsLabPage() {
  const [active, setActive] = useState<(typeof KITS)[number]["id"]>(
    KITS[0].id,
  );
  const current = KITS.find((item) => item.id === active) ?? KITS[0];
  const Demo = current.Demo;

  return (
    <div className="flex min-h-full flex-col bg-[#12151c] text-milk">
      <header className="shrink-0 px-5 pt-5 pb-3 md:px-8">
        <Link
          href="/"
          className="font-sans text-sm text-fog underline-offset-4 hover:text-milk hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-whey"
        >
          Volver al inicio
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-milk md:text-4xl">
          Laboratorio de kits
        </h1>
        <p className="mt-2 max-w-[52ch] font-sans text-sm leading-relaxed text-fog">
          Demos de fábrica de Magic UI, Aceternity y Skiper. Una pestaña por
          componente. No es el sitio oficial de Cheese Studio.
        </p>

        <div className="mt-4">
          <p className="mb-1.5 font-sans text-xs text-fog">Componentes</p>
          <div
            role="tablist"
            aria-label="Kits"
            className="flex flex-wrap gap-px border border-border bg-border"
          >
            {KITS.map((item) => {
              const selected = item.id === current.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`kits-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls="kits-stage"
                  className={cn(
                    "px-3.5 py-2 font-heading text-sm tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-whey",
                    selected
                      ? "bg-whey text-ink"
                      : "bg-dusk text-milk hover:bg-ink",
                  )}
                  onClick={() => setActive(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <section
        id="kits-stage"
        role="tabpanel"
        aria-labelledby={`kits-tab-${current.id}`}
        className={cn(
          "min-h-[60vh] flex-1 border-t border-border",
          current.id === "smooth-cursor" && "cursor-none",
        )}
      >
        <div
          className={cn(
            "flex w-full justify-center",
            current.id === "skiper19" || current.id === "timeline"
              ? "block"
              : "p-6",
          )}
        >
          <Demo />
        </div>
      </section>

      <footer className="shrink-0 border-t border-border px-5 py-3 font-sans text-xs text-fog md:px-8">
        Skiper UI components used with attribution.{" "}
        <a
          href="https://skiper-ui.com"
          className="underline underline-offset-4 hover:text-milk"
        >
          skiper-ui.com
        </a>
      </footer>
    </div>
  );
}
