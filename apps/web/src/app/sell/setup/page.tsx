"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DeliverySetupFields,
  type DeliverySetupValue,
} from "@/components/delivery-setup-fields";
import {
  emptyProductForm,
  ProductFormFields,
  type CategoryOption,
  type ProductFormValue,
} from "@/components/product-form-fields";
import {
  StoreBrandingFields,
  type StoreBrandingValue,
} from "@/components/store-branding-fields";
import {
  StoreLocationFields,
  type StoreLocationValue,
} from "@/components/store-location-fields";
import { StorefrontPreview } from "@/components/storefront-preview";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import {
  uploadStoreMedia,
} from "@/lib/media-upload";
import {
  getOnboardingChecklist,
  isStoreLaunchReady,
} from "@/lib/onboarding";
import {
  ensureStoreCategory,
  loadBrowseCategoryOptions,
} from "@/lib/store-category";
import type { Product, Store } from "@/lib/types";
import {
  getResumeOnboardingStep,
  isOnboardingComplete,
  useOwnerStore,
} from "@/lib/use-owner-store";

const STEPS = [
  { n: 1 as const, label: "Basics", title: "Boutique basics" },
  { n: 2 as const, label: "Brand", title: "Brand identity" },
  { n: 3 as const, label: "Delivery", title: "Delivery setup" },
  { n: 4 as const, label: "Product", title: "First product" },
  { n: 5 as const, label: "Launch", title: "Review and launch" },
];

type Step = (typeof STEPS)[number]["n"];

