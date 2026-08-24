"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { SiteHeaderSkeleton } from "@/components/catalog-skeletons";

const SiteHeader = dynamic(
  () => import("@/components/site-header").then((module) => module.SiteHeader),
  {
    loading: () => <SiteHeaderSkeleton />,
    ssr: true,
  },
);

export function ShopChrome() {
  const pathname = usePathname();

  // Store setup is a focused workspace. Do not render shopper navigation while
  // the owner is completing the onboarding flow.
  if (pathname === "/sell/setup") return null;

  return (
    <Suspense fallback={<SiteHeaderSkeleton />}>
      <SiteHeader />
    </Suspense>
  );
}
