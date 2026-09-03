import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: "Morni Rider",
  title: {
    default: "Morni Rider",
    template: "%s · Morni Rider",
  },
  description: "Accept nearby pickups and deliver Morni orders.",
  manifest: "/driver/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Morni Rider",
  },
};

export const instant = false;

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function DriverLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="driver-experience min-h-dvh [padding:env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]">
      {children}
    </div>
  );
}
