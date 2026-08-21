import { Suspense } from "react";
import dynamic from "next/dynamic";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderSkeleton } from "@/components/catalog-skeletons";

const SiteHeader = dynamic(
  () =>
    import("@/components/site-header").then((module) => module.SiteHeader),
  {
    loading: () => <SiteHeaderSkeleton />,
    ssr: true,
  },
);

// Incremental Cache Components adoption for auth/cookie-heavy shop routes.
export const instant = false;

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={<SiteHeaderSkeleton />}>
        <SiteHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <SiteFooter />
      </Suspense>
    </div>
  );
}
