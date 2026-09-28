import type { Metadata } from "next";

import { WisprFlowOverflowUnlock } from "./overflow-unlock";

export const metadata: Metadata = {
  title: "Wispr Flow — Text animation",
  description:
    "Lab page for Aceternity UI Wispr Flow text animation. Not the official Cheese Studio or Wispr site.",
};

export default function WisprFlowLayout({
  children,
}: LayoutProps<"/wispr-flow">) {
  return (
    <>
      <WisprFlowOverflowUnlock />
      {children}
    </>
  );
}
