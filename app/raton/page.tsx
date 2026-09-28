"use client";

import Link from "next/link";
import { useState } from "react";

import { PathWalk } from "@/components/mouse/prototypes/PathWalk";
import { PointerIdle } from "@/components/mouse/prototypes/PointerIdle";
import { ScrollWalk } from "@/components/mouse/prototypes/ScrollWalk";
import { SpriteScrollKeys } from "@/components/mouse/prototypes/SpriteScrollKeys";
import { WalkCycle } from "@/components/mouse/prototypes/WalkCycle";
import { cn } from "@/lib/utils";

const prototypes = [
  {
    id: "walk",
    label: "Paso",
    hint: "El scroll avanza el ciclo. Subir mira arriba, bajar olfatea.",
    Stage: WalkCycle,
  },
  {
    id: "path",
    label: "Sendero",
    hint: "El scroll recorre el trazo y deja migas.",
    Stage: PathWalk,
  },
  {
    id: "scroll",
    label: "Recorrido",
    hint: "El scroll coloca al ratón en el plano. Sube o baja y se queda en esa pose.",
    Stage: ScrollWalk,
  },
  {
    id: "idle",
    label: "Reposo",
    hint: "La pose sigue al puntero. Clic para un salto.",
    Stage: PointerIdle,
  },
  {
    id: "sprites",
    label: "Frames",
    hint: "El scroll monta al ratón en el trazo. Sube mira arriba, baja olfatea, y se queda.",
    Stage: SpriteScrollKeys,
  },
] as const;

type PrototypeId = (typeof prototypes)[number]["id"];

export default function RatonLabPage() {
  const [active, setActive] = useState<PrototypeId>("sprites");
  const current = prototypes.find((item) => item.id === active) ?? prototypes[0];
  const Stage = current.Stage;

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
              Laboratorio del ratón
            </h1>
            <p className="mt-2 max-w-[42ch] font-sans text-sm leading-relaxed text-fog">
              Un ratón de perfil que camina con el scroll. Homenaje original,
              no es el sitio oficial de Cheese Studio.
            </p>
          </div>
          <div>
            <div
              role="tablist"
              aria-label="Prototipos de movimiento"
              className="flex flex-wrap gap-px border border-border bg-border"
            >
              {prototypes.map((item) => {
                const selected = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`raton-tab-${item.id}`}
                    aria-selected={selected}
                    aria-controls="raton-stage"
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
            <p
              className="mt-2 font-sans text-xs text-fog"
              aria-live="polite"
            >
              {current.hint}
            </p>
          </div>
        </div>
      </header>

      <section
        id="raton-stage"
        role="tabpanel"
        aria-labelledby={`raton-tab-${current.id}`}
        className="min-h-0 flex-1 border-t border-border"
      >
        <Stage key={current.id} />
      </section>
    </div>
  );
}
