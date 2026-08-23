import Link from "next/link";

const SIZE_OPTIONS = [
  { label: "XS", detail: "Petite fits", tone: "bg-[#f3dfe6]", accent: "text-[#9d5369]" },
  { label: "S", detail: "Easy everyday fits", tone: "bg-[#e4e9f5]", accent: "text-[#52688f]" },
  { label: "M", detail: "Most-loved fits", tone: "bg-[#f2e6c9]", accent: "text-[#9a7431]" },
  { label: "L", detail: "Room to move", tone: "bg-[#dbeae5]", accent: "text-[#2f6f66]" },
  { label: "XL", detail: "Relaxed fits", tone: "bg-[#f4ddd1]", accent: "text-[#a6583d]" },
  { label: "Free size", detail: "Made to flex", tone: "bg-[#e7e1ee]", accent: "text-[#705b82]" },
] as const;

export function ShopBySize() {
  return (
    <section className="border-y border-[#e4d9dc] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-deep">
              Find your fit
            </p>
            <h2 className="mt-2 shop-section-title">Shop by size</h2>
            <p className="shop-section-copy">
              Start with your size, then discover pieces from local boutiques.
            </p>
          </div>
          <Link
            href="/search"
            className="shrink-0 text-xs font-medium text-accent-deep hover:underline sm:text-sm"
          >
            View all
          </Link>
        </div>

        <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {SIZE_OPTIONS.map((size) => (
            <Link
              key={size.label}
              href={`/search?size=${encodeURIComponent(size.label)}`}
              className={`group relative min-w-[9.5rem] overflow-hidden rounded-2xl border border-[#eadfe2] ${size.tone} p-4 transition duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_16px_28px_-22px_rgba(28,20,24,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:min-w-0 sm:p-4`}
            >
              <span
                aria-hidden
                className="absolute -right-7 -top-8 h-24 w-24 rounded-full border-[7px] border-white/65 transition duration-500 group-hover:scale-110"
              />
              <span
                aria-hidden
                className="absolute -bottom-10 -left-8 h-20 w-20 rounded-full bg-white/35"
              />
              <span className="relative flex min-h-[7.8rem] flex-col justify-between">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${size.accent}`}>
                  Size
                </span>
                <span>
                  <span className={`block font-display text-4xl font-bold leading-none tracking-[-0.06em] ${size.accent}`}>
                    {size.label}
                  </span>
                  <span className="mt-2 block max-w-[8rem] text-[11px] leading-tight text-ink/70">
                    {size.detail}
                  </span>
                </span>
                <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/65 transition group-hover:text-ink">
                  Explore <span aria-hidden>→</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
