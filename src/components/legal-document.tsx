import Link from "next/link";

type LegalSection = { title: string; paragraphs: string[] };

export function LegalDocument({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
      <Link href="/" className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep hover:text-ink">
        ← Back to Morni
      </Link>
      <header className="mt-10 border-b border-line pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-muted">{intro}</p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{updated}</p>
      </header>
      <div className="mt-10 space-y-9 text-sm leading-7 text-ink/85 sm:text-base">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-2xl text-ink sm:text-3xl">{section.title}</h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
