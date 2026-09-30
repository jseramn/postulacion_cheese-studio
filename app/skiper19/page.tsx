import Link from "next/link";

import { Skiper19 } from "@/components/ui/skiper-ui/skiper19";

export default function Skiper19Page() {
  return (
    <div className="relative bg-[#FAFDEE] text-[#1F3A4B]">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-4 px-5 py-4 md:px-8">
        <nav className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-sm">
          <Link
            href="/"
            className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F3A4B]"
          >
            Volver al inicio
          </Link>
        </nav>
      </header>
      <Skiper19 />
    </div>
  );
}
