import Link from "next/link";

const COLLECTIONS = [
  {
    title: "Wedding guest",
    subtitle: "Statement lehengas and festive sets for the season.",
    href: "/categories/lehengas",
    image:
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&q=80",
    tone: "#8f3d58",
  },
  {
    title: "Workwear kurtis",
    subtitle: "Polished everyday looks under an hour to your door.",
    href: "/categories/kurtis",
    image:
      "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=1200&q=80",
    tone: "#2f6f66",
  },
  {
    title: "Party night",
    subtitle: "Bold silhouettes for dinner, celebrations, and nights out.",
    href: "/categories/party-wear",
    image:
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80",
    tone: "#c45b7a",
  },
  {
    title: "Sharara sets",
    subtitle: "Flowing silhouettes with festive embroidery.",
    href: "/categories/shararas",
    image:
      "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=1200&q=80",
    tone: "#b06a3b",
  },
  {
    title: "Salwar suits",
    subtitle: "Classic suits tailored for daily wear and events.",
    href: "/categories/salwar-kameez",
    image:
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200&q=80",
    tone: "#5c6b8a",
  },
  {
    title: "Indo-western",
    subtitle: "Modern fusion pieces that travel from work to dinner.",
    href: "/categories/indo-western",
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80",
    tone: "#7a5aa0",
  },
];

export function HomeCollections() {
  return (
    <section className="w-full py-12">
      <div className="mx-auto mb-6 max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl text-ink">Shop the edit</h2>
        <p className="mt-1 text-sm text-muted">
          Curated collections from local UAE boutiques.
        </p>
      </div>
      <div className="grid w-full grid-cols-2 gap-px border-y border-[#e8e8e8] bg-[#e8e8e8] md:grid-cols-3 xl:grid-cols-6">
        {COLLECTIONS.map((collection) => (
          <Link
            key={collection.title}
            href={collection.href}
            className="group relative min-h-[300px] overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={collection.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: collection.tone }}
              >
                Collection
              </p>
              <h3 className="mt-1.5 font-display text-2xl leading-tight text-white">
                {collection.title}
              </h3>
              <p className="mt-1.5 text-xs text-white/85">
                {collection.subtitle}
              </p>
              <span className="mt-3 inline-flex bg-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                Explore
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
