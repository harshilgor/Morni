"use client";

// TEMPORARY LOCAL-ONLY PREVIEW: remove this route after header UX review.
// It must stay independent of ShopLayout, authentication, cart state, and Supabase.
import { useEffect, useState } from "react";

const navItems = ["Home", "For you", "Categories", "Occasions", "Stores", "Under AED 99"];
const searchSuggestions = [
  '"stores"',
  '"items under AED 99"',
  '"kurtis"',
  '"lehengas"',
];

export default function HeaderPreviewPage() {
  const [active, setActive] = useState("Home");
  const [searchIndex, setSearchIndex] = useState(0);
  const [previousSearchSuggestion, setPreviousSearchSuggestion] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setSearchIndex((index) => {
      setPreviousSearchSuggestion(searchSuggestions[index]);
      return (index + 1) % searchSuggestions.length;
    }), 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!previousSearchSuggestion) return;
    const timer = window.setTimeout(() => setPreviousSearchSuggestion(null), 460);
    return () => window.clearTimeout(timer);
  }, [previousSearchSuggestion]);

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#2a1f24]">
      <p className="border-b border-[#ead9df] bg-white px-4 py-2 text-center text-xs font-semibold tracking-[0.12em] text-[#8f3d58] uppercase">Morni header UI preview</p>
      <header className="sticky top-0 z-20 shadow-sm">
        <div className="bg-[#1c1418] text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
            <span className="font-display text-3xl">Morni</span>
            <button className="hidden items-center gap-2 text-left sm:flex" type="button"><span className="text-lg">⌖</span><span><span className="block text-[10px] text-white/60">Deliver to</span><span className="text-sm font-semibold">Dubai Marina</span></span></button>
            <form className="order-3 flex w-full overflow-hidden rounded-md bg-white sm:order-none sm:ml-3 sm:flex-1" onSubmit={(event) => event.preventDefault()}>
              <div className="relative min-w-0 flex-1">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="" className="min-w-0 w-full px-3 py-2.5 text-sm font-medium text-[#2a1f24] outline-none" aria-label="Search Morni preview" />
                {query.length === 0 ? (
                  <span className="pointer-events-none absolute inset-y-0 left-3 right-3 text-sm font-medium text-[#5c4a50]/90">
                    <span className="absolute inset-y-0 left-0 flex items-center">Search for</span>
                    <span className="absolute inset-y-0 left-[4.8rem] right-0 overflow-hidden">
                      {previousSearchSuggestion ? <span key={`out-${previousSearchSuggestion}`} className="morni-preview-search-out absolute inset-y-0 left-0 flex items-center whitespace-nowrap">{previousSearchSuggestion}</span> : null}
                      <span key={`in-${searchSuggestions[searchIndex]}`} className="morni-preview-search-in absolute inset-y-0 left-0 flex items-center whitespace-nowrap">{searchSuggestions[searchIndex]}</span>
                    </span>
                  </span>
                ) : null}
              </div>
              <button type="submit" className="bg-[#c45b7a] px-4 text-lg text-white" aria-label="Search">⌕</button>
            </form>
            <div className="ml-auto flex items-center gap-4 text-sm"><span className="hidden leading-tight md:block"><span className="block text-[10px] text-white/60">Hello, guest</span><span className="font-semibold">Account &amp; Lists</span></span><button aria-label="Wishlist">♡</button><button aria-label="Cart">Bag <sup className="rounded-full bg-[#c45b7a] px-1.5 py-0.5 text-[10px]">2</sup></button></div>
          </div>
        </div>
        <div className="border-b border-[#e7f1eb] bg-[#2a1f24]">
          <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:gap-7 sm:px-6" aria-label="Preview navigation">
            {navItems.map((item) => {
              const selected = active === item;
              return <button key={item} type="button" onClick={() => setActive(item)} className={`relative shrink-0 px-0.5 py-1 text-sm font-semibold transition-colors after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-5 after:-translate-x-1/2 after:rounded-full after:transition-transform after:duration-300 ${selected ? "text-[#f3b6c6] after:scale-x-100 after:bg-[#d997ab]" : "text-white/80 after:scale-x-0 after:bg-[#9ac653] hover:text-[#b6d874] hover:after:scale-x-100"}`}>{item}</button>;
            })}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8f3d58]">UI-only preview</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl leading-none sm:text-6xl">A softer, more botanical way to browse.</h1>
        <p className="mt-5 max-w-xl text-[#6b5a60]">This isolated page intentionally uses no authentication, store data, cart state, or Supabase calls. Try the navigation pills and search field above.</p>
      </section>
      <style jsx>{`
        .morni-preview-search-in { animation: morni-preview-search-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .morni-preview-search-out { animation: morni-preview-search-out 420ms cubic-bezier(0.4, 0, 1, 1) both; }
        @keyframes morni-preview-search-in { from { opacity: 0; transform: translateY(115%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes morni-preview-search-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-115%); } }
      `}</style>
    </main>
  );
}
