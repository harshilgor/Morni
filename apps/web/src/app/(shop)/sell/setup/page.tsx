"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import {
  uploadStoreMedia,
} from "@/lib/media-upload";
import {
  aggregateFromColorDrafts,
  colorDraftFromProduct,
  createColorDraft,
  validateColorDrafts,
} from "@/lib/product-variants";
import { replaceProductVariants } from "@/lib/save-product-variants";
import {
  getOnboardingChecklist,
} from "@/lib/onboarding";
import {
  ensureStoreCategory,
  loadBrowseCategoryOptions,
} from "@/lib/store-category";
import type { Product, Store } from "@/lib/types";
import { customizationConfigFromProduct } from "@/lib/product-customization";
import { SellerSetupHeader } from "@/components/seller-setup-header";
import {
  getResumeOnboardingStep,
  isOnboardingComplete,
  useOwnerStore,
} from "@/lib/use-owner-store";

const STEPS = [
  { n: 1 as const, label: "Basics", title: "Boutique basics" },
  { n: 2 as const, label: "Brand", title: "Brand identity" },
  { n: 3 as const, label: "Product", title: "Add Your First Product!" },
  { n: 4 as const, label: "Launch", title: "Review and launch" },
];

type Step = (typeof STEPS)[number]["n"];

export default function SellSetupPage() {
  const router = useRouter();
  const { store, loading, error, refresh } = useOwnerStore();
  const [creatingNew, setCreatingNew] = useState(false);
  const [modeReady, setModeReady] = useState(false);
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
  const [sizeChartError, setSizeChartError] = useState<string | null>(null);

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
    logoUrl: null,
  });
  const [productForm, setProductForm] = useState<ProductFormValue>(emptyProductForm());

  useEffect(() => {
    void loadBrowseCategoryOptions().then(setCategories);
  }, []);

  useEffect(() => {
    const syncMode = () => {
      const search = new URLSearchParams(window.location.search);
      setCreatingNew(search.get("new") === "1");
      setModeReady(true);
    };
    if (typeof queueMicrotask === "function") queueMicrotask(syncMode);
    else window.setTimeout(syncMode, 0);
  }, []);

  useEffect(() => {
    if (loading || !modeReady || hydrated) return;

    const sync = () => {
      if (creatingNew) {
        setHydrated(true);
        return;
      }

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
          logoUrl: store.logo_url,
          sizeChartFile: null,
          sizeChartUrl: store.size_chart_url,
        });
        setStep(getResumeOnboardingStep(store) as Step);
        void loadProducts(store.id).then((loaded) => {
          const first = loaded[0];
          if (!first) return;
          setProductForm({
            title: first.title ?? "",
            description: first.description ?? "",
            fabric: first.fabric ?? "",
            categorySlug: first.category?.slug ?? "",
            price_aed: String(first.price_aed ?? ""),
            compare_at_price_aed: first.compare_at_price_aed
              ? String(first.compare_at_price_aed)
              : "",
            stock: String(first.stock ?? 10),
            sizes: first.sizes?.length ? first.sizes : ["S", "M", "L"],
            customization: customizationConfigFromProduct(first),
            images: (first.image_urls ?? []).map((url, index) => ({
              id: `existing-${index}`,
              url,
            })),
            colors: [colorDraftFromProduct(first)],
          });
        });
      }

      setHydrated(true);
    };

    if (typeof queueMicrotask === "function") queueMicrotask(sync);
    else window.setTimeout(sync, 0);
  }, [loading, store, hydrated, router, creatingNew, modeReady]);

  async function loadProducts(storeId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*, categories(name, slug)")
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
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    try {
      if (store && !creatingNew) {
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
        p_delivery_eta_minutes: 60,
        p_opens_at: "10:00",
        p_closes_at: "22:00",
      });

      if (createError) throw new Error(createError.message);

      const created = (Array.isArray(data) ? data[0] : data) as Store | null;
      if (!created) throw new Error("Could not create store.");

      await refresh(created.id);
      setCreatingNew(false);
      router.replace("/sell/setup");
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
    setSizeChartError(null);
    const nextLogo = branding.logoFile
      ? null
      : branding.logoUrl ?? store.logo_url;

    if (!branding.logoFile && !nextLogo) {
      setLogoError("Upload a store logo.");
      return;
    }
    setBusy(true);
    setMessage(null);

    try {
      let logo_url = nextLogo;
      let size_chart_url = branding.sizeChartUrl ?? store.size_chart_url ?? null;

      if (branding.logoFile) {
        logo_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.logoFile,
          prefix: "logo",
        });
      }
      if (branding.sizeChartFile) {
        size_chart_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.sizeChartFile,
          prefix: "size-chart",
        });
      }
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("stores")
        .update({
          logo_url,
          size_chart_url,
          onboarding_step: Math.max(store.onboarding_step ?? 2, 3),
        })
        .eq("id", store.id);

      if (updateError) throw new Error(updateError.message);

      setBranding({
        logoFile: null,
        logoUrl: logo_url,
        sizeChartFile: null,
        sizeChartUrl: size_chart_url,
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

  function skipFirstProduct() {
    router.push("/portal/products");
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
    const hasSizes = !["gifting", "hamper", "hampers"].includes(productForm.categorySlug);
    const colors = productForm.colors?.length ? productForm.colors : [createColorDraft({
      color_name: "Default",
      sizes: productForm.sizes,
      stock: productForm.stock,
      size_stock: productForm.sizeStock ?? {},
      images: productForm.images.map((image) => ({ id: image.id, url: image.url ?? "", file: image.file })),
    })];
    const colorError = validateColorDrafts(colors, { requireSizes: hasSizes });
    if (colorError) errors.images = colorError;
    if (colors.every((color) => color.images.length === 0)) {
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
      const aggregate = aggregateFromColorDrafts(colors, hasSizes);

      if (existingComplete) {
        const { error: updateError } = await supabase
          .from("products")
          .update({
            title: productForm.title.trim(),
            description: productForm.description.trim(),
            fabric: productForm.categorySlug === "gifting" ? null : productForm.fabric || null,
            category_id: categoryId,
            price_aed: price,
            compare_at_price_aed:
              compareAt && Number.isFinite(compareAt) ? compareAt : null,
            stock: aggregate.stock,
            sizes: aggregate.sizes,
            size_stock: hasSizes ? aggregate.size_stock : {},
            customization_enabled: productForm.customization.enabled,
            customization_instructions: productForm.customization.enabled
              ? productForm.customization.instructions.trim()
              : null,
            customization_fields: productForm.customization.enabled
              ? productForm.customization.fields
              : [],
            image_urls: [],
            is_available: true,
          })
          .eq("id", existingComplete.id)
          .eq("store_id", store.id);
        if (updateError) throw new Error(updateError.message);
        await replaceProductVariants({ storeId: store.id, productId: existingComplete.id, drafts: hasSizes ? colors : colors.map((color) => ({ ...color, sizes: [] })) });
      } else {
        const { data: created, error: insertError } = await supabase.from("products").insert({
          store_id: store.id,
          category_id: categoryId,
          title: productForm.title.trim(),
          description: productForm.description.trim(),
          fabric: productForm.categorySlug === "gifting" ? null : productForm.fabric || null,
          price_aed: price,
          compare_at_price_aed:
            compareAt && Number.isFinite(compareAt) ? compareAt : null,
          stock: aggregate.stock,
          sizes: aggregate.sizes,
          size_stock: hasSizes ? aggregate.size_stock : {},
          customization_enabled: productForm.customization.enabled,
          customization_instructions: productForm.customization.enabled
            ? productForm.customization.instructions.trim()
            : null,
          customization_fields: productForm.customization.enabled
            ? productForm.customization.fields
            : [],
          image_urls: [],
          is_available: true,
        }).select("id").single();
        if (insertError) throw new Error(insertError.message);
        if (!created) throw new Error("Could not create the product.");
        await replaceProductVariants({ storeId: store.id, productId: created.id, drafts: hasSizes ? colors : colors.map((color) => ({ ...color, sizes: [] })) });
      }

      await persistStep(store.id, Math.max(store.onboarding_step ?? 4, 5));
      await loadProducts(store.id);
      await refresh();
      flashSaved();
      setStep(4);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  }

  async function launchStore() {
    if (!store) return;

    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data: readiness, error: readinessError } = await supabase.rpc(
      "get_owned_store_launch_readiness",
      { p_store_id: store.id },
    );

    if (readinessError) {
      setMessage(readinessError.message);
      setBusy(false);
      return;
    }

    const readinessResult = readiness as { ready?: boolean; blockers?: string[] } | null;
    if (!readinessResult?.ready) {
      setMessage(
        readinessResult?.blockers?.join(" ") ??
          "Finish the required store setup before launching.",
      );
      setBusy(false);
      return;
    }

    const { data: launchedStore, error: launchError } = await supabase.rpc(
      "launch_owned_store",
      {
      p_store_id: store.id,
      },
    );

    if (launchError) {
      setMessage(launchError.message);
      setBusy(false);
      return;
    }

    if (!(launchedStore as Store | null)?.is_active) {
      setMessage("Launch did not complete. Please try again or contact support.");
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

  if (error === "unauthenticated") {
    return (
      <div className="seller-setup-page">
        <SellerSetupHeader saved={savedFlash} />
        <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
          <span className="seller-setup-kicker">Morni seller workspace</span>
          <h1 className="mt-3 font-display text-3xl text-ink">Sign in to sell on Morni</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Create an account, then finish your store setup. Progress is saved as
            you go.
          </p>
          <Link
            href="/auth?next=/sell/setup"
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-mint"
          >
            Sign in / Sign up
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !modeReady || !hydrated) {
    return (
      <div className="seller-setup-page">
        <SellerSetupHeader saved={savedFlash} />
        <div className="seller-setup-loading mx-auto max-w-lg px-4 py-16 sm:px-6">
          <div className="h-2 w-28 rounded-full bg-line" />
          <div className="mt-4 h-10 w-3/4 rounded-xl bg-line/80" />
          <div className="mt-3 h-4 w-full rounded-full bg-line/70" />
          <div className="mt-8 h-64 rounded-[1.25rem] border border-line bg-surface/80" />
        </div>
      </div>
    );
  }

  if (launched && store) {
    return (
      <div className="seller-setup-page">
        <SellerSetupHeader saved={savedFlash} />
        <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <p className="seller-setup-kicker text-mint">Your storefront is live</p>
          <h1 className="mt-3 font-display text-4xl text-ink">
            {store.name} is live
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Shoppers can now find your boutique on Morni. Keep adding products and
            fine-tune settings anytime.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/stores/${store.slug}`}
              className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-mint"
            >
              View my store
            </Link>
            <Link
              href="/portal/products"
              className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-mint"
            >
              Add another product
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const current = STEPS.find((item) => item.n === step) ?? STEPS[0];
  return (
    <div className="seller-setup-page">
      <SellerSetupHeader saved={savedFlash} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="seller-setup-kicker">
              Store setup · about 6 minutes
            </p>
            <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">
              {current.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {step === 1 && "Add your name and exact location. A short description is optional."}
              {step === 2 &&
                "Add a logo so shoppers can recognise your storefront."}
              {step === 3 &&
                "Create one sellable product with photos, sizes, and category."}
              {step === 4 &&
                "Check everything looks right, then launch when you are ready."}
            </p>
          </div>
          <div className="seller-setup-time-note">
            <span className="seller-setup-time-icon" aria-hidden>⌁</span>
            You can come back and finish later
          </div>
        </div>

        <div className="seller-setup-stepper mt-7" aria-label="Store setup progress">
          <div className="seller-setup-stepper-mobile">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">Step {step} of 4</span>
              <span className="text-muted">{current.label}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="seller-setup-stepper-desktop grid gap-2 sm:grid-cols-4">
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
                aria-current={item.n === step ? "step" : undefined}
              >
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    item.n <= step ? "bg-accent" : "bg-line"
                  }`}
                />
                <p
                  className={`mt-2 text-xs ${
                    item.n === step ? "font-semibold text-ink" : "text-muted"
                  }`}
                >
                  {item.n}. {item.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 max-w-3xl">
          {step === 1 ? (
            <form
              onSubmit={saveBasics}
              className="seller-setup-form space-y-4 rounded-[1.25rem] border border-line bg-surface p-4 sm:p-7"
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
                  Short description <span className="text-muted">(optional)</span>
                </span>
                <textarea
                  className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What makes your boutique special?"
                />
              </label>
              <StoreLocationFields value={location} onChange={setLocation} />
              {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
              <WizardNav
                busy={busy}
                canBack={false}
                continueLabel={store && !creatingNew ? "Save & continue" : "Create boutique"}
              />
            </form>
          ) : null}

          {step === 2 ? (
            <form
              onSubmit={saveBrand}
              className="seller-setup-form space-y-4 rounded-[1.25rem] border border-line bg-surface p-4 sm:p-7"
            >
              <StoreBrandingFields
                value={branding}
                onChange={setBranding}
                required
                logoError={logoError}
                sizeChartError={sizeChartError}
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
              onSubmit={saveFirstProduct}
              className="seller-setup-form space-y-4 rounded-[1.25rem] border border-line bg-surface p-4 sm:p-7"
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
                onBack={() => setStep(2)}
                continueLabel="Save product & continue"
                secondaryLabel="Skip for now"
                onSecondaryAction={skipFirstProduct}
              />
            </form>
          ) : null}

          {step === 4 ? (
            <div className="seller-setup-form space-y-4 rounded-[1.25rem] border border-line bg-surface p-4 sm:p-7">
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

              <div className="seller-setup-actions flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex min-h-12 items-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-mint"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={launchStore}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-mint disabled:opacity-50 sm:flex-none"
                >
                  {busy ? "Launching…" : "Launch my store"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WizardNav({
  busy,
  onBack,
  canBack = true,
  continueLabel,
  secondaryLabel,
  onSecondaryAction,
}: {
  busy: boolean;
  onBack?: () => void;
  canBack?: boolean;
  continueLabel: string;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="seller-setup-actions flex items-center gap-2 pt-2 sm:flex-wrap">
      {canBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-mint sm:min-h-12 sm:px-5 sm:py-2.5 sm:text-sm"
        >
          Back
        </button>
      ) : null}
      {secondaryLabel && onSecondaryAction ? (
        <button
          type="button"
          onClick={onSecondaryAction}
          disabled={busy}
        className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-mint disabled:opacity-50 sm:min-h-12 sm:px-5 sm:py-2.5 sm:text-sm"
        >
          {secondaryLabel}
        </button>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-mint disabled:opacity-50 sm:min-h-12 sm:flex-none sm:px-6 sm:py-2.5 sm:text-sm"
      >
        {busy ? "Saving…" : continueLabel}
      </button>
    </div>
  );
}
