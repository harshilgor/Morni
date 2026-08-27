import path from "path";
import type { NextConfig } from "next";

const deliverySrc = path.join(__dirname, "../delivery/src");
const founderSrc = path.join(__dirname, "../founder/src");

const nextConfig: NextConfig = {
  // Partial prerendering + `use cache` for instant storefront shells.
  cacheComponents: true,
  // Keep tracing at the monorepo root so sibling extension packages are included,
  // but do not override turbopack.root (that fought Vercel's detected root).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    resolveAlias: {
      "@morni/delivery": deliverySrc,
      "@morni/founder": founderSrc,
      // tsconfig paths map react → @types for typechecking sibling apps.
      // Override those for the bundler with relative paths to the real packages
      // (absolute Windows paths are rejected by Turbopack).
      react: "./node_modules/react",
      "react/jsx-runtime": "./node_modules/react/jsx-runtime.js",
      "react/jsx-dev-runtime": "./node_modules/react/jsx-dev-runtime.js",
      "react-dom": "./node_modules/react-dom",
      "react-dom/client": "./node_modules/react-dom/client.js",
    },
  },
  experimental: {
    externalDir: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xobagxgagarnzxujxfag.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "api.morniuae.com",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    const supabaseHost = "https://api.morniuae.com";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.oppwa.com https://eu-test.oppwa.com https://eu-prod.oppwa.com",
      // Inline $RS polyfill + Next/Vercel runtime; AFS payment widget from OPPWA.
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.oppwa.com https://eu-test.oppwa.com https://eu-prod.oppwa.com https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://*.oppwa.com https://eu-test.oppwa.com https://eu-prod.oppwa.com https://maps.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${supabaseHost} wss://api.morniuae.com https://*.supabase.co wss://*.supabase.co https://*.oppwa.com https://eu-test.oppwa.com https://eu-prod.oppwa.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com`,
      "frame-src 'self' https://*.oppwa.com https://eu-test.oppwa.com https://eu-prod.oppwa.com https://www.openstreetmap.org",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Riders use the device camera to capture parcel proof directly in
          // the browser. Keep microphone disabled while allowing this origin.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
