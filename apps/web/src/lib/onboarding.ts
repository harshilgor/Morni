import type { Product, Store } from "@/lib/types";

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  step: number;
};

export function getOnboardingChecklist(
  store: Store | null | undefined,
  products: Product[] = [],
): OnboardingChecklistItem[] {
  const hasBasics = Boolean(
    store?.name?.trim() &&
      store?.description?.trim() &&
      store?.area?.trim() &&
      store?.address?.trim(),
  );
  const hasBrand = Boolean(store?.logo_url && store?.cover_url);
  const hasDelivery = Boolean(
    store?.opens_at &&
      store?.closes_at &&
      Number(store?.delivery_eta_minutes) >= 15,
  );
  const completeProduct = products.find(
    (product) =>
      product.title?.trim() &&
      product.description?.trim() &&
      product.price_aed > 0 &&
      (product.image_urls?.length ?? 0) > 0 &&
      (product.sizes?.length ?? 0) > 0,
  );

  return [
    {
      id: "basics",
      label: "Boutique name, description, and location",
      done: hasBasics,
      step: 1,
    },
    {
      id: "brand",
      label: "Logo and store banner",
      done: hasBrand,
      step: 2,
    },
    {
      id: "delivery",
      label: "Delivery time and opening hours",
      done: hasDelivery,
      step: 3,
    },
    {
      id: "product",
      label: "First complete product with photos",
      done: Boolean(completeProduct),
      step: 4,
    },
    {
      id: "launch",
      label: "Review and launch storefront",
      done: Boolean(store?.onboarding_completed_at) && Boolean(store?.is_active),
      step: 5,
    },
  ];
}

export function isStoreLaunchReady(
  store: Store | null | undefined,
  products: Product[] = [],
) {
  return getOnboardingChecklist(store, products)
    .filter((item) => item.id !== "launch")
    .every((item) => item.done);
}
