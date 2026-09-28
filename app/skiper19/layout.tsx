import type { Metadata } from "next";

import { Skiper19OverflowUnlock } from "./overflow-unlock";

export const metadata: Metadata = {
  title: "Skiper19 — Svg follow scroll",
  description:
    "Lab page for Skiper UI skiper19. Not the official Cheese Studio or Skiper UI site.",
};

export default function Skiper19Layout({
  children,
}: LayoutProps<"/skiper19">) {
  return (
    <>
      <Skiper19OverflowUnlock />
      {children}
    </>
  );
}
