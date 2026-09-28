import Image from "next/image";
import type { Metadata } from "next";

import { ScrollLab } from "@/components/scroll/ScrollLab";

export const metadata: Metadata = {
  title: "Scroll lab",
  description:
    "Homenaje original: letras sobre un sendero. No es el sitio oficial de Cheese Studio.",
};

export default function ScrollPage() {
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
      <div className="relative h-full min-h-0" style={{ zIndex: 1 }}>
        <ScrollLab />
      </div>
    </div>
  );
}
