import path from "path";
import type { NextConfig } from "next";

const deliverySrc = path.join(__dirname, "../delivery/src");
const founderSrc = path.join(__dirname, "../founder/src");

function configuredSupabaseHostname() {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://api.morniuae.com",
    ).hostname;
  } catch {
    return "api.morniuae.com";
  }
}

const supabaseHostname = configuredSupabaseHostname();
const storageRemotePatterns = [
  {
    protocol: "https" as const,
    hostname: supabaseHostname,
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https" as const,
    hostname: supabaseHostname,
    pathname: "/storage/v1/object/sign/**",
  },
  // Product and store uploads may still contain a direct Supabase project URL.
  // Keep all Supabase project hosts valid so a project migration cannot break
  // every vendor's catalog images again.
  {
    protocol: "https" as const,
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https" as const,
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/sign/**",
  },
];

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
    qualities: [75, 90, 100],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      ...storageRemotePatterns,
      {
        protocol: "https",
        hostname: "api.morniuae.com",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
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
        ],
      },
    ];
  },
};

export default nextConfig;
