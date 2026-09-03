import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

const satoshi = localFont({
  src: [
    {
      path: "../fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Satoshi-Medium.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Incremental Cache Components adoption: allow request-time routes to block
// until they are converted to Suspense / `use cache`.
export const instant = false;

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
      className={cn("h-full", satoshi.variable, "font-sans")}
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
