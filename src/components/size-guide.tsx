"use client";

import { useEffect, useState } from "react";

type Unit = "cm" | "in";

type SizeRow = {
  size: string;
  ukIndia: string;
  us: string;
  bust: Record<Unit, string>;
  waist: Record<Unit, string>;
  hips: Record<Unit, string>;
};

const SIZE_ROWS: SizeRow[] = [
  {
    size: "XXS",
    ukIndia: "4–6",
    us: "0",
    bust: { in: "33\"", cm: "84 cm" },
    waist: { in: "24–25\"", cm: "61–64 cm" },
    hips: { in: "34–35\"", cm: "86–89 cm" },
  },
  {
    size: "XS",
    ukIndia: "6–8",
    us: "2",
    bust: { in: "34\"", cm: "86 cm" },
    waist: { in: "25–26\"", cm: "64–66 cm" },
    hips: { in: "35–36\"", cm: "89–91 cm" },
  },
  {
    size: "S",
    ukIndia: "8",
    us: "4–6",
    bust: { in: "35–36\"", cm: "86–89 cm" },
    waist: { in: "26–27\"", cm: "66–69 cm" },
    hips: { in: "36–37\"", cm: "91–94 cm" },
  },
  {
    size: "M",
    ukIndia: "10–12",
    us: "6–8",
    bust: { in: "37–38\"", cm: "91–94 cm" },
    waist: { in: "28–30\"", cm: "71–74 cm" },
    hips: { in: "38–39\"", cm: "97–99 cm" },
  },
  {
    size: "L",
    ukIndia: "14",
    us: "10",
    bust: { in: "39–41\"", cm: "97–102 cm" },
    waist: { in: "31–34\"", cm: "76–81 cm" },
    hips: { in: "40–42\"", cm: "102–107 cm" },
  },
  {
    size: "XL",
    ukIndia: "16",
    us: "12",
    bust: { in: "42–44\"", cm: "104–109 cm" },
    waist: { in: "35–38\"", cm: "84–89 cm" },
    hips: { in: "43–46\"", cm: "109–114 cm" },
  },
  {
    size: "XXL",
    ukIndia: "18",
    us: "14",
    bust: { in: "45–47\"", cm: "112–117 cm" },
    waist: { in: "39–42\"", cm: "91–97 cm" },
    hips: { in: "47–49\"", cm: "117–122 cm" },
  },
  {
    size: "XXXL",
    ukIndia: "20–22",
    us: "16–18",
    bust: { in: "47–49\"", cm: "119–124 cm" },
    waist: { in: "43–47\"", cm: "99–107 cm" },
    hips: { in: "49–52\"", cm: "124–132 cm" },
  },
];

const MEASUREMENT_HELP = [
  ["Bust", "Measure around the fullest part of your bust."],
  ["Waist", "Measure around the narrowest part of your natural waist."],
  ["Hips", "Measure around the fullest part of your hips."],
] as const;

function RulerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M4 8.5 8.5 4 20 15.5 15.5 20 4 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m10 8 2 2m1-5 2 2m-8 4 2 2m4 1 2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SizeGuide({ customChartUrl, storeName }: { customChartUrl?: string | null; storeName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>("cm");

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 border-b border-ink pb-1 text-sm font-medium text-ink transition hover:border-accent-deep hover:text-accent-deep"
      >
        <RulerIcon />
        Size guide
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={() => setIsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            aria-describedby="size-guide-description"
            className="max-h-[92dvh] w-full overflow-y-auto bg-[#fcfaf8] shadow-[0_28px_80px_-28px_rgba(28,20,24,0.8)] sm:mx-auto sm:max-w-5xl sm:rounded-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-[#fcfaf8]/95 px-5 py-5 backdrop-blur sm:px-8 sm:py-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-deep">
                  Morni fit guide
                </p>
                <h2 id="size-guide-title" className="mt-1 font-display text-3xl text-ink sm:text-4xl">
                  Find your best fit
                </h2>
                <p id="size-guide-description" className="mt-1 text-sm text-muted">
                  Women&apos;s body measurements for tops, dresses and outerwear.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-xl text-muted transition hover:border-ink hover:text-ink"
                aria-label="Close size guide"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl text-ink">Body measurements</h3>
                  <p className="mt-1 text-sm text-muted">Measure your body, not the garment, for the closest match.</p>
                </div>
                <div className="inline-flex border border-line bg-surface p-1 text-xs font-semibold uppercase tracking-[0.1em]">
                  {(["cm", "in"] as Unit[]).map((nextUnit) => (
                    <button
                      key={nextUnit}
                      type="button"
                      onClick={() => setUnit(nextUnit)}
                      aria-pressed={unit === nextUnit}
                      className={`px-3 py-2 transition ${
                        unit === nextUnit
                          ? "bg-ink text-white"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {nextUnit === "cm" ? "Centimetres" : "Inches"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto border border-line bg-white">
                <table className="min-w-[46rem] w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f1e8e2] text-xs font-semibold uppercase tracking-[0.1em] text-ink">
                    <tr>
                      <th scope="col" className="px-4 py-3">Morni size</th>
                      <th scope="col" className="px-4 py-3">UK / India</th>
                      <th scope="col" className="px-4 py-3">US</th>
                      <th scope="col" className="px-4 py-3">Bust</th>
                      <th scope="col" className="px-4 py-3">Waist</th>
                      <th scope="col" className="px-4 py-3">Hips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIZE_ROWS.map((row) => (
                      <tr key={row.size} className="border-t border-line text-ink odd:bg-[#fdfbf9]">
                        <th scope="row" className="px-4 py-3 font-display text-lg">{row.size}</th>
                        <td className="px-4 py-3">{row.ukIndia}</td>
                        <td className="px-4 py-3">{row.us}</td>
                        <td className="px-4 py-3">{row.bust[unit]}</td>
                        <td className="px-4 py-3">{row.waist[unit]}</td>
                        <td className="px-4 py-3">{row.hips[unit]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {customChartUrl ? (
                <div className="mt-8 border border-line bg-white p-4">
                  <h3 className="font-display text-2xl text-ink">{storeName ?? "Boutique"} size chart</h3>
                  <p className="mt-1 text-sm text-muted">Use this boutique&apos;s own sizing reference for the item.</p>
                  <div className="mt-4 overflow-x-auto">
                    {/* The uploaded chart is intentionally shown at its natural ratio so measurements remain legible. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={customChartUrl} alt={`${storeName ?? "Store"} size chart`} className="mx-auto max-h-[32rem] w-auto max-w-full object-contain" />
                  </div>
                </div>
              ) : null}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {MEASUREMENT_HELP.map(([title, description], index) => (
                  <div key={title} className="border border-line bg-white p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
                      0{index + 1}
                    </span>
                    <h3 className="mt-1 font-display text-xl text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-l-2 border-accent bg-[#fff3f5] px-4 py-3 text-sm leading-relaxed text-ink">
                Sizing can vary by boutique and silhouette. If you&apos;re between sizes, choose the larger size for a relaxed fit.
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
