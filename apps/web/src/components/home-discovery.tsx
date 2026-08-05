import Link from "next/link";

const PRICE_CHIPS = [
  { label: "Under AED 99", href: "/search?max=99" },
  { label: "Under AED 199", href: "/search?max=199" },
  { label: "Luxury picks", href: "/search?min=500" },
  { label: "New in", href: "/search?sort=new" },
  { label: "Best rated", href: "/#top-rated" },
  { label: "In stock", href: "/search?instock=1" },
];

const OCCASIONS = [
  { label: "Wedding", href: "/categories/lehengas", hint: "Lehengas & festive" },
  { label: "Office", href: "/categories/kurtis", hint: "Everyday kurtis" },
  { label: "Brunch", href: "/categories/casual-wear", hint: "Easy silhouettes" },
  { label: "Party", href: "/categories/party-wear", hint: "Night-out looks" },
  { label: "Gifting", href: "/categories", hint: "Curated picks" },
  { label: "Indo-Western", href: "/categories/indo-western", hint: "Modern fusion" },
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

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Shop by occasion
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {OCCASIONS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-2xl border border-line bg-surface/80 px-3.5 py-3 transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-sm font-semibold text-ink">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted">{item.hint}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
