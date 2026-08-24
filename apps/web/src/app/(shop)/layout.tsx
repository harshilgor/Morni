import { ShopChrome } from "@/components/shop-chrome";
import { SiteFooter } from "@/components/site-footer";

// Incremental Cache Components adoption for auth/cookie-heavy shop routes.
export const instant = false;

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-col">
      <ShopChrome />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
