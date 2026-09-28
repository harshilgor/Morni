import Image from "next/image";
import Link from "next/link";
import { PRODUCT_OCCASIONS } from "@/lib/product-occasions";

const OCCASION_CARDS = [
  {
    ...PRODUCT_OCCASIONS[0],
    image:
      "https://images.unsplash.com/photo-1651132176551-0b54d10f5ae7?auto=format&fit=crop&fm=jpg&q=85&w=1200",
    imageAlt: "Woman in festive red attire holding a diya for Diwali",
    photographer: "Manjishtha Mukherjee",
    photoHref: "https://unsplash.com/photos/a-woman-in-a-red-dress-rS9noOJNyxo",
    tone: "from-[#32140e]/85 via-[#32140e]/25",
  },
  {
    ...PRODUCT_OCCASIONS[1],
    image:
      "https://images.unsplash.com/photo-1774437890297-3e6d440695e8?auto=format&fit=crop&fm=jpg&q=85&w=1200",
    imageAlt: "Woman in a festive red sari with traditional jewelry",
    photographer: "Tanmay Abhay Mahajan",
    photoHref:
      "https://unsplash.com/photos/woman-in-red-sari-with-gold-jewelry-smiles-hOQRUMc6Avc",
    tone: "from-[#321014]/85 via-[#321014]/25",
  },
  {
    ...PRODUCT_OCCASIONS[2],
    image:
      "https://images.unsplash.com/photo-1774437897284-b2f7c4638c55?auto=format&fit=crop&fm=jpg&q=85&w=1200",
    imageAlt: "Women in colorful traditional clothing celebrating Navratri",
    photographer: "Tanmay Abhay Mahajan",
    photoHref:
      "https://unsplash.com/photos/women-in-colorful-saris-dancing-on-a-street-tJbu0oQTwac",
    tone: "from-[#211238]/85 via-[#211238]/25",
  },
] as const;

export function OccasionCards() {
  return (
    <section className="border-y border-[#e4d9dc] bg-[#fbf6f2]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-deep sm:text-xs">
              Dress for the moment
            </p>
            <h2 className="shop-section-title mt-1">Shop by occasion</h2>
          </div>
        </div>

        <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0">
          {OCCASION_CARDS.map((occasion) => (
            <Link
              key={occasion.value}
              href={`/search?occasion=${occasion.value}`}
              className="group relative aspect-[4/3] w-[78vw] max-w-[22rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-sand shadow-sm ring-1 ring-ink/10 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:aspect-[1.18/1] sm:w-auto sm:max-w-none"
            >
              <Image
                src={occasion.image}
                alt={occasion.imageAlt}
                fill
                sizes="(max-width: 639px) 78vw, (max-width: 1023px) 33vw, 380px"
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              <div
                className={`absolute inset-0 bg-gradient-to-t ${occasion.tone} to-transparent`}
              />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                <h3 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
                  {occasion.label}
                </h3>
                <span className="mt-2 inline-flex items-center gap-2 text-xs font-semibold sm:text-sm">
                  Explore the edit <span aria-hidden="true">&#8594;</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-2 text-[10px] text-muted sm:text-xs">
          Photos by{" "}
          {OCCASION_CARDS.map((occasion, index) => (
            <span key={occasion.value}>
              {index > 0 ? (index === OCCASION_CARDS.length - 1 ? " and " : ", ") : null}
              <a
                href={occasion.photoHref}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                {occasion.photographer}
              </a>
            </span>
          ))}{" "}
          on Unsplash.
        </p>
      </div>
    </section>
  );
}
