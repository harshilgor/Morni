import Link from "next/link";

const PRICE_CHIPS = [
  { label: "Under AED 99", href: "/search?max=99" },
  { label: "Under AED 199", href: "/search?max=199" },
  { label: "Luxury picks", href: "/search?min=500" },
  { label: "New in", href: "/search?sort=new" },
  { label: "Best rated", href: "/search?sort=rated" },
  { label: "In stock", href: "/search?instock=1" },
];

export function HomeDiscovery() {
  return (
    <section className="mx-auto max-w-6xl space-y-5 px-4 pt-8 sm:px-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Shop by intent
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PRICE_CHIPS.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="shrink-0 rounded-full border border-line bg-white/80 px-3.5 py-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-white"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
