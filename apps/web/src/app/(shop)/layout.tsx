import { ShopChrome } from "@/components/shop-chrome";
import { SiteFooter } from "@/components/site-footer";
import { connection } from "next/server";
import { LaunchWelcome } from "@/components/launch-welcome";

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
      <ShopChrome />
      <LaunchWelcome />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
