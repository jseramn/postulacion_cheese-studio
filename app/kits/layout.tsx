import type { Metadata } from "next";

import { KitsOverflowUnlock } from "./overflow-unlock";

export const metadata: Metadata = {
  title: "Kits lab",
  description:
    "Demos de fábrica de Magic UI, Aceternity y Skiper. No es el sitio oficial de Cheese Studio.",
};

export default function KitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <KitsOverflowUnlock />
      {children}
    </>
  );
}
