import Image from "next/image";

import { CheeseStudioLogo } from "@/components/CheeseStudioLogo";
import { JoseAsciiBust } from "@/components/JoseAsciiBust";
import { Blaze } from "@/components/canvasui/Blaze";
import { FlameXTorch } from "@/components/previews/FlameXTorch";
import { MouseRest } from "@/components/mouse/MouseRest";

export default function Home() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div data-layer="0" className="absolute inset-0" style={{ zIndex: 0 }}>
        <Image
          src="/background.jpg"
          alt=""
          fill
          sizes="100vw"
          preload
          className="object-cover"
        />
      </div>

      <div
        data-layer="1"
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: 1 }}
      >
        <Blaze
          height={0.62}
          distortion={0.3}
          distortionScale={0.7}
          speed={1.5}
          sparks={1}
          sparkDensity={1.5}
          sparkSize={1}
          layers={2}
          smoke={0.5}
          glow={2}
          sparkColor={[1, 0.4, 0.051]}
          smokeColor={[1, 0.4314, 0.102]}
          style={{ width: "100%", height: "100%" }}
        >
          {null}
        </Blaze>
      </div>

      <div
        data-layer="2"
        className="absolute inset-0 flex items-center justify-center overflow-visible px-4 py-16 md:px-8"
        style={{ zIndex: 2 }}
        aria-label="Cheese Studio y José Ramón Teca. Arrastrá cada objeto para orbitar."
      >
        <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-2 overflow-visible md:flex-row md:gap-8">
          <div
            className="relative size-[min(46vw,26dvh)] min-h-[140px] min-w-[140px] shrink-0 md:size-[min(36vw,46dvh)]"
            role="img"
            aria-label="Logo de Cheese Studio, ratón de queso en vidrio."
          >
            <CheeseStudioLogo />
          </div>
          <div className="flex shrink-0 flex-col items-center overflow-visible">
            <FlameXTorch />
          </div>
          <div
            className="relative size-[min(52vw,30dvh)] min-h-[140px] min-w-[140px] shrink-0 md:size-[min(38vw,50dvh)]"
            role="img"
            aria-label="Retrato en ASCII de José Ramón Teca. Arrastrá para orbitar."
          >
            <JoseAsciiBust />
          </div>
        </div>
      </div>

      <div
        data-layer="3"
        className="pointer-events-none absolute inset-0 flex flex-col"
        style={{ zIndex: 3 }}
      >
        <header className="flex items-center justify-between px-6 py-4">
          <nav
            aria-label="Principal"
            className="pointer-events-auto flex gap-4 text-sm"
          >
            <a href="#inicio">Inicio</a>
            <a href="#seccion">Sección</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </header>

        <main id="inicio" className="flex-1" />

        <MouseRest className="pointer-events-auto mx-auto w-[6.6rem] md:w-[8.7rem]" />

        <footer className="px-6 pb-3 pt-1 text-center text-sm">
          <p className="pointer-events-auto">Pie</p>
        </footer>
      </div>
    </div>
  );
}
