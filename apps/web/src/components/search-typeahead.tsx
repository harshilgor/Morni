"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAed } from "@/lib/format";

type Suggestion = {
  type: "store" | "product";
  id: string;
  label: string;
  meta: string;
  href: string;
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchTypeahead({
  placeholder,
}: {
  placeholder: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      const supabase = createClient();
      const [{ data: stores }, { data: products }] = await Promise.all([
        supabase
          .from("stores")
          .select("id, name, slug, area, emirate")
          .eq("is_active", true)
          .or(`name.ilike.%${q}%,area.ilike.%${q}%`)
          .limit(4),
        supabase
          .from("products")
          .select("id, title, price_aed, stores!inner(slug, name, is_active)")
          .eq("is_available", true)
          .eq("stores.is_active", true)
          .ilike("title", `%${q}%`)
          .limit(5),
      ]);

      if (cancelled) return;

      const productRows = (products ?? []) as unknown as {
        id: string;
        title: string;
        price_aed: number;
        stores: { slug: string; name: string } | { slug: string; name: string }[];
      }[];

      const next: Suggestion[] = [
        ...((stores ?? []) as {
          id: string;
          name: string;
          slug: string;
          area: string;
        }[]).map((store) => ({
          type: "store" as const,
          id: store.id,
          label: store.name,
          meta: store.area,
          href: `/stores/${store.slug}`,
        })),
        ...productRows.map((product) => {
          const store = Array.isArray(product.stores)
            ? product.stores[0]
            : product.stores;
          return {
            type: "product" as const,
            id: product.id,
            label: product.title,
            meta: `${store?.name ?? "Store"} · ${formatAed(product.price_aed)}`,
            href: `/stores/${store?.slug ?? "store"}/products/${product.id}`,
          };
        }),
      ];

      setSuggestions(next);
      setLoading(false);
      setOpen(true);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <form
        onSubmit={onSearch}
        className="flex overflow-hidden rounded-md bg-white shadow-sm ring-2 ring-transparent focus-within:ring-accent"
      >
        <label className="sr-only" htmlFor="morni-search">
          Search Morni
        </label>
        <input
          id="morni-search"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
          autoComplete="off"
        />
        <button
          type="submit"
          className="flex items-center justify-center bg-accent px-3.5 text-white transition hover:bg-accent-deep sm:px-4"
          aria-label="Search"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      </form>

      {open && (loading || suggestions.length > 0 || query.trim().length >= 2) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-[0_20px_50px_-20px_rgba(28,20,24,0.55)]">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">
              No quick matches — press enter to search all.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {suggestions.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-background"
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.type === "store" ? "Store" : "Product"} · {item.meta}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="w-full border-t border-line px-4 py-2.5 text-left text-sm text-accent-deep hover:bg-background"
            >
              Search all for “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
