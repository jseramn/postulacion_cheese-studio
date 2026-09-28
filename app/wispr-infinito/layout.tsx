import type { Metadata } from "next";

import { WisprFlowOverflowUnlock } from "@/app/wispr-flow/overflow-unlock";

export const metadata: Metadata = {
  title: "Wispr infinito — Trazo de texto",
  description:
    "Lab: texto de Wispr Flow sobre un trazo infinito dibujado por scroll. No es el sitio oficial de Cheese Studio.",
};

export default function WisprInfinitoLayout({
  children,
}: LayoutProps<"/wispr-infinito">) {
  return (
    <>
      <WisprFlowOverflowUnlock />
      {children}
    </>
  );
}
