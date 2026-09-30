import Link from "next/link";

export function Skiper19Demo() {
  return (
    <div className="flex min-h-[50vh] flex-col items-start justify-center gap-3 p-6">
      <p className="font-heading text-2xl tracking-tight text-milk">
        Svg follow scroll
      </p>
      <p className="max-w-[46ch] font-sans text-sm leading-relaxed text-fog">
        Skiper19 needs a full-page scroll track. Open the dedicated lab instead
        of embedding the stroke inside this gallery.
      </p>
      <Link
        href="/skiper19"
        className="font-sans text-sm text-whey underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-whey"
      >
        Abrir /skiper19
      </Link>
    </div>
  );
}
