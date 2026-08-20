import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Manrope, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Morni",
  title: "Morni — Local retail, same-day delivery",
  description:
    "Browse UAE boutique offerings and get fashion delivered the same day.",
  openGraph: {
    title: "Morni — Local retail, same-day delivery",
    description:
      "Browse UAE boutique offerings and get fashion delivered the same day.",
    siteName: "Morni",
    type: "website",
  },
};

// React Flight $RS (completeSegment) lacks null checks and can crash the page
// during Suspense streaming (facebook/react#35056). Lock a safe implementation
// in <head> before React's inline runtime assigns the buggy one.
const SAFE_RS_POLYFILL = `(function(){var s=function(a,b){a=document.getElementById(a);b=document.getElementById(b);if(a&&b&&a.parentNode&&b.parentNode){for(a.parentNode.removeChild(a);a.firstChild;)b.parentNode.insertBefore(a.firstChild,b);b.parentNode.removeChild(b)}};try{Object.defineProperty(globalThis,"$RS",{configurable:true,enumerable:false,get:function(){return s},set:function(){}})}catch(e){globalThis.$RS=s}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        display.variable,
        body.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <head>
        <script
          // Critical: must run before any streamed $RS(...) calls.
          dangerouslySetInnerHTML={{ __html: SAFE_RS_POLYFILL }}
        />
      </head>
      <body className="min-h-full antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
