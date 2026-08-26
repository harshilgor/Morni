import { ShopChrome } from "@/components/shop-chrome";
import { SiteFooter } from "@/components/site-footer";
import { CartHydrator } from "@/components/cart-hydrator";
import { connection } from "next/server";

// Incremental Cache Components adoption for auth/cookie-heavy shop routes.
export const instant = false;

export default async function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Shopper routes rely on browser session state. With Cache Components enabled,
  // this explicitly opts the subtree into request-time rendering.
  await connection();

  return (
    <div className="flex min-h-full flex-col">
      <CartHydrator />
      <ShopChrome />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
