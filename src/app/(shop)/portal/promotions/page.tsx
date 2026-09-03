"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { PortalEmpty, PortalMetric, PortalPageHeader } from "@/components/portal-ui";

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  promotion_kind: "sale" | "campaign";
  discount_type: "percent" | "flat_aed" | null;
  value_aed: number | null;
  value_percent: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  promotion_products?: { product_id: string }[];
};
type Product = {
  id: string;
  title: string;
  price_aed: number;
  stock: number;
  is_available: boolean;
  image_urls: string[] | null;
  categories?: { name: string; slug: string } | null;
};
type SaleForm = {
  id: string | null;
  title: string;
  description: string;
  discountType: "percent" | "flat_aed";
  value: string;
  startsAt: string;
  endsAt: string;
};
const emptySale: SaleForm = {
  id: null, title: "", description: "", discountType: "percent", value: "", startsAt: "", endsAt: "",
};
const money = (value: number) => "AED " + value.toFixed(2);
const localDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const status = (promo: Promotion) => {
  const now = Date.now();
  if (!promo.is_active) return "Paused";
  if (promo.ends_at && new Date(promo.ends_at).getTime() <= now) return "Ended";
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return "Upcoming";
  return "Live";
};

export default function PortalPromotionsPage() {
  const { store, loading, error } = useOwnerStore();
  const [tab, setTab] = useState<"sales" | "campaigns">("sales");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sale, setSale] = useState<SaleForm>(emptySale);
  const [selected, setSelected] = useState<string[]>([]);
  const [replace, setReplace] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [campaign, setCampaign] = useState({ id: null as string | null, title: "", description: "", startsAt: "", endsAt: "", active: true });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clock] = useState(() => Date.now());

  async function load(storeId: string) {
    const supabase = createClient();
    const [promoResult, productResult] = await Promise.all([
      supabase.from("store_promotions").select("*, promotion_products(product_id)").eq("store_id", storeId).order("created_at", { ascending: false }),
      supabase.from("products").select("id,title,price_aed,stock,is_available,image_urls,categories(name,slug)").eq("store_id", storeId).order("created_at", { ascending: false }),
    ]);
    if (promoResult.error) setMessage(promoResult.error.message);
    if (productResult.error) setMessage(productResult.error.message);
    setPromotions((promoResult.data as unknown as Promotion[]) ?? []);
    setProducts((productResult.data as unknown as Product[]) ?? []);
  }

  useEffect(() => {
    if (!store) return;
    const refresh = () => void load(store.id);
    queueMicrotask(refresh);
  }, [store]);

  const sales = promotions.filter((promo) => promo.promotion_kind === "sale");
  const campaigns = promotions.filter((promo) => promo.promotion_kind === "campaign");
  const categories = useMemo(() => Array.from(new Map(products.filter((p) => p.categories).map((p) => [p.categories!.slug, p.categories!.name])).entries()), [products]);
  const visible = useMemo(() => {
    const value = search.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = category === "all" || product.categories?.slug === category;
      return categoryMatch && (!value || product.title.toLowerCase().includes(value) || product.categories?.name.toLowerCase().includes(value));
    });
  }, [products, search, category]);
  const conflicts = useMemo(() => {
    const result: Record<string, Promotion> = {};
    sales.forEach((promo) => {
      if (promo.id === sale.id || !promo.is_active || (promo.ends_at && new Date(promo.ends_at).getTime() <= clock)) return;
      (promo.promotion_products ?? []).forEach(({ product_id }) => {
        if (selected.includes(product_id)) result[product_id] = promo;
      });
    });
    return result;
  }, [clock, sales, sale.id, selected]);
  const appliedProducts = selected.filter((id) => !conflicts[id] || replace[id]);
  const discount = Number(sale.value || 0);
  const reduced = (base: number) => Math.max(0.01, Math.round((sale.discountType === "percent" ? base * (1 - discount / 100) : base - discount) * 100) / 100);

  function resetSale() {
    setSale(emptySale);
    setSelected([]);
    setReplace({});
    setMessage(null);
  }
  function editSale(promo: Promotion) {
    setTab("sales");
    setSale({
      id: promo.id,
      title: promo.title,
      description: promo.description ?? "",
      discountType: promo.discount_type ?? "percent",
      value: String(promo.discount_type === "flat_aed" ? promo.value_aed ?? "" : promo.value_percent ?? ""),
      startsAt: localDate(promo.starts_at),
      endsAt: localDate(promo.ends_at),
    });
    setSelected((promo.promotion_products ?? []).map(({ product_id }) => product_id));
    setReplace({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleProduct(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveSale(event: FormEvent) {
    event.preventDefault();
    if (!store) return;
    if (!sale.title.trim() || discount <= 0 || (sale.discountType === "percent" && discount >= 100)) {
      setMessage("Give the sale a name and enter a discount greater than zero and below 100%.");
      return;
    }
    if (appliedProducts.length === 0) {
      setMessage("Choose products, or choose Apply new sale for each conflicting product.");
      return;
    }
    if (sale.endsAt && new Date(sale.endsAt) <= new Date(sale.startsAt || Date.now())) {
      setMessage("The end date must be after the start date.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error: saveError } = await supabase.rpc("save_product_sale", {
      p_promotion_id: sale.id,
      p_title: sale.title,
      p_discount_type: sale.discountType,
      p_discount_value: discount,
      p_starts_at: sale.startsAt ? new Date(sale.startsAt).toISOString() : null,
      p_ends_at: sale.endsAt ? new Date(sale.endsAt).toISOString() : null,
      p_product_ids: appliedProducts,
      p_replace_product_ids: Object.entries(replace).filter(([, enabled]) => enabled).map(([id]) => id),
    });
    if (!saveError) {
      await supabase.from("store_promotions").update({ description: sale.description.trim() || null }).eq("id", (data as Promotion).id);
    }
    setSaving(false);
    if (saveError) {
      setMessage(saveError.message);
      return;
    }
    resetSale();
    await load(store.id);
  }

  async function saveCampaign(event: FormEvent) {
    event.preventDefault();
    if (!store) return;
    if (campaign.endsAt && new Date(campaign.endsAt) <= new Date(campaign.startsAt || Date.now())) {
      setMessage("The campaign end date must be after its start date.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const payload = {
      title: campaign.title.trim(),
      description: campaign.description.trim() || null,
      promotion_kind: "campaign",
      promo_type: "category_sale",
      discount_type: null,
      value_percent: null,
      value_aed: null,
      starts_at: campaign.startsAt ? new Date(campaign.startsAt).toISOString() : null,
      ends_at: campaign.endsAt ? new Date(campaign.endsAt).toISOString() : null,
      is_active: campaign.active,
    };
    const request = campaign.id
      ? supabase.from("store_promotions").update(payload).eq("id", campaign.id)
      : supabase.from("store_promotions").insert({ ...payload, store_id: store.id });
    const { error: saveError } = await request;
    setSaving(false);
    if (saveError) {
      setMessage(saveError.message);
      return;
    }
    setCampaign({ id: null, title: "", description: "", startsAt: "", endsAt: "", active: true });
    await load(store.id);
  }

  async function setActive(promo: Promotion, active: boolean) {
    const { error: updateError } = await createClient().from("store_promotions").update({ is_active: active }).eq("id", promo.id).eq("store_id", store?.id ?? "");
    if (updateError) setMessage(updateError.message);
    if (store) await load(store.id);
  }
  async function remove(promo: Promotion) {
    if (!window.confirm('Delete "' + promo.title + '"? This cannot be undone.')) return;
    const { error: deleteError } = await createClient().from("store_promotions").delete().eq("id", promo.id).eq("store_id", store?.id ?? "");
    if (deleteError) setMessage(deleteError.message);
    if (store) await load(store.id);
  }

  if (error === "unauthenticated") return <PortalEmpty icon="promotions" title="Sign in to manage promotions" description="Use the owner account linked to your Morni store." action={{ label: "Sign in", href: "/auth?next=/portal/promotions" }} />;
  if (loading) return <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/65" />)}</div>;
  if (!store) return <PortalEmpty icon="store" title="Set up a store to create promotions" description="Launch your store first, then make sales and storefront campaigns for shoppers." action={{ label: "Start store setup", href: "/sell/setup" }} />;

  return (
    <div className="space-y-7">
      <PortalPageHeader eyebrow="Growth tools" title="Promotions" description="Build live product sales or a focused message for your storefront shoppers." />
      <div className="grid gap-3 sm:grid-cols-3"><PortalMetric label="Live promotions" value={String(promotions.filter((promotion) => status(promotion) === "Live").length)} detail="Currently visible to shoppers" icon="promotions" /><PortalMetric label="Scheduled" value={String(promotions.filter((promotion) => status(promotion) === "Upcoming").length)} detail="Ready to start automatically" icon="clock" /><PortalMetric label="Products on sale" value={String(sales.reduce((sum, promotion) => sum + (promotion.promotion_products?.length ?? 0), 0))} detail="Across your sales" icon="products" /></div>
      <div className="portal-card flex gap-1 p-1">
        <button type="button" onClick={() => setTab("sales")} className={"rounded-lg px-4 py-2.5 text-sm font-semibold transition " + (tab === "sales" ? "bg-[#21342e] text-white" : "text-[#66736e] hover:text-[#2f6f66]")}>Sales</button>
        <button type="button" onClick={() => setTab("campaigns")} className={"rounded-lg px-4 py-2.5 text-sm font-semibold transition " + (tab === "campaigns" ? "bg-[#21342e] text-white" : "text-[#66736e] hover:text-[#2f6f66]")}>Campaigns</button>
      </div>

      {tab === "sales" ? (
        <>
          <form onSubmit={saveSale} className="portal-card space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h2 className="font-display text-2xl text-ink">{sale.id ? "Edit sale" : "Create sale"}</h2><p className="mt-1 text-sm text-muted">Select products and preview the exact shopper price before publishing.</p></div>
              {sale.id ? <button type="button" onClick={resetSale} className="border border-line px-3 py-2 text-sm">Cancel edit</button> : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-muted">Sale name<input required className="mt-1 w-full border border-line bg-background px-3 py-2.5 text-ink" placeholder="e.g. Weekend edit" value={sale.title} onChange={(event) => setSale((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="text-sm text-muted">Discount<div className="mt-1 flex gap-2"><select className="border border-line bg-background px-3 py-2.5 text-ink" value={sale.discountType} onChange={(event) => setSale((current) => ({ ...current, discountType: event.target.value as SaleForm["discountType"] }))}><option value="percent">% off</option><option value="flat_aed">AED off</option></select><input required type="number" min="0.01" max={sale.discountType === "percent" ? 99.99 : undefined} step="0.01" className="min-w-0 flex-1 border border-line bg-background px-3 py-2.5 text-ink" placeholder={sale.discountType === "percent" ? "20" : "15"} value={sale.value} onChange={(event) => setSale((current) => ({ ...current, value: event.target.value }))} /></div></label>
              <label className="text-sm text-muted">Start<input type="datetime-local" className="mt-1 w-full border border-line bg-background px-3 py-2.5 text-ink" value={sale.startsAt} onChange={(event) => setSale((current) => ({ ...current, startsAt: event.target.value }))} /><span className="mt-1 block text-xs">Leave blank to start now.</span></label>
              <label className="text-sm text-muted">End<input type="datetime-local" className="mt-1 w-full border border-line bg-background px-3 py-2.5 text-ink" value={sale.endsAt} onChange={(event) => setSale((current) => ({ ...current, endsAt: event.target.value }))} /><span className="mt-1 block text-xs">Optional.</span></label>
              <label className="text-sm text-muted md:col-span-2">Internal note<textarea className="mt-1 min-h-20 w-full border border-line bg-background px-3 py-2.5 text-ink" placeholder="Optional note for your team" value={sale.description} onChange={(event) => setSale((current) => ({ ...current, description: event.target.value }))} /></label>
            </div>

            <section className="border-t border-line pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-medium text-ink">Choose products</h3><p className="mt-1 text-sm text-muted">{selected.length} selected. Product selection is a snapshot, so later products are not added automatically.</p></div>
                <button type="button" onClick={() => setSelected((current) => Array.from(new Set([...current, ...visible.map((product) => product.id)])))} className="border border-line px-3 py-2 text-sm">Select visible</button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className="border border-line bg-background px-3 py-2.5 text-sm" placeholder="Search products" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="border border-line bg-background px-3 py-2.5 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {visible.map((product) => {
                  const conflict = conflicts[product.id];
                  const active = selected.includes(product.id);
                  const next = reduced(product.price_aed);
                  return <div key={product.id} className={"border p-3 transition " + (active ? "border-ink bg-[#f8fbf9] shadow-sm" : "border-line")}>
                    <label className="flex cursor-pointer gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#21342e]" checked={active} onChange={() => toggleProduct(product.id)} /><span className="flex min-w-0 flex-1 gap-3"><span className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-[#f1f5f2]">{product.image_urls?.[0] ? <img src={product.image_urls[0]} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-muted">No image</span>}</span><span className="min-w-0 flex-1"><span className="block font-medium text-ink">{product.title}</span><span className="mt-1 block text-xs text-muted">{product.categories?.name ?? "Uncategorised"} · {product.is_available ? product.stock + " in stock" : "Unavailable"}</span><span className="mt-2 flex flex-wrap gap-x-2 text-sm"><span className="text-muted line-through">{money(product.price_aed)}</span><span className="font-medium text-ink">{money(next)}</span><span className="text-accent-deep">Save {money(product.price_aed - next)}</span></span></span></span></label>
                    {conflict ? <div className="mt-3 border-t border-line pt-3"><p className="text-sm text-muted">Already in <span className="font-medium text-ink">{conflict.title}</span>.</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => setReplace((current) => ({ ...current, [product.id]: true }))} className={"border px-3 py-1.5 text-xs " + (replace[product.id] ? "border-ink bg-ink text-white" : "border-line")}>Apply new sale</button><button type="button" onClick={() => setReplace((current) => ({ ...current, [product.id]: false }))} className={"border px-3 py-1.5 text-xs " + (!replace[product.id] ? "border-ink" : "border-line")}>Keep existing</button></div></div> : null}
                  </div>;
                })}
              </div>
              {!visible.length ? <p className="mt-4 text-sm text-muted">No products match those filters.</p> : null}
            </section>
            {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
            <button type="submit" disabled={saving} className="bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving..." : sale.id ? "Save sale" : "Publish sale"}</button>
          </form>
          <PromotionList promotions={sales} empty="No sales yet. Create one to show discounted prices to shoppers." onEdit={editSale} onToggle={setActive} onDelete={remove} />
        </>
      ) : (
        <>
          <form onSubmit={saveCampaign} className="portal-card space-y-4 p-5 sm:p-6">
            <div><h2 className="font-display text-2xl text-ink">{campaign.id ? "Edit campaign" : "Create campaign"}</h2><p className="mt-1 text-sm text-muted">Campaigns are a restrained message on this store&apos;s storefront and product pages. They never change prices.</p></div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-muted">Campaign title<input required className="mt-1 w-full border border-line bg-background px-3 py-2.5 text-ink" placeholder="e.g. Eid styles are here" value={campaign.title} onChange={(event) => setCampaign((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="flex items-center gap-2 pt-6 text-sm text-ink"><input type="checkbox" checked={campaign.active} onChange={(event) => setCampaign((current) => ({ ...current, active: event.target.checked }))} /> Enabled</label>
              <label className="text-sm text-muted">Start<input type="datetime-local" className="mt-1 w-full border border-line bg-background px-3 py-2.5 text-ink" value={campaign.startsAt} onChange={(event) => setCampaign((current) => ({ ...current, startsAt: event.target.value }))} /></label>
              <label className="text-sm text-muted">End<input type="datetime-local" className="mt-1 w-full border border-line bg-background px-3 py-2.5 text-ink" value={campaign.endsAt} onChange={(event) => setCampaign((current) => ({ ...current, endsAt: event.target.value }))} /></label>
              <label className="text-sm text-muted md:col-span-2">Supporting text<textarea className="mt-1 min-h-20 w-full border border-line bg-background px-3 py-2.5 text-ink" placeholder="Optional supporting text" value={campaign.description} onChange={(event) => setCampaign((current) => ({ ...current, description: event.target.value }))} /></label>
            </div>
            {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
            <div className="flex gap-2"><button type="submit" disabled={saving} className="bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving..." : campaign.id ? "Save campaign" : "Publish campaign"}</button>{campaign.id ? <button type="button" onClick={() => setCampaign({ id: null, title: "", description: "", startsAt: "", endsAt: "", active: true })} className="border border-line px-4 py-3 text-sm">Cancel edit</button> : null}</div>
          </form>
          <PromotionList promotions={campaigns} empty="No campaigns yet." onEdit={(promo) => { setCampaign({ id: promo.id, title: promo.title, description: promo.description ?? "", startsAt: localDate(promo.starts_at), endsAt: localDate(promo.ends_at), active: promo.is_active }); window.scrollTo({ top: 0, behavior: "smooth" }); }} onToggle={setActive} onDelete={remove} />
        </>
      )}
    </div>
  );
}

function PromotionList({ promotions, empty, onEdit, onToggle, onDelete }: { promotions: Promotion[]; empty: string; onEdit: (promo: Promotion) => void; onToggle: (promo: Promotion, active: boolean) => void; onDelete: (promo: Promotion) => void }) {
  return <section className="border border-line bg-surface p-5 sm:p-6"><h2 className="font-display text-2xl text-ink">Your promotions</h2>{!promotions.length ? <p className="mt-3 text-sm text-muted">{empty}</p> : <ul className="mt-4 space-y-3">{promotions.map((promo) => <li key={promo.id} className="flex flex-wrap items-center justify-between gap-4 border border-line p-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-ink">{promo.title}</p><span className="border border-line px-2 py-0.5 text-xs text-muted">{status(promo)}</span></div><p className="mt-1 text-sm text-muted">{promo.promotion_kind === "sale" ? (promo.discount_type === "flat_aed" ? "AED " + promo.value_aed + " off" : promo.value_percent + "% off") + " · " + (promo.promotion_products?.length ?? 0) + " products" : promo.description || "Storefront campaign"}</p><p className="mt-1 text-xs text-muted">{promo.starts_at ? "Starts " + new Date(promo.starts_at).toLocaleString() : "Starts now"}{promo.ends_at ? " · Ends " + new Date(promo.ends_at).toLocaleString() : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(promo)} className="border border-line px-3 py-2 text-xs">Edit</button><button type="button" onClick={() => onToggle(promo, !promo.is_active)} className="border border-line px-3 py-2 text-xs">{promo.is_active ? "Pause" : "Resume"}</button><button type="button" onClick={() => onDelete(promo)} className="border border-accent-deep px-3 py-2 text-xs text-accent-deep">Delete</button></div></li>)}</ul>}</section>;
}
