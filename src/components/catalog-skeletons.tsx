export function CatalogSectionSkeleton() {
  return (
    <div className="animate-pulse space-y-10 py-8" aria-hidden>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto h-3 w-40 rounded bg-line/80" />
        <div className="mx-auto mt-4 h-10 w-72 max-w-full rounded bg-line/70" />
        <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[3/4] rounded-md bg-line/60" />
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="h-8 w-48 rounded bg-line/70" />
        <div className="mt-5 flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[4/5] w-36 shrink-0 rounded-xl bg-line/55 sm:w-44"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="min-w-0">
          <div className="aspect-[4/5] rounded-xl bg-line/60" />
          <div className="mt-3 h-3 w-4/5 rounded bg-line/70" />
          <div className="mt-2 h-3 w-1/3 rounded bg-line/55" />
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-[88rem] animate-pulse px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-16"
      aria-hidden
    >
      <div className="grid gap-7 lg:grid-cols-[auto_minmax(0,1.02fr)_minmax(19rem,0.62fr)]">
        <div className="hidden lg:block" />
        <div className="aspect-[4/5] rounded-2xl bg-line/60 lg:h-[34rem] lg:aspect-auto" />
        <div className="space-y-4">
          <div className="h-3 w-24 rounded bg-line/70" />
          <div className="h-10 w-4/5 rounded bg-line/65" />
          <div className="h-6 w-28 rounded bg-line/55" />
          <div className="mt-8 h-12 w-full rounded-full bg-line/60" />
        </div>
      </div>
    </div>
  );
}

export function SiteHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50" aria-hidden>
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <span className="font-display text-2xl tracking-tight text-white sm:text-[1.7rem]">
            Morni
          </span>
          <div className="hidden h-9 w-28 rounded-md bg-white/10 sm:block" />
          <div className="h-10 flex-1 rounded-md bg-white/10" />
          <div className="h-10 w-10 rounded-md bg-white/10" />
          <div className="h-10 w-10 rounded-md bg-white/10" />
        </div>
      </div>
      <div className="border-b border-[#e7f1eb] bg-[#2a1f24]">
        <div className="mx-auto flex max-w-7xl gap-6 px-3 py-3 sm:px-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-4 w-14 rounded bg-white/15" />
          ))}
        </div>
      </div>
    </header>
  );
}