export default function SellSetupPage() {
  const router = useRouter();
  const { store, loading, error, refresh } = useOwnerStore();
  const [step, setStep] = useState<Step>(1);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProductFormValue, string>>
  >({});
  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<StoreLocationValue>({
    emirate: "dubai",
    area: "",
    address: "",
    lat: null,
    lng: null,
  });
  const [branding, setBranding] = useState<StoreBrandingValue>({
    logoFile: null,
    coverFile: null,
    logoUrl: null,
    coverUrl: null,
  });
  const [delivery, setDelivery] = useState<DeliverySetupValue>({
    delivery_eta_minutes: "60",
    opens_at: "10:00",
    closes_at: "22:00",
  });
  const [productForm, setProductForm] = useState<ProductFormValue>(emptyProductForm());

  const logoPreview = useMemo(
    () => (branding.logoFile ? URL.createObjectURL(branding.logoFile) : null),
    [branding.logoFile],
  );
  const coverPreview = useMemo(
    () => (branding.coverFile ? URL.createObjectURL(branding.coverFile) : null),
    [branding.coverFile],
  );

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useEffect(() => {
    void loadBrowseCategoryOptions().then(setCategories);
  }, []);

  useEffect(() => {
    if (loading || hydrated) return;

    const sync = () => {
      if (store && isOnboardingComplete(store) && store.is_active) {
        router.replace("/portal");
        return;
      }

      if (store) {
        setName(store.name ?? "");
        setDescription(store.description ?? "");
        setLocation({
          emirate: store.emirate,
          area: store.area ?? "",
          address: store.address ?? "",
          lat: store.lat,
          lng: store.lng,
        });
        setBranding({
          logoFile: null,
          coverFile: null,
          logoUrl: store.logo_url,
          coverUrl: store.cover_url,
        });
        setDelivery({
          delivery_eta_minutes: String(store.delivery_eta_minutes ?? 60),
          opens_at: store.opens_at?.slice(0, 5) ?? "10:00",
          closes_at: store.closes_at?.slice(0, 5) ?? "22:00",
        });
        setStep(getResumeOnboardingStep(store) as Step);
        void loadProducts(store.id).then((loaded) => {
          const first = loaded[0];
          if (!first) return;
          setProductForm({
            title: first.title ?? "",
            description: first.description ?? "",
            categorySlug: "",
            price_aed: String(first.price_aed ?? ""),
            compare_at_price_aed: first.compare_at_price_aed
              ? String(first.compare_at_price_aed)
              : "",
            stock: String(first.stock ?? 10),
            sizes: first.sizes?.length ? first.sizes : ["S", "M", "L"],
            images: (first.image_urls ?? []).map((url, index) => ({
              id: `existing-${index}`,
              url,
            })),
          });
        });
      }

      setHydrated(true);
    };

    if (typeof queueMicrotask === "function") queueMicrotask(sync);
    else window.setTimeout(sync, 0);
  }, [loading, store, hydrated, router]);

  async function loadProducts(storeId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    const next = (data as Product[]) ?? [];
    setProducts(next);
    return next;
  }

  function flashSaved() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  async function persistStep(storeId: string, nextStep: number) {
    const supabase = createClient();
    await supabase
      .from("stores")
      .update({ onboarding_step: nextStep })
      .eq("id", storeId);
  }

  async function saveBasics(e: FormEvent) {
    e.preventDefault();
    if (!location.area.trim() || !location.address.trim()) {
      setMessage("Add your area and exact street address.");
      return;
    }
    if (!description.trim()) {
      setMessage("Add a short description shoppers will see.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    try {
      if (store) {
        const { error: updateError } = await supabase
          .from("stores")
          .update({
            name: name.trim(),
            description: description.trim(),
            emirate: location.emirate,
            area: location.area.trim(),
            address: location.address.trim(),
            lat: location.lat,
            lng: location.lng,
            onboarding_step: Math.max(store.onboarding_step ?? 1, 2),
          })
          .eq("id", store.id);

        if (updateError) throw new Error(updateError.message);
        await refresh();
        flashSaved();
        setStep(2);
        setBusy(false);
        return;
      }

      const baseSlug = slugify(name) || `store-${Date.now()}`;
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data, error: createError } = await supabase.rpc("create_owned_store", {
        p_name: name.trim(),
        p_slug: slug,
        p_description: description.trim(),
        p_emirate: location.emirate,
        p_area: location.area.trim(),
        p_address: location.address.trim(),
        p_lat: location.lat,
        p_lng: location.lng,
        p_delivery_eta_minutes: Number(delivery.delivery_eta_minutes) || 60,
        p_opens_at: delivery.opens_at,
        p_closes_at: delivery.closes_at,
      });

      if (createError) throw new Error(createError.message);

      const created = (Array.isArray(data) ? data[0] : data) as Store | null;
      if (!created) throw new Error("Could not create store.");

      await refresh();
      flashSaved();
      setStep(2);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save boutique basics.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBrand(e: FormEvent) {
    e.preventDefault();
    if (!store) {
      setMessage("Create your boutique basics first.");
      setStep(1);
      return;
    }

    setLogoError(null);
    setCoverError(null);

    const nextLogo = branding.logoFile
      ? null
      : branding.logoUrl ?? store.logo_url;
    const nextCover = branding.coverFile
      ? null
      : branding.coverUrl ?? store.cover_url;

    if (!branding.logoFile && !nextLogo) {
      setLogoError("Upload a store logo.");
      return;
    }
    if (!branding.coverFile && !nextCover) {
      setCoverError("Upload a store banner.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      let logo_url = nextLogo;
      let cover_url = nextCover;

      if (branding.logoFile) {
        logo_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.logoFile,
          prefix: "logo",
        });
      }
      if (branding.coverFile) {
        cover_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.coverFile,
          prefix: "cover",
        });
      }

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("stores")
        .update({
          logo_url,
          cover_url,
          onboarding_step: Math.max(store.onboarding_step ?? 2, 3),
        })
        .eq("id", store.id);

      if (updateError) throw new Error(updateError.message);

      setBranding({
        logoFile: null,
        coverFile: null,
        logoUrl: logo_url,
        coverUrl: cover_url,
      });
      await refresh();
      flashSaved();
      setStep(3);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save branding.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDelivery(e: FormEvent) {
    e.preventDefault();
    if (!store) {
      setMessage("Create your boutique basics first.");
      setStep(1);
      return;
    }

    const eta = Number(delivery.delivery_eta_minutes);
    if (!Number.isFinite(eta) || eta < 15 || eta > 180) {
      setMessage("Delivery ETA must be between 15 and 180 minutes.");
      return;
    }
    if (!delivery.opens_at || !delivery.closes_at) {
      setMessage("Set opening and closing hours.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("stores")
      .update({
        delivery_eta_minutes: eta,
        opens_at: delivery.opens_at,
        closes_at: delivery.closes_at,
        onboarding_step: Math.max(store.onboarding_step ?? 3, 4),
      })
      .eq("id", store.id);

    setBusy(false);
    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    await refresh();
    flashSaved();
    setStep(4);
  }

  async function saveFirstProduct(e: FormEvent) {
    e.preventDefault();
    if (!store) {
      setMessage("Create your boutique basics first.");
      setStep(1);
      return;
    }

    const errors: Partial<Record<keyof ProductFormValue, string>> = {};
    if (!productForm.title.trim()) errors.title = "Title is required.";
    if (!productForm.description.trim()) {
      errors.description = "Description is required.";
    }
    if (!productForm.categorySlug) {
      errors.categorySlug = "Choose a category.";
    }
    const price = Number(productForm.price_aed);
    if (!Number.isFinite(price) || price <= 0) {
      errors.price_aed = "Enter a valid price.";
    }
    const stock = Number(productForm.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      errors.stock = "Enter a valid stock count.";
    }
    if (productForm.sizes.length === 0) {
      errors.sizes = "Select at least one size.";
    }
    if (productForm.images.length === 0) {
      errors.images = "Add at least one product photo.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMessage("Fix the highlighted product fields to continue.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const category = categories.find((c) => c.slug === productForm.categorySlug);
      const categoryId = await ensureStoreCategory({
        storeId: store.id,
        categorySlug: productForm.categorySlug,
        categoryName: category?.name,
      });

      const image_urls: string[] = [];
      for (const item of productForm.images) {
        if (item.file) {
          const uploaded = await uploadStoreMedia({
            bucket: "product-images",
            storeId: store.id,
            file: item.file,
            prefix: `product-${image_urls.length + 1}`,
          });
          image_urls.push(uploaded);
        } else if (item.url) {
          image_urls.push(item.url);
        }
      }

      if (image_urls.length === 0) {
        throw new Error("Add at least one product photo.");
      }

      const compareAt = productForm.compare_at_price_aed.trim()
        ? Number(productForm.compare_at_price_aed)
        : null;

      const supabase = createClient();
      const existingComplete = products.find(
        (product) =>
          product.title?.trim() &&
          product.description?.trim() &&
          (product.image_urls?.length ?? 0) > 0,
      );

      if (existingComplete) {
        const { error: updateError } = await supabase
          .from("products")
          .update({
            title: productForm.title.trim(),
            description: productForm.description.trim(),
            category_id: categoryId,
            price_aed: price,
            compare_at_price_aed:
              compareAt && Number.isFinite(compareAt) ? compareAt : null,
            stock,
            sizes: productForm.sizes,
            image_urls,
            is_available: true,
          })
          .eq("id", existingComplete.id)
          .eq("store_id", store.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase.from("products").insert({
          store_id: store.id,
          category_id: categoryId,
          title: productForm.title.trim(),
          description: productForm.description.trim(),
          price_aed: price,
          compare_at_price_aed:
            compareAt && Number.isFinite(compareAt) ? compareAt : null,
          stock,
          sizes: productForm.sizes,
          image_urls,
          is_available: true,
        });
        if (insertError) throw new Error(insertError.message);
      }

      await persistStep(store.id, Math.max(store.onboarding_step ?? 4, 5));
      await loadProducts(store.id);
      await refresh();
      flashSaved();
      setStep(5);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  }

  async function launchStore() {
    if (!store) return;
    if (!isStoreLaunchReady(store, products)) {
      setMessage("Finish every checklist item before launching.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error: launchError } = await supabase.rpc("launch_owned_store", {
      p_store_id: store.id,
    });

    if (launchError) {
      setMessage(launchError.message);
      setBusy(false);
      return;
    }

    await refresh();
    setBusy(false);
    setLaunched(true);
  }

  const checklist = useMemo(
    () => getOnboardingChecklist(store, products),
    [store, products],
  );

  const primaryProduct = products[0];
  const productImagePreview =
    productForm.images[0]?.previewUrl ??
    productForm.images[0]?.url ??
    primaryProduct?.image_urls?.[0] ??
    null;

  const previewData = {
    name: name || store?.name || "Your boutique",
    description: description || store?.description || "",
    emirate: location.emirate,
    area: location.area || store?.area || "",
    address: location.address || store?.address || "",
    logoUrl: logoPreview || branding.logoUrl || store?.logo_url,
    coverUrl: coverPreview || branding.coverUrl || store?.cover_url,
    deliveryEtaMinutes:
      Number(delivery.delivery_eta_minutes) ||
      store?.delivery_eta_minutes ||
      60,
    opensAt: delivery.opens_at || store?.opens_at?.slice(0, 5) || "10:00",
    closesAt: delivery.closes_at || store?.closes_at?.slice(0, 5) || "22:00",
    product: {
      title: productForm.title || primaryProduct?.title || "First product",
      priceAed:
        Number(productForm.price_aed) || Number(primaryProduct?.price_aed) || 0,
      compareAtPriceAed: productForm.compare_at_price_aed
        ? Number(productForm.compare_at_price_aed)
        : primaryProduct?.compare_at_price_aed,
      imageUrl: productImagePreview,
    },
  };

  if (error === "unauthenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl text-ink">Sign in to sell on Morni</h1>
        <p className="mt-2 text-sm text-muted">
          Create an account, then finish your store setup. Progress is saved as
          you go.
        </p>
        <Link
          href="/auth?next=/sell/setup"
          className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
        >
          Sign in / Sign up
        </Link>
      </div>
    );
  }

  if (loading || !hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-muted">Loading setup…</div>
    );
  }

  if (launched && store) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="text-xs uppercase tracking-[0.18em] text-mint">Live</p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          {store.name} is live
        </h1>
        <p className="mt-3 text-sm text-muted">
          Shoppers can now find your boutique on Morni. Keep adding products and
          fine-tune settings anytime.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/stores/${store.slug}`}
            className="rounded-full bg-ink px-6 py-3 text-sm text-white"
          >
            View my store
          </Link>
          <Link
            href="/portal/products"
            className="rounded-full border border-line bg-surface px-6 py-3 text-sm text-ink"
          >
            Add another product
          </Link>
        </div>
      </div>
    );
  }

  const current = STEPS.find((item) => item.n === step) ?? STEPS[0];
  const previewMode =
    step >= 5 ? "launch" : step >= 4 ? "product" : ("store" as const);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
            Store setup · Step {step} of 5 · about 8 minutes
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
            {current.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {step === 1 && "Name, story, and exact location for your boutique."}
            {step === 2 &&
              "Add a logo and banner so your storefront looks complete."}
            {step === 3 &&
              "Set a delivery promise and hours shoppers can rely on."}
            {step === 4 &&
              "Create one sellable product with photos, sizes, and category."}
            {step === 5 &&
              "Check everything looks right, then launch when you are ready."}
          </p>
        </div>
        {savedFlash ? (
          <span className="rounded-full bg-[#e8f5ef] px-3 py-1.5 text-xs font-medium text-mint">
            Saved
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-5">
        {STEPS.map((item) => (
          <button
            key={item.n}
            type="button"
            disabled={!store && item.n > 1}
            onClick={() => {
              if (!store && item.n > 1) return;
              if (store && item.n > Math.max(store.onboarding_step, step)) return;
              setStep(item.n);
              setMessage(null);
            }}
            className="text-left"
          >
            <div
              className={`h-1.5 rounded-full ${
                item.n <= step ? "bg-accent" : "bg-line"
              }`}
            />
            <p
              className={`mt-2 text-xs ${
                item.n === step ? "font-semibold text-ink" : "text-muted"
              }`}
            >
              {item.label}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {step === 1 ? (
            <form
              onSubmit={saveBasics}
              className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-6"
            >
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted">
                  Store name <span className="text-accent-deep">*</span>
                </span>
                <input
                  className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted">
                  Short description <span className="text-accent-deep">*</span>
                </span>
                <textarea
                  className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What makes your boutique special?"
                  required
                />
              </label>
              <StoreLocationFields value={location} onChange={setLocation} />
              {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
              <WizardNav
                busy={busy}
                canBack={false}
                continueLabel={store ? "Save & continue" : "Create boutique"}
              />
            </form>
          ) : null}

          {step === 2 ? (
            <form
              onSubmit={saveBrand}
              className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-6"
            >
              <StoreBrandingFields
                value={branding}
                onChange={setBranding}
                required
                logoError={logoError}
                coverError={coverError}
              />
              {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
              <WizardNav
                busy={busy}
                onBack={() => setStep(1)}
                continueLabel="Save & continue"
              />
            </form>
          ) : null}

          {step === 3 ? (
            <form
              onSubmit={saveDelivery}
              className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-6"
            >
              <DeliverySetupFields value={delivery} onChange={setDelivery} />
              {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
              <WizardNav
                busy={busy}
                onBack={() => setStep(2)}
                continueLabel="Save & continue"
              />
            </form>
          ) : null}

          {step === 4 ? (
            <form
              onSubmit={saveFirstProduct}
              className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-6"
            >
              <ProductFormFields
                value={productForm}
                onChange={setProductForm}
                categories={categories}
                requireImages
                fieldErrors={fieldErrors}
              />
              {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
              <WizardNav
                busy={busy}
                onBack={() => setStep(3)}
                continueLabel="Save product & continue"
              />
            </form>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
              <h2 className="font-display text-2xl text-ink">Launch checklist</h2>
              <ul className="space-y-2">
                {checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/80 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          item.done
                            ? "bg-[#e8f5ef] text-mint"
                            : "bg-sand text-muted"
                        }`}
                      >
                        {item.done ? "✓" : item.step}
                      </span>
                      <span className="text-sm text-ink">{item.label}</span>
                    </div>
                    {!item.done && item.id !== "launch" ? (
                      <button
                        type="button"
                        onClick={() => setStep(item.step as Step)}
                        className="text-xs text-accent-deep underline"
                      >
                        Fix
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>

              {message ? <p className="text-sm text-accent-deep">{message}</p> : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-full border border-line px-5 py-2.5 text-sm text-ink"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy || !isStoreLaunchReady(store, products)}
                  onClick={launchStore}
                  className="rounded-full bg-ink px-6 py-2.5 text-sm text-white disabled:opacity-50"
                >
                  {busy ? "Launching…" : "Launch my store"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <StorefrontPreview data={previewData} mode={previewMode} />
        </aside>
      </div>
    </div>
  );
}

function WizardNav({
  busy,
  onBack,
  canBack = true,
  continueLabel,
}: {
  busy: boolean;
  onBack?: () => void;
  canBack?: boolean;
  continueLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {canBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line px-5 py-2.5 text-sm text-ink"
        >
          Back
        </button>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-ink px-6 py-2.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : continueLabel}
      </button>
    </div>
  );
}
