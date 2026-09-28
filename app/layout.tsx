import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";

import { cn } from "@/lib/utils";

import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "Un ratón de agujeros",
  description:
    "Homenaje original: un ratón cuyo cuerpo es un queso suizo. No es el sitio oficial de Cheese Studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={cn(syne.variable, figtree.variable, "h-full overflow-hidden")}
    >
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
