import Link from "next/link";

const SIZE_OPTIONS = [
  { label: "Free Size", tone: "bg-[#e7e1ee]", accent: "text-[#705b82]" },
  { label: "S", tone: "bg-[#e4e9f5]", accent: "text-[#52688f]" },
  { label: "M", tone: "bg-[#f2e6c9]", accent: "text-[#9a7431]" },
  { label: "L", tone: "bg-[#dbeae5]", accent: "text-[#2f6f66]" },
  { label: "XL", tone: "bg-[#f4ddd1]", accent: "text-[#a6583d]" },
  { label: "2XL", tone: "bg-[#f1e0d7]", accent: "text-[#a35b43]" },
  { label: "3XL", tone: "bg-[#e4e0f1]", accent: "text-[#675786]" },
  { label: "4XL", tone: "bg-[#dce9ed]", accent: "text-[#3d7180]" },
] as const;

export function ShopBySize() {
  return (
    <section className="border-y border-[#e4d9dc] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="shop-section-title">Shop by size</h2>
          </div>
          <Link
            href="/search"
            className="shrink-0 text-xs font-medium text-accent-deep hover:underline sm:text-sm"
          >
            View all
          </Link>
        </div>

        <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
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
                <span className="relative flex min-h-[9rem] items-center justify-center">
                <span className={`block font-display text-4xl font-bold leading-none tracking-[-0.06em] ${size.accent}`}>
                  {size.label}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
