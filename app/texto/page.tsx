"use client";

import Link from "next/link";
import { useState } from "react";

import {
  TEXT_PRESETS,
  type TextPreset,
  type TextPresetGroup,
} from "@/components/text/presets";
import { TextStage } from "@/components/text/TextStage";
import { cn } from "@/lib/utils";

const DEFAULT_SAMPLE = "Un ratón de agujeros";
const DEFAULT_ACTIVE =
  TEXT_PRESETS.find((item) => item.group === "queso")?.id ?? TEXT_PRESETS[0].id;

function PresetTablist({
  group,
  label,
  active,
  onSelect,
}: {
  group: TextPresetGroup;
  label: string;
  active: string;
  onSelect: (id: string) => void;
}) {
  const items = TEXT_PRESETS.filter((item) => item.group === group);
  return (
    <div>
      <p className="mb-1.5 font-sans text-xs text-fog">{label}</p>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-px border border-border bg-border"
      >
        {items.map((item: TextPreset) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`texto-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="texto-stage"
              className={cn(
                "px-3.5 py-2 font-heading text-sm tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-whey",
                selected
                  ? "bg-whey text-ink"
                  : "bg-dusk text-milk hover:bg-ink",
              )}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TextoLabPage() {
  const [active, setActive] = useState(DEFAULT_ACTIVE);
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [replay, setReplay] = useState(0);
  const current =
    TEXT_PRESETS.find((item) => item.id === active) ?? TEXT_PRESETS[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#12151c] text-milk">
      <header className="shrink-0 px-5 pt-5 pb-3 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <Link
              href="/"
              className="font-sans text-sm text-fog underline-offset-4 hover:text-milk hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-whey"
            >
              Volver al inicio
            </Link>
            <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-milk md:text-4xl">
              Laboratorio de texto
            </h1>
            <p className="mt-2 max-w-[42ch] font-sans text-sm leading-relaxed text-fog">
              Ideas de tipo para el homenaje del ratón de agujeros. No es el
              sitio oficial de Cheese Studio.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <PresetTablist
              group="mecanica"
              label="Mecánica"
              active={active}
              onSelect={setActive}
            />
            <PresetTablist
              group="queso"
              label="Queso"
              active={active}
              onSelect={setActive}
            />
            <PresetTablist
              group="super"
              label="Super cheese"
              active={active}
              onSelect={setActive}
            />
            <p className="font-sans text-xs text-fog" aria-live="polite">
              {current.hint}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="texto-sample"
              className="font-sans text-xs text-fog"
            >
              Texto
            </label>
            <input
              id="texto-sample"
              value={sample}
              onChange={(event) => setSample(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full border border-border bg-dusk px-3 py-2 font-sans text-sm text-milk placeholder:text-fog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-whey"
            />
          </div>
          <button
            type="button"
            className="border border-border bg-dusk px-4 py-2 font-heading text-sm tracking-tight text-milk hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-whey active:scale-[0.98]"
            onClick={() => setReplay((n) => n + 1)}
          >
            De nuevo
          </button>
        </div>
      </header>

      <section
        id="texto-stage"
        role="tabpanel"
        aria-labelledby={`texto-tab-${current.id}`}
        className="min-h-0 flex-1 border-t border-border"
      >
        <TextStage
          key={`${current.id}-${replay}-${sample}`}
          preset={current}
          text={sample}
        />
      </section>
    </div>
  );
}
